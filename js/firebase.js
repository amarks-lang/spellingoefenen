// Eén plek waar Firebase wordt geladen (via de CDN, geen build-stap nodig).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getDatabase, ref, child, get, set, update, push, remove, onValue,
  query, orderByChild, equalTo, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { firebaseConfig } from './config.js';

export const configOk = Object.values(firebaseConfig).every(w => w && !String(w).startsWith('VUL_IN'));

export const app = configOk ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getDatabase(app) : null;

export {
  signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut,
  ref, child, get, set, update, push, remove, onValue, query, orderByChild, equalTo, serverTimestamp
};
