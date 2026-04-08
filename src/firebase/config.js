import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBG1ycNVPH-7HxLKpZYBoyM0bPhXserj5s",
  authDomain: "familychecklistapp.firebaseapp.com",
  projectId: "familychecklistapp",
  storageBucket: "familychecklistapp.firebasestorage.app",
  messagingSenderId: "981006432088",
  appId: "1:981006432088:web:26937bb792dff1aa71972d",

  // OLD (quota exceeded):
  // apiKey: "AIzaSyBqjiQuBJ8eMuriILRu2s8k8NqtZia8oB4",
  // authDomain: "famp-7d1ea.firebaseapp.com",
  // projectId: "famp-7d1ea",
  // storageBucket: "famp-7d1ea.firebasestorage.app",
  // messagingSenderId: "876589391933",
  // appId: "1:876589391933:web:2b7413bcc7b5bd7d2c0a54",
  // measurementId: "G-JZ2N5GZXNY",
};

const app = initializeApp(firebaseConfig);
export { app };
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
