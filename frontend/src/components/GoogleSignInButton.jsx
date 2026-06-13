import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

export default function GoogleSignInButton({ onError }) {
  const { loginWithGoogleCredential, googleClientId } = useAuth();

  if (!googleClientId) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
        Google Client ID not configured. Set <code className="text-xs">VITE_GOOGLE_CLIENT_ID</code> in the Cloud Run build.
      </p>
    );
  }

  return (
    <div className="flex justify-center">
      <GoogleLogin
        onSuccess={async (res) => {
          try {
            await loginWithGoogleCredential(res.credential);
          } catch (err) {
            onError?.(err.message);
          }
        }}
        onError={() => onError?.('Google sign-in was cancelled or failed.')}
        useOneTap={false}
        theme="outline"
        size="large"
        text="continue_with"
        shape="rectangular"
        width="320"
      />
    </div>
  );
}
