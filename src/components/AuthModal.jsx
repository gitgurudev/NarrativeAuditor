import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import styles from './AuthModal.module.css';

function AuthModal({ onSuccess }) {
  const { register, login } = useAuth();
  const [mode,     setMode]     = useState('login');   // 'login' | 'register'
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const [form, setForm] = useState({ username: '', email: '', password: '' });

  function set(field) {
    return (e) => { setForm((f) => ({ ...f, [field]: e.target.value })); setError(null); };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'register') {
        await register(form.username.trim(), form.email.trim(), form.password);
      } else {
        await login(form.email.trim(), form.password);
      }
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.logoMark}>◈</div>
          <h2 className={styles.modalTitle}>NarrativeAuditor</h2>
          <p className={styles.modalSub}>
            {mode === 'login' ? 'Sign in to your account' : 'Create a free account'}
          </p>
        </div>

        {/* Limit notice */}
        <div className={styles.limitNotice}>
          <span className={styles.limitIcon}>🎬</span>
          <span>Each account includes <strong>2 free script evaluations</strong></span>
        </div>

        {/* Form */}
        <form className={styles.form} onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className={styles.field}>
              <label className={styles.label}>Username</label>
              <input
                className={styles.input}
                type="text"
                placeholder="your_username"
                value={form.username}
                onChange={set('username')}
                required
                minLength={3}
                maxLength={30}
                autoComplete="username"
              />
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={set('email')}
              required
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              className={styles.input}
              type="password"
              placeholder={mode === 'register' ? 'Min 6 characters' : '••••••••'}
              value={form.password}
              onChange={set('password')}
              required
              minLength={6}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          </div>

          {error && (
            <div className={styles.errorBox} role="alert">{error}</div>
          )}

          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading
              ? <><span className={styles.spinner} /> {mode === 'login' ? 'Signing in…' : 'Creating account…'}</>
              : mode === 'login' ? 'Sign In →' : 'Create Account →'
            }
          </button>
        </form>

        {/* Switch mode */}
        <p className={styles.switchText}>
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          {' '}
          <button
            className={styles.switchBtn}
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>

      </div>
    </div>
  );
}

export default AuthModal;
