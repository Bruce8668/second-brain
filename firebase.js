import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore, collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, setDoc, serverTimestamp
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDEeDi7Z0YxzB4rOc7kvcegrhmAxASZAT4",
  authDomain: "my-ai-business-card.firebaseapp.com",
  projectId: "my-ai-business-card",
  storageBucket: "my-ai-business-card.firebasestorage.app",
  messagingSenderId: "1078044641136",
  appId: "1:1078044641136:web:80bdb97164ff06059f71b5",
  measurementId: "G-BR7MKYSBPY"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Fixed admin ID — anonymous auth might generate different UIDs
const ADMIN_ID = "bruce_admin";
const APP_ID = "second-brain";

// Collection references
export const cardsRef = () => collection(db, "artifacts", APP_ID, "users", ADMIN_ID, "cards");
export const settingsRef = () => doc(db, "artifacts", APP_ID, "users", ADMIN_ID, "settings", "main");

// Auth helper
export const initAuth = (onReady) => {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      onReady(user);
    } else {
      signInAnonymously(auth).catch(console.error);
    }
  });
};

// Firestore CRUD
export const fbAddCard = async (card) => {
  const ref = await addDoc(cardsRef(), { ...card, _created: serverTimestamp() });
  return ref.id;
};

export const fbUpdateCard = async (id, updates) => {
  await updateDoc(doc(cardsRef(), id), { ...updates, _updated: serverTimestamp() });
};

export const fbDeleteCard = async (id) => {
  await deleteDoc(doc(cardsRef(), id));
};

export const fbSaveSettings = async (settings) => {
  await setDoc(settingsRef(), settings, { merge: true });
};

export const fbListenCards = (callback) => {
  const q = query(cardsRef(), orderBy("_created", "desc"));
  return onSnapshot(q, (snap) => {
    const cards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(cards);
  });
};

export const fbListenSettings = (callback) => {
  return onSnapshot(settingsRef(), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
};

export { onSnapshot, query, orderBy, getDocs, serverTimestamp };
