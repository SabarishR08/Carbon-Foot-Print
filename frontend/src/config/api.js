/**
 * API configuration
 *
 * Routing strategy:
 *
 *  ┌─ Production ──────────────────────────────────────────────────────────────┐
 *  │  Backend API base can be injected at build time via VITE_API_URL           │
 *  │  Example: VITE_API_URL=https://api.example.com                            │
 *  │  When unset, the UI uses relative URLs for same-origin deployments.       │
 *  └────────────────────────────────────────────────────────────────────────┘
 *
 *  ┌─ Development ──────────────────────────────────────────────────────────┐
 *  │  Vite proxy maps /api → http://localhost:8080                          │
 *  │  VITE_API_URL is unset → API_BASE = ""  (relative URLs)                │
 *  └────────────────────────────────────────────────────────────────────────┘
 */
const API_BASE = import.meta.env.VITE_API_URL || '';

export async function apiFetch(path, { token, guestId, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  else if (guestId) headers['X-Guest-Id'] = guestId;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.message || err.error || 'Request failed');
  }

  if (res.status === 204) return null;
  return res.json();
}

export { API_BASE };
