import { useState, useEffect, useCallback, useRef } from "react";
import {
  Brain, Plus, Search, Inbox, Bookmark, Archive,
  Sparkles, X, Edit3, Trash2, CheckCircle2, BarChart3,
  Camera, FileText, Loader2, Sun, Zap, Target, Layers,
  ArrowRight, Star, AlertCircle, LayoutGrid, List,
  Bot, Wand2, Upload, Mic, FileSpreadsheet, Volume2,
  ArrowLeft, Settings, Key, Save
} from "lucide-react";
import {
  initAuth, fbAddCard, fbUpdateCard, fbDeleteCard,
  fbSaveSettings, fbListenCards, fbListenSettings
} from "./firebase";

// ─── Constants ───
const PARA = [
  { id: "inbox", label: "收件匣", en: "INBOX", icon: "Inbox", color: "#B8860B" },
  { id: "projects", label: "專案", en: "PROJECTS", icon: "Target", color: "#16A34A" },
  { id: "areas", label: "領域", en: "AREAS", icon: "Layers", color: "#0891B2" },
  { id: "resources", label: "資源", en: "RESOURCES", icon: "Bookmark", color: "#B8860B" },
  { id: "archives", label: "檔案庫", en: "ARCHIVES", icon: "Archive", color: "#6B7280" },
];
const MATS = [
  { id: "seed", emoji: "🌱", label: "種子", color: "#CA8A04" },
  { id: "sprout", emoji: "🌿", label: "幼苗", color: "#16A34A" },
  { id: "tree", emoji: "🌲", label: "常青樹", color: "#15803D" },
];
const TYPES = [
  { id: "thought", label: "💡 靈感", color: "#CA8A04" },
  { id: "task", label: "✅ 任務", color: "#16A34A" },
  { id: "note", label: "📝 筆記", color: "#475569" },
  { id: "market", label: "📊 情報", color: "#0891B2" },
  { id: "image", label: "🖼️ 圖片", color: "#7C3AED" },
  { id: "link", label: "🔗 連結", color: "#0D9488" },
  { id: "pdf", label: "📄 PDF", color: "#DC2626" },
  { id: "audio", label: "🎙️ 語音", color: "#EA580C" },
  { id: "csv", label: "📊 資料", color: "#0D9488" },
];
const DEFAULT_TAGS = [
  "商業模式", "競品分析", "行銷策略", "產品開發", "客戶洞察",
  "技術趨勢", "財務規劃", "太陽能", "儲能系統", "BNI",
  "稅務", "AI工具", "創業經驗"
];
const SEED_CARDS = [
  { category: "resources", maturity: "sprout", type: "market", title: "Claude 一週大量更新摘要", content: "來源：Threads @darrell_tw_\n\n🔑 重點更新：\n• 支援記憶匯入\n• Cowork Scheduled Tasks\n• Code /remote-control\n• Code auto-memory\n\n💡 對能安家的啟發：\nScheduled Tasks 可用在每日太陽能發電報表自動整理", tags: ["技術趨勢", "AI工具"], aiSummary: "Claude 推出記憶匯入、定時任務、遠端控制等更新，可整合至太陽能業務。", businessValue: "高 — 可應用於能安家運營自動化。", actionItems: ["測試 Scheduled Tasks 生成發電報告", "評估 auto-memory 應用"], starred: true },
  { category: "areas", maturity: "tree", type: "note", title: "公司三層稅負架構", content: "來源：澄達稅務記帳士事務所\n\n① 營業稅 — 5%，每 2 個月申報\n② 營所稅 — 20%，每年 5 月申報\n③ 稅後分配：未分配盈餘稅 5% / 個人綜所稅 5%~40%\n\n⚠️ 重點：進銷項發票管理 + 盈餘分配策略", tags: ["財務規劃", "稅務"], aiSummary: "台灣公司三層稅負：營業稅5%、營所稅20%、盈餘稅5%或綜所稅5-40%。", businessValue: "核心 — 直接影響陽光花園稅務規劃。", actionItems: ["確認雙月營業稅申報", "討論盈餘分配策略"], starred: true },
  { category: "resources", maturity: "sprout", type: "thought", title: "銀行開戶三大注意", content: "■ 銀行選離家近的常往來銀行\n■ 401 報表銷項至少五位數\n■ 簽約文件自己看清楚", tags: ["創業經驗"], aiSummary: "銀行開戶三大實務要點。", businessValue: "中 — BNI 分享素材。", actionItems: ["整理成 BNI 簡報"], starred: false },
];

// ─── AI Engine ───
const parseJSON = (text, isArr) => {
  try {
    const s = text.indexOf(isArr ? "[" : "{");
    const e = text.lastIndexOf(isArr ? "]" : "}");
    return s > -1 && e > -1 ? JSON.parse(text.substring(s, e + 1)) : null;
  } catch { return null; }
};

const callAI = async (apiKey, provider, messages) => {
  if (!apiKey) return "";
  try {
    if (provider === "gemini") {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: messages[0].content }] }] })
      });
      const d = await r.json();
      return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages })
      });
      const d = await r.json();
      return d.content?.map(i => i.text || "").join("") || "";
    }
  } catch (e) { console.error("AI Error:", e); return ""; }
};

const aiSummarize = async (apiKey, provider, text, instruction) => {
  const prompt = `${instruction}\n\n內容：\n${text}\n\n用繁體中文回覆純JSON（不要markdown）：{"summary":"摘要","tags":["標籤"],"category":"inbox|projects|areas|resources","maturity":"seed|sprout|tree","actionItems":["行動"],"businessValue":"商業價值","suggestedTitle":"標題"}`;
  return parseJSON(await callAI(apiKey, provider, [{ role: "user", content: prompt }]));
};

const aiBatch = async (apiKey, provider, cards) => {
  const list = cards.map((c, i) => `[${i}] ${c.title}: ${(c.content || "").substring(0, 80)}`).join("\n");
  const prompt = `分析以下卡片，建議PARA分類與成熟度。\n\n${list}\n\n回覆純JSON陣列：[{"index":0,"category":"projects","maturity":"seed"}]`;
  return parseJSON(await callAI(apiKey, provider, [{ role: "user", content: prompt }]), true);
};

// ─── Helpers ───
const now = () => new Date().toISOString();
const fmt = (d) => { if (!d) return ""; const o = new Date(d); return `${o.getMonth() + 1}/${o.getDate()} ${String(o.getHours()).padStart(2, "0")}:${String(o.getMinutes()).padStart(2, "0")}`; };
const fDay = (d) => { if (!d) return ""; const o = new Date(d); return `${o.getFullYear()}/${o.getMonth() + 1}/${o.getDate()}`; };
const iMap = { Inbox, Target, Layers, Bookmark, Archive };
const gI = (n) => iMap[n] || Inbox;
const compress = (file) => new Promise(r => {
  const rd = new FileReader(); rd.onload = e => {
    const img = new window.Image(); img.onload = () => {
      const c = document.createElement("canvas");
      const s = Math.min(800 / img.width, 800 / img.height, 1);
      c.width = img.width * s; c.height = img.height * s;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      r(c.toDataURL("image/jpeg", 0.7));
    }; img.src = e.target.result;
  }; rd.readAsDataURL(file);
});
const readText = f => new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsText(f); });
const readB64 = f => new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(f); });

// ─── Toast ───
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  const bg = type === "success" ? "var(--green-bg)" : type === "error" ? "#FFF0F0" : "var(--gold-bg)";
  const bd = type === "success" ? "#B2E8C0" : type === "error" ? "#FFB0B0" : "var(--gold-bd)";
  const ic = type === "success" ? "var(--green)" : type === "error" ? "#CC3333" : "var(--gold)";
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 100, display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderRadius: 16, background: bg, border: `1px solid ${bd}`, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", animation: "slideIn 0.3s ease" }}>
      {type === "success" ? <CheckCircle2 size={18} color={ic} /> : type === "error" ? <AlertCircle size={18} color={ic} /> : <Sparkles size={18} color={ic} />}
      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--t1)" }}>{message}</span>
      <button onClick={onClose} style={{ background: 0, border: 0, cursor: "pointer", opacity: 0.4 }}><X size={14} /></button>
    </div>
  );
};

// ━━━ MAIN APP ━━━
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState([]);
  const [tags, setTags] = useState(DEFAULT_TAGS);
  const [tab, setTab] = useState("all");
  const [cap, setCap] = useState(false);
  const [det, setDet] = useState(null);
  const [q, setQ] = useState("");
  const [fT, setFT] = useState("all");
  const [fM, setFM] = useState("all");
  const [vw, setVw] = useState("grid");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [rev, setRev] = useState(false);
  const [showSt, setShowSt] = useState(false);
  const [dC, setDC] = useState(null);
  const [dO, setDO] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [aiKey, setAiKey] = useState("");
  const [aiProvider, setAiProvider] = useState("gemini");
  const [seeded, setSeeded] = useState(false);

  // Auth + Firestore listeners
  useEffect(() => {
    const unsub = initAuth((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub1 = fbListenCards((c) => {
      setCards(c);
      // Seed default cards if empty and first time
      if (c.length === 0 && !seeded) {
        setSeeded(true);
        SEED_CARDS.forEach(card => {
          fbAddCard({ ...card, createdAt: now(), updatedAt: now(), imageData: null, fileData: null, fileName: null, audioData: null });
        });
      }
    });
    const unsub2 = fbListenSettings((s) => {
      if (s.tags) setTags(s.tags);
      if (s.aiKey) setAiKey(s.aiKey);
      if (s.aiProvider) setAiProvider(s.aiProvider);
      if (s.seeded) setSeeded(true);
    });
    return () => { unsub1(); unsub2(); };
  }, [user]);

  const msg = (m, t = "info") => setToast({ message: m, type: t });

  const addCard = async (c) => {
    try {
      await fbAddCard({
        createdAt: now(), updatedAt: now(), category: "inbox", maturity: "seed",
        type: "thought", title: "", content: "", tags: [], imageData: null,
        fileData: null, fileName: null, audioData: null, aiSummary: null,
        businessValue: "", actionItems: [], starred: false, ...c
      });
      msg("已擷取到收件匣 ✓", "success");
    } catch (e) { msg("儲存失敗：" + e.message, "error"); }
  };

  const updCard = async (id, u) => {
    try { await fbUpdateCard(id, { ...u, updatedAt: now() }); } catch (e) { msg("更新失敗", "error"); }
  };

  const delCard = async (id) => {
    try { await fbDeleteCard(id); msg("已刪除", "success"); if (det?.id === id) setDet(null); } catch (e) { msg("刪除失敗", "error"); }
  };

  const movCard = async (id, cat) => {
    await updCard(id, { category: cat });
    msg(`已移至${PARA.find(c => c.id === cat)?.label}`, "success");
  };

  const runAI = async (card) => {
    if (!aiKey) { setShowSettings(true); msg("請先設定 AI API Key", "info"); return; }
    setBusy(true);
    const r = await aiSummarize(aiKey, aiProvider, `${card.title}\n${card.content}`, "分析此商業筆記。");
    setBusy(false);
    if (r) {
      await updCard(card.id, {
        aiSummary: r.summary,
        tags: [...new Set([...(card.tags || []), ...(r.tags || [])])],
        category: r.category || card.category,
        maturity: r.maturity || card.maturity,
        actionItems: r.actionItems || [],
        businessValue: r.businessValue || ""
      });
      msg("AI 分析完成", "success");
    } else msg("AI 分析失敗", "error");
  };

  const runAIBatch = async () => {
    if (!aiKey) { setShowSettings(true); msg("請先設定 AI API Key", "info"); return; }
    const inbox = cards.filter(c => c.category === "inbox");
    if (!inbox.length) return msg("收件匣為空", "info");
    setBusy(true);
    const res = await aiBatch(aiKey, aiProvider, inbox);
    setBusy(false);
    if (res) {
      for (const r of res) {
        if (inbox[r.index]) await updCard(inbox[r.index].id, { category: r.category, maturity: r.maturity });
      }
      msg(`已分類 ${res.length} 張`, "success");
    } else msg("分類失敗", "error");
  };

  const processFile = useCallback(async (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (file.type.startsWith("image/")) {
      addCard({ title: file.name.replace(/\.[^.]+$/, ""), type: "image", imageData: await compress(file), content: `📷 ${file.name}` });
    } else if (ext === "pdf") {
      addCard({ title: `📄 ${file.name}`, type: "pdf", fileData: await readB64(file), fileName: file.name, content: `PDF：${file.name}` });
    } else if (file.type.startsWith("audio/")) {
      addCard({ title: `🎙️ ${file.name}`, type: "audio", audioData: await readB64(file), fileName: file.name, content: `語音：${file.name}` });
    } else if (["txt", "md", "csv", "tsv", "json"].includes(ext)) {
      const t = await readText(file);
      addCard({ title: `📊 ${file.name}`, type: ext === "csv" || ext === "tsv" ? "csv" : "note", content: t.substring(0, 500), fileName: file.name });
    } else {
      addCard({ title: `📎 ${file.name}`, type: "note", content: `附件：${file.name}`, fileName: file.name });
    }
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault(); setDO(false);
    for (const f of Array.from(e.dataTransfer?.files || [])) await processFile(f);
  }, [processFile]);

  const saveAISettings = async () => {
    await fbSaveSettings({ aiKey, aiProvider, tags, seeded: true });
    setShowSettings(false);
    msg("設定已儲存", "success");
  };

  // Filter
  const filtered = cards.filter(c => {
    if (tab !== "all" && c.category !== tab) return false;
    if (fT !== "all" && c.type !== fT) return false;
    if (fM !== "all" && c.maturity !== fM) return false;
    if (q) {
      const l = q.toLowerCase();
      return c.title?.toLowerCase().includes(l) || c.content?.toLowerCase().includes(l) || c.tags?.some(t => t.toLowerCase().includes(l));
    }
    return true;
  });
  const st = {
    total: cards.length,
    inbox: cards.filter(c => c.category === "inbox").length,
    trees: cards.filter(c => c.maturity === "tree").length,
    today: cards.filter(c => fDay(c.createdAt) === fDay(now())).length
  };

  // Loading
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ width: 56, height: 56, borderRadius: 18, background: "linear-gradient(135deg, #C49B20, #9E7C1A)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Brain size={28} color="#FFF" className="animate-pulse" />
      </div>
      <p className="hd" style={{ color: "var(--gold)", fontSize: 14, letterSpacing: 2 }}>CONNECTING...</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh" }}
      onDragOver={e => { e.preventDefault(); setDO(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDO(false); }}
      onDrop={handleDrop}>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Drop overlay */}
      {dO && (
        <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(248,246,241,0.92)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", animation: "floatY 2s ease-in-out infinite" }}>
            <div style={{ width: 96, height: 96, borderRadius: 24, background: "linear-gradient(135deg, #C49B20, #9E7C1A)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 8px 30px rgba(158,124,26,0.2)" }}><Upload size={40} color="#FFF" /></div>
            <p className="hd" style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)" }}>放開即可上傳</p>
            <p style={{ fontSize: 15, color: "var(--t3)", marginTop: 8 }}>照片 · PDF · 語音 · CSV · 文字檔</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="pnl" style={{ position: "sticky", top: 0, zIndex: 40, padding: "14px 20px", borderTop: 0, borderLeft: 0, borderRight: 0, borderRadius: 0 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, background: "linear-gradient(135deg, #C49B20, #9E7C1A)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(158,124,26,0.15)" }}><Brain size={22} color="#FFF" /></div>
            <div>
              <h1 className="hd" style={{ fontSize: 20, fontWeight: 700, color: "var(--gold)", letterSpacing: 0.5, margin: 0 }}>SECOND BRAIN</h1>
              <p className="mn" style={{ fontSize: 11, color: "var(--t3)", letterSpacing: 2, margin: 0 }}>PARA · CODE · AI</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setShowSettings(true)} style={{ padding: 10, borderRadius: 12, background: "transparent", border: "1px solid transparent", cursor: "pointer" }}><Settings size={20} color="var(--t3)" /></button>
            <button onClick={() => setShowSt(!showSt)} style={{ padding: 10, borderRadius: 12, background: showSt ? "var(--gold-bg)" : "transparent", border: showSt ? "1px solid var(--gold-bd)" : "1px solid transparent", cursor: "pointer" }}><BarChart3 size={20} color={showSt ? "var(--gold)" : "var(--t3)"} /></button>
            <button onClick={() => setRev(true)} style={{ padding: 10, borderRadius: 12, background: "transparent", border: "1px solid transparent", cursor: "pointer", position: "relative" }}>
              <Sun size={20} color="var(--t3)" />
              {st.inbox > 0 && <span style={{ position: "absolute", top: 0, right: 0, width: 18, height: 18, borderRadius: "50%", background: "var(--green)", color: "#FFF", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{st.inbox > 9 ? "9+" : st.inbox}</span>}
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 20, padding: "20px 20px 130px" }}>
        {/* Sidebar */}
        <aside style={{ width: 235, flexShrink: 0 }}>
          <nav className="pnl" style={{ borderRadius: 20, padding: 10, position: "sticky", top: 80 }}>
            {showSt && (
              <div style={{ padding: 14, marginBottom: 8, borderRadius: 16, background: "var(--gold-bg)", border: "1px solid var(--gold-bd)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, textAlign: "center" }}>
                  <div><p className="hd" style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)", margin: 0 }}>{st.total}</p><p style={{ fontSize: 12, color: "var(--t3)", margin: 0 }}>總卡片</p></div>
                  <div><p className="hd" style={{ fontSize: 22, fontWeight: 700, color: "var(--green)", margin: 0 }}>{st.today}</p><p style={{ fontSize: 12, color: "var(--t3)", margin: 0 }}>今日</p></div>
                  <div><p className="hd" style={{ fontSize: 22, fontWeight: 700, color: "#15803D", margin: 0 }}>{st.trees}</p><p style={{ fontSize: 12, color: "var(--t3)", margin: 0 }}>常青樹</p></div>
                </div>
              </div>
            )}
            <SideBtn ac={tab === "all"} oc={() => setTab("all")} ic={<LayoutGrid size={18} />} lb="全部" ct={st.total} cl="var(--gold)" />
            <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />
            {PARA.map(c => {
              const I = gI(c.icon);
              const n = cards.filter(x => x.category === c.id).length;
              return <SideBtn key={c.id} ac={tab === c.id} oc={() => setTab(c.id)} ic={<I size={18} />} lb={c.label} sub={c.en} ct={n} cl={c.color}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = "var(--gold-bg)"; }}
                onDragLeave={e => { e.currentTarget.style.background = ""; }}
                onDrop={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.background = ""; if (dC) { movCard(dC, c.id); setDC(null); } }} />;
            })}
            <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />
            <button onClick={runAIBatch} disabled={busy || st.inbox === 0} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 14, fontSize: 14, color: "var(--gold)", background: "transparent", border: 0, cursor: "pointer", opacity: busy || st.inbox === 0 ? 0.35 : 1, fontFamily: "inherit" }}>
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
              <span style={{ fontWeight: 500 }}>AI 智能分類</span>
              {st.inbox > 0 && <span className="mn" style={{ marginLeft: "auto", fontSize: 12, padding: "2px 8px", borderRadius: 20, background: "var(--gold-bg)", border: "1px solid var(--gold-bd)" }}>{st.inbox}</span>}
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {/* Search bar */}
          <div className="pnl" style={{ borderRadius: 20, padding: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
                <Search size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--t3)" }} />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋卡片、標籤、內容..." className="inp" style={{ width: "100%", padding: "12px 14px 12px 42px", fontSize: 15 }} />
              </div>
              <select value={fT} onChange={e => setFT(e.target.value)} style={{ padding: "10px 14px", fontSize: 14 }}><option value="all">所有類型</option>{TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
              <select value={fM} onChange={e => setFM(e.target.value)} style={{ padding: "10px 14px", fontSize: 14 }}><option value="all">所有階段</option>{MATS.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}</select>
              <div style={{ display: "flex", gap: 3, padding: 3, background: "#F0EDE5", borderRadius: 12 }}>
                {["grid", "list"].map(v => <button key={v} onClick={() => setVw(v)} style={{ padding: 8, borderRadius: 10, background: vw === v ? "#FFF" : "transparent", border: vw === v ? "1px solid var(--border)" : "1px solid transparent", cursor: "pointer", boxShadow: vw === v ? "0 1px 3px rgba(0,0,0,0.04)" : "none" }}>{v === "grid" ? <LayoutGrid size={16} color={vw === v ? "var(--gold)" : "var(--t3)"} /> : <List size={16} color={vw === v ? "var(--gold)" : "var(--t3)"} />}</button>)}
              </div>
            </div>
          </div>

          {/* Cards */}
          {filtered.length === 0 ? (
            <div className="pnl" style={{ borderRadius: 20, padding: 50, textAlign: "center" }}>
              <div style={{ width: 68, height: 68, borderRadius: 20, background: "var(--gold-bg)", border: "1px solid var(--gold-bd)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}><Upload size={28} color="var(--gold)" /></div>
              <p style={{ fontSize: 18, fontWeight: 600, margin: "0 0 6px" }}>{q ? "找不到符合的卡片" : "此分類尚無卡片"}</p>
              <p style={{ fontSize: 15, color: "var(--t3)", margin: 0 }}>拖拉檔案或點底部按鈕上傳</p>
            </div>
          ) : vw === "grid" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 16 }}>
              {filtered.map((c, i) => <CardGrid key={c.id} c={c} i={i} oo={() => setDet(c)} os={() => updCard(c.id, { starred: !c.starred })} od={() => setDC(c.id)} oa={() => runAI(c)} busy={busy} />)}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((c, i) => <CardList key={c.id} c={c} i={i} oo={() => setDet(c)} os={() => updCard(c.id, { starred: !c.starred })} om={x => movCard(c.id, x)} />)}
            </div>
          )}
        </main>
      </div>

      {/* FAB */}
      {!cap && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 50, display: "flex", alignItems: "center", gap: 10 }}>
          <QuickBtn ic={<Camera size={18} />} lb="拍照" ac="image/*" of={processFile} />
          <QuickBtn ic={<FileText size={18} />} lb="PDF" ac=".pdf" of={processFile} />
          <button onClick={() => setCap(true)} style={{ width: 62, height: 62, borderRadius: "50%", background: "linear-gradient(135deg, #C49B20, #9E7C1A)", display: "flex", alignItems: "center", justifyContent: "center", border: 0, cursor: "pointer", animation: "fabPulse 2.5s ease-in-out infinite" }}>
            <Plus size={28} strokeWidth={2.5} color="#FFF" />
          </button>
          <QuickBtn ic={<Mic size={18} />} lb="語音" ac="audio/*" of={processFile} />
          <QuickBtn ic={<FileSpreadsheet size={18} />} lb="檔案" ac=".csv,.tsv,.txt,.md,.json" of={processFile} />
        </div>
      )}

      {/* Modals */}
      {cap && <CaptureModal tags={tags} oc={() => setCap(false)} os={c => { addCard(c); setCap(false); }} of={processFile}
        ai={async t => { if (!aiKey) { setShowSettings(true); return null; } setBusy(true); const r = await aiSummarize(aiKey, aiProvider, t, "分析此輸入。"); setBusy(false); return r; }} busy={busy} />}
      {det && <DetailModal c={det} oc={() => setDet(null)}
        ou={u => { updCard(det.id, u); setDet(p => ({ ...p, ...u })); }}
        od={() => delCard(det.id)}
        om={x => { movCard(det.id, x); setDet(p => ({ ...p, category: x })); }}
        oa={() => runAI(det)} busy={busy} />}
      {rev && <ReviewModal cards={cards} oc={() => setRev(false)} om={movCard} ou={updCard} />}
      {showSettings && <SettingsModal aiKey={aiKey} setAiKey={setAiKey} aiProvider={aiProvider} setAiProvider={setAiProvider} onSave={saveAISettings} oc={() => setShowSettings(false)} />}
    </div>
  );
}

// ─── Sub Components ───

function SideBtn({ ac, oc, ic, lb, sub, ct, cl, ...r }) {
  return <button onClick={oc} {...r} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 14, fontSize: 14, textAlign: "left", background: ac ? "var(--gold-bg)" : "transparent", border: ac ? "1px solid var(--gold-bd)" : "1px solid transparent", cursor: "pointer", color: ac ? "var(--t1)" : "var(--t3)", fontWeight: ac ? 500 : 400, fontFamily: "inherit" }}>
    <span style={{ color: ac ? cl : "#B0A898" }}>{ic}</span><span>{lb}</span>
    {sub && <span className="mn" style={{ fontSize: 10, letterSpacing: 1.5, color: "#C8C0B0" }}>{sub}</span>}
    {ct > 0 && <span className="mn" style={{ marginLeft: "auto", fontSize: 12, padding: "2px 8px", borderRadius: 20, background: ac ? `${cl}12` : "#F0EDE5", color: cl }}>{ct}</span>}
  </button>;
}

function QuickBtn({ ic, lb, ac, of }) {
  const ref = useRef(null);
  return <button onClick={() => ref.current?.click()} style={{ width: 46, height: 46, borderRadius: "50%", background: "#FFF", border: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
    <input ref={ref} type="file" accept={ac} multiple style={{ display: "none" }} onChange={async e => { for (const f of Array.from(e.target.files || [])) await of(f); e.target.value = ""; }} />
    <span style={{ color: "var(--gold)" }}>{ic}</span>
    <span style={{ fontSize: 8, color: "var(--t3)", marginTop: 1 }}>{lb}</span>
  </button>;
}

function CardGrid({ c, i, oo, os, od, oa, busy }) {
  const m = MATS.find(s => s.id === c.maturity), t = TYPES.find(x => x.id === c.type), p = PARA.find(x => x.id === c.category);
  return (
    <div draggable onDragStart={od} className="ce crd" style={{ padding: 20, cursor: "pointer", animationDelay: `${i * 40}ms` }} onClick={oo}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: p?.color }} /><span className="mn" style={{ fontSize: 11, letterSpacing: 1, color: "var(--t3)" }}>{p?.en}</span></div>
        <div style={{ display: "flex", gap: 2 }}>
          <button onClick={e => { e.stopPropagation(); os(); }} style={{ padding: 5, background: 0, border: 0, cursor: "pointer", color: c.starred ? "var(--gold)" : "#D0C8B8" }}><Star size={15} fill={c.starred ? "currentColor" : "none"} /></button>
          <button onClick={e => { e.stopPropagation(); oa(); }} disabled={busy} style={{ padding: 5, background: 0, border: 0, cursor: "pointer", color: "var(--gold)", opacity: busy ? 0.3 : 1 }}><Sparkles size={15} /></button>
        </div>
      </div>
      {c.imageData && <div style={{ margin: "0 -4px 12px", borderRadius: 14, overflow: "hidden", height: 128 }}><img src={c.imageData} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}
      <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--t1)", marginBottom: 4, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.title || "無標題"}</h3>
      {c.content && <p style={{ fontSize: 14, color: "var(--t2)", lineHeight: 1.7, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.content}</p>}
      {c.aiSummary && <div style={{ padding: 10, borderRadius: 12, background: "var(--gold-bg)", border: "1px solid var(--gold-bd)", marginBottom: 10 }}><p style={{ fontSize: 13, color: "#78600A", lineHeight: 1.6, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}><Bot size={12} style={{ display: "inline", verticalAlign: -2, marginRight: 5 }} />{c.aiSummary}</p></div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 15 }}>{m?.emoji}</span>{t && <span style={{ fontSize: 12, padding: "3px 9px", borderRadius: 8, background: `${t.color}0D`, color: t.color }}>{t.label.split(" ")[0]}</span>}</div>
        <span className="mn" style={{ fontSize: 11, color: "var(--t3)" }}>{fmt(c.createdAt)}</span>
      </div>
      {c.tags?.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
        {c.tags.slice(0, 3).map(t => <span key={t} style={{ fontSize: 12, padding: "3px 9px", borderRadius: 8, background: "#F0EDE5", color: "var(--t2)" }}>#{t}</span>)}
        {c.tags.length > 3 && <span style={{ fontSize: 12, color: "var(--t3)" }}>+{c.tags.length - 3}</span>}
      </div>}
    </div>
  );
}

function CardList({ c, i, oo, os, om }) {
  const m = MATS.find(s => s.id === c.maturity), p = PARA.find(x => x.id === c.category);
  return <div className="ce crd" style={{ borderRadius: 14, padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, animationDelay: `${i * 25}ms` }} onClick={oo}>
    <button onClick={e => { e.stopPropagation(); os(); }} style={{ background: 0, border: 0, cursor: "pointer", color: c.starred ? "var(--gold)" : "#D0C8B8", flexShrink: 0 }}><Star size={15} fill={c.starred ? "currentColor" : "none"} /></button>
    <span style={{ fontSize: 15 }}>{m?.emoji}</span>
    <span style={{ width: 9, height: 9, borderRadius: "50%", background: p?.color, flexShrink: 0 }} />
    <h3 style={{ fontSize: 15, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{c.title || "無標題"}</h3>
    <span className="mn" style={{ fontSize: 11, color: "var(--t3)", flexShrink: 0 }}>{fmt(c.createdAt)}</span>
    <select onClick={e => e.stopPropagation()} onChange={e => om(e.target.value)} value={c.category} style={{ fontSize: 12, padding: "3px 6px" }}>{PARA.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
  </div>;
}

function CaptureModal({ tags, oc, os, of, ai, busy }) {
  const [ti, sTi] = useState(""), [co, sCo] = useState(""), [tp, sTp] = useState("thought"), [tg, sTg] = useState([]), [im, sIm] = useState(null), [ct, sCt] = useState(""), [dr, sDr] = useState(false);
  const ref = useRef(null);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={oc}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.2)", backdropFilter: "blur(4px)" }} />
      <div className="me pnl ms" style={{ position: "relative", width: "100%", maxWidth: 520, maxHeight: "90vh", borderRadius: "24px 24px 0 0", padding: 24, overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 12, background: "linear-gradient(135deg, #C49B20, #9E7C1A)", display: "flex", alignItems: "center", justifyContent: "center" }}><Zap size={16} color="#FFF" /></div>
            <h2 className="hd" style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)", margin: 0 }}>CAPTURE</h2>
          </div>
          <button onClick={oc} style={{ padding: 6, background: 0, border: 0, cursor: "pointer" }}><X size={20} color="var(--t3)" /></button>
        </div>
        <div style={{ marginBottom: 18, border: `2px dashed ${dr ? "var(--gold)" : "var(--border)"}`, borderRadius: 18, background: dr ? "var(--gold-bg)" : "transparent", cursor: "pointer", transition: "0.2s" }}
          onDragOver={e => { e.preventDefault(); sDr(true); }} onDragLeave={() => sDr(false)}
          onDrop={e => { e.preventDefault(); sDr(false); Array.from(e.dataTransfer.files).forEach(async f => { if (f.type.startsWith("image/") && !im) { sIm(await compress(f)); sTp("image"); if (!ti) sTi(f.name.replace(/\.[^.]+$/, "")); } else await of(f); }); }}
          onClick={() => ref.current?.click()}>
          <input ref={ref} type="file" accept="image/*,.pdf,audio/*,.csv,.tsv,.txt,.md,.json" multiple style={{ display: "none" }} onChange={e => Array.from(e.target.files || []).forEach(async f => { if (f.type.startsWith("image/") && !im) { sIm(await compress(f)); sTp("image"); if (!ti) sTi(f.name.replace(/\.[^.]+$/, "")); } else await of(f); })} />
          {im ? <div style={{ position: "relative" }}><img src={im} alt="" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 16 }} /><button onClick={e => { e.stopPropagation(); sIm(null); }} style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={12} color="#FFF" /></button></div>
          : <div style={{ padding: "28px 0", textAlign: "center" }}>
              <div style={{ width: 50, height: 50, borderRadius: 16, background: "var(--gold-bg)", border: "1px solid var(--gold-bd)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}><Upload size={22} color="var(--gold)" /></div>
              <p style={{ fontSize: 15, fontWeight: 500, margin: "0 0 4px" }}>拖拉或點擊上傳</p>
              <p style={{ fontSize: 13, color: "var(--t3)", margin: 0 }}>📷照片 📄PDF 🎙️語音 📊CSV 📝文字</p>
            </div>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>{TYPES.slice(0, 6).map(t => <button key={t.id} onClick={() => sTp(t.id)} style={{ fontSize: 13, padding: "7px 12px", borderRadius: 10, background: tp === t.id ? `${t.color}0D` : "transparent", color: tp === t.id ? t.color : "var(--t3)", border: tp === t.id ? `1px solid ${t.color}25` : "1px solid transparent", cursor: "pointer", fontFamily: "inherit" }}>{t.label}</button>)}</div>
        <input value={ti} onChange={e => sTi(e.target.value)} placeholder="標題" className="inp" style={{ width: "100%", padding: "11px 14px", fontSize: 15, marginBottom: 8 }} />
        <textarea value={co} onChange={e => sCo(e.target.value)} placeholder="靈感、觀察、筆記..." rows={3} className="inp" style={{ width: "100%", padding: "11px 14px", fontSize: 15, marginBottom: 12, resize: "none" }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {tags.map(t => <button key={t} onClick={() => sTg(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])} style={{ fontSize: 13, padding: "5px 10px", borderRadius: 10, background: tg.includes(t) ? "var(--gold-bg)" : "var(--cream)", color: tg.includes(t) ? "var(--gold)" : "var(--t3)", border: `1px solid ${tg.includes(t) ? "var(--gold-bd)" : "var(--border)"}`, cursor: "pointer", fontFamily: "inherit" }}>#{t}</button>)}
          <input value={ct} onChange={e => sCt(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && ct.trim()) { sTg(p => [...new Set([...p, ct.trim()])]); sCt(""); } }} placeholder="+標籤" className="inp" style={{ width: 70, padding: "5px 10px", fontSize: 13 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <button onClick={async () => { const t = `${ti}\n${co}`; if (!t.trim()) return; const r = await ai(t); if (r) { if (r.tags) sTg(p => [...new Set([...p, ...r.tags])]); if (r.summary && !co) sCo(r.summary); if (r.suggestedTitle && !ti) sTi(r.suggestedTitle); } }} disabled={busy || (!ti.trim() && !co.trim())} className="btn-o" style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", fontSize: 14, fontFamily: "inherit", opacity: busy || (!ti.trim() && !co.trim()) ? 0.35 : 1 }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} AI 分析
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={() => { if (!ti.trim() && !co.trim() && !im) return; os({ title: ti || (co ? co.substring(0, 40) + "..." : "新卡片"), content: co, type: im ? "image" : tp, tags: tg, imageData: im }); }} disabled={!ti.trim() && !co.trim() && !im} className="btn-g" style={{ padding: "12px 22px", fontSize: 15, fontFamily: "inherit" }}>儲存到收件匣</button>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ c, oc, ou, od, om, oa, busy }) {
  const [ed, sEd] = useState(false), [ti, sTi] = useState(c.title), [co, sCo] = useState(c.content);
  const cat = PARA.find(x => x.id === c.category), mat = MATS.find(s => s.id === c.maturity);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={oc}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.2)", backdropFilter: "blur(4px)" }} />
      <div className="me pnl" style={{ position: "relative", width: "100%", maxWidth: 680, maxHeight: "90vh", borderRadius: "24px 24px 0 0", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={{ flexShrink: 0, padding: "14px 22px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <button onClick={oc} className="btn-o" style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", fontSize: 14, fontFamily: "inherit" }}><ArrowLeft size={16} /> 返回</button>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => sEd(!ed)} style={{ padding: 9, background: 0, border: 0, cursor: "pointer" }}><Edit3 size={17} color="var(--t3)" /></button>
              <button onClick={oa} disabled={busy} style={{ padding: 9, background: 0, border: 0, cursor: "pointer", opacity: busy ? 0.3 : 1 }}>{busy ? <Loader2 size={17} className="animate-spin" color="var(--gold)" /> : <Sparkles size={17} color="var(--gold)" />}</button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: cat?.color }} /><span style={{ fontSize: 14, color: "var(--t2)" }}>{cat?.label}</span><span style={{ color: "#D0C8B8" }}>·</span><span style={{ fontSize: 15 }}>{mat?.emoji}</span><span style={{ fontSize: 14, color: "var(--t2)" }}>{mat?.label}</span></div>
        </div>
        <div className="ms" style={{ flex: 1, minHeight: 0, padding: 22, overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {c.imageData && <div style={{ borderRadius: 16, overflow: "hidden" }}><img src={c.imageData} alt="" style={{ width: "100%", maxHeight: 240, objectFit: "cover" }} /></div>}
            {c.type === "audio" && c.audioData && <div style={{ padding: 14, borderRadius: 16, background: "#FFF7ED", border: "1px solid #FED7AA" }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><Volume2 size={16} color="#EA580C" /><span style={{ fontSize: 14, color: "#EA580C" }}>{c.fileName}</span></div><audio controls src={c.audioData} style={{ width: "100%", height: 36 }} /></div>}
            {c.type === "pdf" && <div style={{ padding: 14, borderRadius: 16, background: "#FEF2F2", border: "1px solid #FECACA", display: "flex", alignItems: "center", gap: 10 }}><FileText size={22} color="#DC2626" /><span style={{ fontSize: 14, color: "#DC2626" }}>{c.fileName}</span></div>}
            {ed ? <>
              <input value={ti} onChange={e => sTi(e.target.value)} style={{ width: "100%", fontSize: 21, fontWeight: 700, background: "transparent", border: 0, borderBottom: "2px solid var(--gold-bd)", paddingBottom: 8, color: "var(--t1)", outline: "none", fontFamily: "inherit" }} />
              <textarea value={co} onChange={e => sCo(e.target.value)} rows={8} className="inp" style={{ width: "100%", padding: 12, fontSize: 15, resize: "none" }} />
              <div style={{ display: "flex", gap: 8 }}><button onClick={() => { ou({ title: ti, content: co }); sEd(false); }} className="btn-g" style={{ padding: "9px 18px", fontSize: 14, fontFamily: "inherit" }}>儲存</button><button onClick={() => sEd(false)} className="btn-o" style={{ padding: "9px 18px", fontSize: 14, fontFamily: "inherit" }}>取消</button></div>
            </> : <>
              <h2 style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.5, margin: 0 }}>{c.title || "無標題"}</h2>
              {c.content && <p style={{ fontSize: 16, color: "var(--t2)", lineHeight: 2, whiteSpace: "pre-wrap", margin: 0 }}>{c.content}</p>}
            </>}
            {c.aiSummary && (
              <div style={{ padding: 20, borderRadius: 18, background: "var(--gold-bg)", border: "1px solid var(--gold-bd)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><Bot size={16} color="var(--gold)" /><span style={{ fontSize: 15, fontWeight: 700, color: "var(--gold)" }}>AI 分析</span></div>
                <p style={{ fontSize: 15, lineHeight: 1.8, margin: 0 }}>{c.aiSummary}</p>
                {c.businessValue && <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--gold-bd)" }}><span className="mn" style={{ fontSize: 11, letterSpacing: 2, color: "var(--t3)" }}>BUSINESS VALUE</span><p style={{ fontSize: 14, color: "var(--t2)", marginTop: 4, lineHeight: 1.7 }}>{c.businessValue}</p></div>}
                {c.actionItems?.length > 0 && <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--gold-bd)" }}><span className="mn" style={{ fontSize: 11, letterSpacing: 2, color: "var(--t3)" }}>ACTION ITEMS</span>{c.actionItems.map((it, i) => <p key={i} style={{ fontSize: 14, color: "var(--t2)", display: "flex", alignItems: "center", gap: 8, marginTop: 8, lineHeight: 1.7 }}><ArrowRight size={14} color="var(--green)" />{it}</p>)}</div>}
              </div>
            )}
            {c.tags?.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{c.tags.map(t => <span key={t} style={{ fontSize: 13, padding: "5px 12px", borderRadius: 10, background: "var(--gold-bg)", color: "var(--gold)", border: "1px solid var(--gold-bd)" }}>#{t}</span>)}</div>}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", gap: 6 }}>{MATS.map(s => <button key={s.id} onClick={() => ou({ maturity: s.id })} style={{ fontSize: 14, padding: "7px 12px", borderRadius: 10, background: c.maturity === s.id ? `${s.color}0D` : "transparent", color: c.maturity === s.id ? s.color : "var(--t3)", border: c.maturity === s.id ? `1px solid ${s.color}25` : "1px solid transparent", cursor: "pointer", fontFamily: "inherit" }}>{s.emoji} {s.label}</button>)}</div>
              <div style={{ flex: 1 }} />
              <select value={c.category} onChange={e => om(e.target.value)} style={{ fontSize: 13, padding: "6px 10px" }}>{PARA.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
              <button onClick={od} style={{ padding: 8, background: 0, border: 0, cursor: "pointer" }}><Trash2 size={16} color="var(--t3)" /></button>
            </div>
            <p className="mn" style={{ fontSize: 11, color: "#C8C0B0", margin: 0 }}>CREATED {fmt(c.createdAt)} · UPDATED {fmt(c.updatedAt)}</p>
            <button onClick={oc} className="btn-o" style={{ width: "100%", padding: 14, fontSize: 15, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}><ArrowLeft size={16} /> 返回主頁面</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewModal({ cards, oc, om, ou }) {
  const [s, sS] = useState(0);
  const ib = cards.filter(c => c.category === "inbox"), sd = cards.filter(c => c.maturity === "seed" && c.category !== "archives"), td = cards.filter(c => fDay(c.createdAt) === fDay(now()));
  const steps = [{ t: "📥 清空收件匣", d: `${ib.length} 張待分類`, c: ib }, { t: "🌱 培育種子", d: `${sd.length} 個待評估`, c: sd }, { t: "📊 今日總結", d: `新增 ${td.length} 張`, c: td }];
  const cur = steps[s];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={oc}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.2)", backdropFilter: "blur(4px)" }} />
      <div className="me pnl" style={{ position: "relative", width: "100%", maxWidth: 520, maxHeight: "85vh", borderRadius: 24, overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={{ flexShrink: 0, padding: "18px 22px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Sun size={20} color="var(--gold)" /><h2 className="hd" style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)", margin: 0 }}>DAILY REVIEW</h2></div>
            <button onClick={oc} style={{ padding: 6, background: 0, border: 0, cursor: "pointer" }}><X size={20} color="var(--t3)" /></button>
          </div>
          <div style={{ display: "flex", gap: 6 }}>{steps.map((_, i) => <div key={i} style={{ flex: 1, height: 5, borderRadius: 5, background: i <= s ? "var(--gold)" : "var(--border)" }} />)}</div>
        </div>
        <div className="ms" style={{ flex: 1, minHeight: 0, padding: 22, overflowY: "auto" }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>{cur.t}</h3>
          <p style={{ fontSize: 14, color: "var(--t3)", margin: "0 0 18px" }}>{cur.d}</p>
          {cur.c.length === 0 ? <div style={{ textAlign: "center", padding: "36px 0" }}><CheckCircle2 size={32} color="var(--green)" style={{ margin: "0 auto 8px", display: "block" }} /><p style={{ fontSize: 14, color: "var(--t3)", margin: 0 }}>全部完成！</p></div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{cur.c.slice(0, 10).map(card => (
              <div key={card.id} className="crd" style={{ borderRadius: 14, padding: 12, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 15, marginTop: 2 }}>{MATS.find(x => x.id === card.maturity)?.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}><h4 style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{card.title || "無標題"}</h4>{card.content && <p style={{ fontSize: 13, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: "2px 0 0" }}>{card.content}</p>}</div>
                {s === 0 && <select onChange={e => om(card.id, e.target.value)} value={card.category} style={{ fontSize: 12, padding: "3px 6px", flexShrink: 0 }}>{PARA.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select>}
                {s === 1 && <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>{MATS.map(x => <button key={x.id} onClick={() => ou(card.id, { maturity: x.id })} style={{ fontSize: 13, padding: 5, borderRadius: 6, background: card.maturity === x.id ? "var(--gold-bg)" : "transparent", border: 0, cursor: "pointer", opacity: card.maturity === x.id ? 1 : 0.35 }}>{x.emoji}</button>)}</div>}
              </div>
            ))}</div>}
        </div>
        <div style={{ flexShrink: 0, padding: "12px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
          <button onClick={() => s > 0 && sS(s - 1)} disabled={s === 0} style={{ padding: "9px 14px", fontSize: 14, color: "var(--t3)", background: 0, border: 0, cursor: "pointer", opacity: s === 0 ? 0.3 : 1, fontFamily: "inherit" }}>上一步</button>
          {s < 2 ? <button onClick={() => sS(s + 1)} className="btn-g" style={{ padding: "9px 20px", fontSize: 14, fontFamily: "inherit" }}>下一步 →</button>
          : <button onClick={oc} style={{ padding: "9px 20px", borderRadius: 14, fontSize: 14, border: 0, cursor: "pointer", background: "linear-gradient(135deg, #4ADE80, #16A34A)", color: "#FFF", fontWeight: 600, fontFamily: "inherit" }}>✓ 完成</button>}
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ aiKey, setAiKey, aiProvider, setAiProvider, onSave, oc }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={oc}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.2)", backdropFilter: "blur(4px)" }} />
      <div className="me pnl" style={{ position: "relative", width: "100%", maxWidth: 440, borderRadius: 24, padding: 28 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Settings size={20} color="var(--gold)" /><h2 className="hd" style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)", margin: 0 }}>設定</h2></div>
          <button onClick={oc} style={{ padding: 6, background: 0, border: 0, cursor: "pointer" }}><X size={20} color="var(--t3)" /></button>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 8, color: "var(--t1)" }}>AI 提供者</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ id: "gemini", label: "🤖 Gemini（免費）" }, { id: "claude", label: "🧠 Claude" }].map(p => (
              <button key={p.id} onClick={() => setAiProvider(p.id)} style={{ flex: 1, padding: "10px 14px", borderRadius: 12, fontSize: 14, background: aiProvider === p.id ? "var(--gold-bg)" : "transparent", color: aiProvider === p.id ? "var(--gold)" : "var(--t3)", border: `1px solid ${aiProvider === p.id ? "var(--gold-bd)" : "var(--border)"}`, cursor: "pointer", fontFamily: "inherit" }}>{p.label}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 8, color: "var(--t1)" }}>
            <Key size={14} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
            {aiProvider === "gemini" ? "Gemini API Key" : "Claude API Key"}
          </label>
          <input value={aiKey} onChange={e => setAiKey(e.target.value)} type="password" placeholder={aiProvider === "gemini" ? "AIzaSy..." : "sk-ant-..."} className="inp" style={{ width: "100%", padding: "11px 14px", fontSize: 14 }} />
          <p style={{ fontSize: 12, color: "var(--t3)", marginTop: 6 }}>
            {aiProvider === "gemini"
              ? "到 aistudio.google.com 取得免費 API Key"
              : "到 console.anthropic.com 取得 API Key"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={oc} className="btn-o" style={{ flex: 1, padding: "11px 0", fontSize: 14, fontFamily: "inherit" }}>取消</button>
          <button onClick={onSave} className="btn-g" style={{ flex: 1, padding: "11px 0", fontSize: 14, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Save size={15} /> 儲存設定</button>
        </div>
      </div>
    </div>
  );
}
