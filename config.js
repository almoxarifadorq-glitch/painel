import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDQN3RdSK05sT0KRZTvmGb6z8IoGnOLzDU",
  authDomain: "almoxarifado-d85db.firebaseapp.com",
  projectId: "almoxarifado-d85db",
  storageBucket: "almoxarifado-d85db.firebasestorage.app",
  messagingSenderId: "145159728974",
  appId: "1:145159728974:web:8bf56b75c645309544b81f"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);