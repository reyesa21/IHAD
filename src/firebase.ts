import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBDwBn1HQ5INhfu03YWSWYUFzsAx-_D1f0",
  authDomain: "ihad-3d9b1.firebaseapp.com",
  databaseURL: "https://ihad-3d9b1-default-rtdb.firebaseio.com",
  projectId: "ihad-3d9b1",
  storageBucket: "ihad-3d9b1.firebasestorage.app",
  messagingSenderId: "657800253176",
  appId: "1:657800253176:web:d8d2f0227812cb1770750d",
  measurementId: "G-9E0VSWKJ9P"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
