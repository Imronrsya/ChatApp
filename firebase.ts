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
  updateDoc,
  doc,
} from "firebase/firestore";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile
} from "firebase/auth";

// Konfigurasi Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBQRziRtSa5h6KlkIUOKLKU0mfAqTGZPl8",
  authDomain: "chatapp-8d2fb.firebaseapp.com",
  projectId: "chatapp-8d2fb",
  storageBucket: "chatapp-8d2fb.firebasestorage.app",
  messagingSenderId: "789167653756",
  appId: "1:789167653756:web:e04bb316b0ecca2d47daf9",
  measurementId: "G-HZDMVCLH3Q"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);

// Siapkan Auth dan Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);

// Referensi koleksi messages
export const messagesCollection = collection(db, "messages") as CollectionReference<DocumentData>;

// Ekspor fungsi-fungsi yang digunakan di aplikasi
export {
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
  updateProfile,
  updateDoc,
  doc,
};