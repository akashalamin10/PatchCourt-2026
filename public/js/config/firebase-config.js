import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
 apiKey: "AIzaSyA7qqN9lPQzMzL35_KakU8w2pBXpdTckac",
  authDomain: "patchcourt2026.firebaseapp.com",
  projectId: "patchcourt2026",
  storageBucket: "patchcourt2026.firebasestorage.app",
  messagingSenderId: "838555794001",
  appId: "1:838555794001:web:e471fc3128a072c3af9670",
  measurementId: "G-3JHT3SPSBX"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
