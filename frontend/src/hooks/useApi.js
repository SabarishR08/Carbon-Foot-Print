import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';

export function useApi() {
  const { token } = useAuth();
  return useCallback(
    (path, opts = {}) => {
      if (!token) throw new Error('Not authenticated');
      return apiFetch(path, { ...opts, token });
    },
    [token],
  );
}
