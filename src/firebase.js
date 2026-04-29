import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCAUbRYI5ji2uNVhAz0b9a1pCdicItwbEQ",
  authDomain: "portfolio-ec9ef.firebaseapp.com",
  projectId: "portfolio-ec9ef",
  storageBucket: "portfolio-ec9ef.firebasestorage.app",
  messagingSenderId: "751548018498",
  appId: "1:751548018498:web:e9281f7c1c8f91ed81e2db",
  measurementId: "G-NPJS06MWB0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
