import { useState, useEffect } from 'react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

export function useAuth() {
  const [user,    setUser]    = useState(null);   // null = not loaded yet
  const [loading, setLoading] = useState(true);   // checking stored token
  const [error,   setError]   = useState(null);

  // On mount: restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem('na_token');
    if (!token) { setLoading(false); return; }

    fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((u) => { if (u) setUser(u); else localStorage.removeItem('na_token'); })
      .catch(() => localStorage.removeItem('na_token'))
      .finally(() => setLoading(false));
  }, []);

  async function register(username, email, password) {
    setError(null);
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed.');
    localStorage.setItem('na_token', data.token);
    setUser(data.user);
    return data.user;
  }

  async function login(email, password) {
    setError(null);
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed.');
    localStorage.setItem('na_token', data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('na_token');
    setUser(null);
  }

  /**
   * Called before starting evaluation.
   * Uploads the PDF to backend → increments counter → sends admin email.
   * Returns { ok, remaining } or throws with limitReached flag.
   */
  async function startEvaluation(pdfFile) {
    const token = localStorage.getItem('na_token');
    const form  = new FormData();
    form.append('pdf', pdfFile);

    const res = await fetch(`${BASE_URL}/api/evaluate/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || 'Could not start evaluation.');
      err.limitReached = data.limitReached || false;
      throw err;
    }
    setUser((u) => ({ ...u, evaluationsUsed: data.evaluationsUsed }));
    return data;
  }

  return { user, loading, error, register, login, logout, startEvaluation };
}
