import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '../config/firebase';
import { API_BASE } from '../config/api';

const TOKEN_KEY = 'ecotrack_auth_token';
const USER_KEY = 'ecotrack_auth_user';

function loadStoredSession() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    return token && user ? { token, user } : null;
  } catch {
    return null;
  }
}

function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const firebaseEnabled = isFirebaseConfigured();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  const applySession = useCallback((t, u) => {
    setToken(t);
    setUser(u);
    if (t && u) saveSession(t, u);
    else clearSession();
  }, []);

  // Restore Google OAuth session from localStorage
  useEffect(() => {
    const stored = loadStoredSession();
    if (stored && !firebaseEnabled) {
      applySession(stored.token, stored.user);
      setLoading(false);
      return undefined;
    }

    if (!firebaseEnabled) {
      setLoading(false);
      return undefined;
    }

    const fb = getFirebaseAuth();
    if (!fb) {
      setLoading(false);
      return undefined;
    }

    return onAuthStateChanged(fb.auth, async (u) => {
      if (u) {
        const t = await u.getIdToken();
        applySession(t, {
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          photoURL: u.photoURL,
          authProvider: 'firebase',
        });
      } else {
        applySession(null, null);
      }
      setLoading(false);
    });
  }, [firebaseEnabled, applySession]);

  /** Google Identity Services — works without Firebase console link */
  const loginWithGoogleCredential = async (credential) => {
    const res = await fetch(`${API_BASE}/api/v1/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: credential }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || 'Google sign-in failed');
    }
    const data = await res.json();
    applySession(credential, {
      uid: data.user.uid || data.user.id,
      email: data.user.email,
      displayName: data.user.displayName || data.user.name,
      photoURL: data.user.picture || data.user.photoURL,
      authProvider: 'google.com',
    });
  };

  const loginGoogleFirebase = async () => {
    const fb = getFirebaseAuth();
    if (!fb) throw new Error('Firebase Auth is not configured.');
    const result = await signInWithPopup(fb.auth, fb.googleProvider);
    const t = await result.user.getIdToken();
    applySession(t, {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      authProvider: 'firebase',
    });
  };

  const loginGoogle = () => (firebaseEnabled ? loginGoogleFirebase() : Promise.reject(new Error('Use GoogleSignInButton')));

  const loginEmail = async (email, password) => {
    const fb = getFirebaseAuth();
    if (!fb) throw new Error('Email sign-in requires Firebase Auth. Use Google sign-in.');
    const result = await signInWithEmailAndPassword(fb.auth, email, password);
    const t = await result.user.getIdToken();
    applySession(t, {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      authProvider: 'firebase',
    });
  };

  const registerEmail = async (email, password) => {
    const fb = getFirebaseAuth();
    if (!fb) throw new Error('Registration requires Firebase Auth. Use Google sign-in.');
    const result = await createUserWithEmailAndPassword(fb.auth, email, password);
    const t = await result.user.getIdToken();
    applySession(t, {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      authProvider: 'firebase',
    });
  };

  const logout = async () => {
    const fb = getFirebaseAuth();
    if (fb) await signOut(fb.auth).catch(() => {});
    applySession(null, null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      firebaseEnabled,
      googleClientId,
      isAuthenticated: Boolean(user && token),
      loginGoogle,
      loginWithGoogleCredential,
      loginEmail,
      registerEmail,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
