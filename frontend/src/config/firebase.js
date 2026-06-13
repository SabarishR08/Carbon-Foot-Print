import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

let app = null;
let auth = null;
let googleProvider = null;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || import.meta.env.VITE_GCP_PROJECT_ID || 'agentflow-prod-assistant',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function isFirebaseConfigured() {
  const { apiKey, authDomain, projectId, appId } = firebaseConfig;
  return Boolean(
    import.meta.env.VITE_AUTH_ENABLED === 'true'
    && apiKey && apiKey !== 'undefined'
    && authDomain && authDomain !== 'undefined'
    && projectId
    && appId && appId !== 'undefined',
  );
}

export function getFirebaseConfig() {
  return { ...firebaseConfig };
}

export function getFirebaseAuth() {
  if (!isFirebaseConfigured()) return null;

  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  }

  return { auth, googleProvider };
}
