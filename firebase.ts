import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  CollectionReference,
  DocumentData,
} from "firebase/firestore";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile // Tambahan untuk update nama user
} from "firebase/auth";

// --- KONFIGURASI FIREBASE ANDA ---
const firebaseConfig = {
  apiKey: "AIzaSyBQRziRtSa5h6KlkIUOKLKU0mfAqTGZPl8",
  authDomain: "chatapp-8d2fb.firebaseapp.com",
  projectId: "chatapp-8d2fb",
  storageBucket: "chatapp-8d2fb.firebasestorage.app",
  messagingSenderId: "789167653756",
  appId: "1:789167653756:web:e04bb316b0ecca2d47daf9",
  measurementId: "G-HZDMVCLH3Q"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Referensi ke tabel 'messages'
const messagesCollection = collection(db, "messages") as CollectionReference<DocumentData>;

export {
  auth,
  db,
  messagesCollection, // Export variabel ini biar gampang dipanggil
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  signInAnonymously,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile
};