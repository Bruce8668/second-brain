# 🧠 Second Brain — 部署指南

## 架構
- **前端**: React + Vite + Tailwind CSS
- **資料庫**: Firebase Firestore（雲端即時同步）
- **身分驗證**: Firebase Auth（匿名登入）
- **AI**: 支援 Gemini（免費）或 Claude API

---

## 部署到 Zeabur（最簡單）

### 步驟 1：上傳到 GitHub
```bash
# 在專案資料夾中
git init
git add .
git commit -m "Second Brain v1.0"
# 到 GitHub 建立新 repo，然後
git remote add origin https://github.com/你的帳號/second-brain.git
git push -u origin main
```

### 步驟 2：在 Zeabur 部署
1. 登入 [zeabur.com](https://zeabur.com)
2. 新增專案 → Deploy Service → 選 GitHub repo
3. Zeabur 會自動偵測 Vite 專案並部署
4. 綁定網域（免費的 `.zeabur.app` 或自訂域名）

### 步驟 3：Firebase 安全規則
部署後，到 Firebase Console → Firestore → 規則，貼上：
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/users/{userId}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 部署到 Vercel（替代方案）
```bash
npm install -g vercel
vercel
```

---

## 首次使用設定

1. 打開部署好的網站
2. 點右上角 ⚙️ 設定
3. 選擇 AI 提供者：
   - **Gemini（推薦）**: 免費，到 [aistudio.google.com](https://aistudio.google.com) 取得 API Key
   - **Claude**: 到 [console.anthropic.com](https://console.anthropic.com) 取得 API Key
4. 貼上 API Key → 儲存
5. 開始使用！

---

## 本地開發
```bash
npm install
npm run dev
# 打開 http://localhost:5173
```

---

## Firebase 需要開啟的服務
- [x] Firestore Database（測試模式，asia-east1）
- [x] Authentication → 匿名登入
