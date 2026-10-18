import React, { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import { Icon, PrefsProvider, Spinner, ToastProvider, usePrefs, useToast } from './ui.jsx';
import Auth from './components/Auth.jsx';
import Workspace from './components/Workspace.jsx';
import Admin from './components/Admin.jsx';

function Shell() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(!!getToken());
  const [view, setView] = useState('workspace');
  const { prefs, setPref } = usePrefs();
  const toast = useToast();

  useEffect(() => {
    if (getToken()) api('/auth/me').then((d) => setUser(d.user)).catch(() => setToken(null)).finally(() => setBooting(false));
    const out = () => { setToken(null); setUser(null); toast('Your session ended. Sign in again.', 'error'); };
    window.addEventListener('dv-unauth', out);
    return () => window.removeEventListener('dv-unauth', out);
  }, []);

  if (booting) return <Spinner label="Starting workspace…" />;
  if (!user) return <Auth onAuth={(t, u) => { setToken(t); setUser(u); setView('workspace'); }} />;

  const nextTheme = prefs.theme === 'dark' ? 'light' : 'dark';
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="logo">DV</span><span className="brand-name">DocuVault</span></div>
        <nav>
          <button className={view === 'workspace' ? 'active' : ''} onClick={() => setView('workspace')}>Workspace</button>
          {user.role === 'admin' && <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>Admin</button>}
        </nav>
        <div className="topbar-right">
          <button className="icon-btn light" onClick={() => setPref({ theme: nextTheme })} title={`Theme: ${prefs.theme} (click for ${nextTheme})`} aria-label="Change theme">
            <Icon name={prefs.theme === 'dark' ? 'moon' : 'sun'} />
          </button>
          <div className="who"><strong>{user.name}</strong><span>{user.role}</span></div>
          <button className="icon-btn light" onClick={() => { setToken(null); setUser(null); }} title="Sign out" aria-label="Sign out"><Icon name="logout" /></button>
        </div>
      </header>
      <main>{view === 'admin' && user.role === 'admin' ? <Admin me={user} /> : <Workspace user={user} />}</main>
    </div>
  );
}

export default function App() {
  return <PrefsProvider><ToastProvider><Shell /></ToastProvider></PrefsProvider>;
}
