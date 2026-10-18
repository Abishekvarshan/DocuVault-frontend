import React, { useState } from 'react';
import { api } from '../api.js';
import { Icon } from '../ui.jsx';

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const d = await api(`/auth/${mode === 'login' ? 'login' : 'signup'}`, { method: 'POST', body: f });
      onAuth(d.token, d.user);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="auth">
      <aside className="auth-side">
        <span className="logo big">DV</span>
        <h1>Every document image, filed and findable.</h1>
        <p>Numbered folders per organization, multi-size image processing, and access that administrators control folder by folder.</p>
      </aside>
      <form className="auth-card" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Sign in' : 'Create your account'}</h2>
        <div className="tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>Sign in</button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); }}>Sign up</button>
        </div>
        {mode === 'signup' && <label>Full name<input value={f.name} onChange={set('name')} autoComplete="name" required /></label>}
        <label>Email<input type="email" value={f.email} onChange={set('email')} autoComplete="email" required /></label>
        <label>Password<input type="password" value={f.password} onChange={set('password')} minLength={mode === 'signup' ? 8 : undefined} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></label>
        {mode === 'signup' && <p className="hint">New accounts are customer accounts with no access. An administrator grants organizations and folders after you sign up.</p>}
        {error && <div className="banner error" role="alert"><Icon name="alert" /><span>{error}</span></div>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
      </form>
    </div>
  );
}
