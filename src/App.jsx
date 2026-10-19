import React, { useEffect, useRef, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import { Icon, Modal, PrefsProvider, Spinner, ToastProvider, usePrefs, useToast } from './ui.jsx';
import Auth from './components/Auth.jsx';
import Workspace from './components/Workspace.jsx';
import Admin from './components/Admin.jsx';
import Home from './components/Home.jsx';

function Shell() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(!!getToken());
  const [view, setView] = useState('home');
  const [uploadRequest, setUploadRequest] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const menuNavRef = useRef(null);
  const { prefs, setPref } = usePrefs();
  const toast = useToast();

  useEffect(() => {
    if (getToken()) api('/auth/me').then((d) => setUser(d.user)).catch(() => setToken(null)).finally(() => setBooting(false));
    const out = () => { setToken(null); setUser(null); toast('Your session ended. Sign in again.', 'error'); };
    window.addEventListener('dv-unauth', out);
    return () => window.removeEventListener('dv-unauth', out);
  }, []);

  useEffect(() => {
    const closeOnOutside = (event) => {
      if (!menuNavRef.current?.contains(event.target)) setOpenMenu(null);
    };
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpenMenu(null); };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    const closeNativeMenus = (event) => {
      const clickedSummary = event.target.closest?.('details > summary');
      document.querySelectorAll('details[open]').forEach((menu) => {
        if (menu !== clickedSummary?.parentElement) menu.open = false;
      });
    };
    document.addEventListener('click', closeNativeMenus);
    return () => document.removeEventListener('click', closeNativeMenus);
  }, []);

  if (booting) return <Spinner label="Starting workspace…" />;
  if (!user) return <Auth onAuth={(t, u) => { setToken(t); setUser(u); setView('home'); }} />;

  const nextTheme = prefs.theme === 'dark' ? 'light' : 'dark';
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="logo">DV</span><span className="brand-name">DocuVault</span></div>
        <nav className="primary-nav">
          <button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>Home</button>
          <button className={view === 'workspace' ? 'active' : ''} onClick={() => setView('workspace')}>Workspace</button>
          {(user.role === 'admin' || user.canCreateOrg || user.canCreateFolders) && <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>Admin</button>}
        </nav>
        {view === 'workspace' && <nav className="menu-nav" aria-label="Application menu" ref={menuNavRef}>
          <div className="menu">
            <button className={`menu-trigger ${openMenu === 'file' ? 'selected' : ''}`} aria-expanded={openMenu === 'file'} onClick={() => setOpenMenu(openMenu === 'file' ? null : 'file')}>File</button>
            {openMenu === 'file' && <div className="menu-popover">
              <button onClick={() => { setOpenMenu(null); setView('workspace'); setUploadRequest((n) => n + 1); }}>Upload to folder</button>
              <button onClick={() => { setOpenMenu(null); setToken(null); setUser(null); }}>Sign out</button>
            </div>}
          </div>
          <div className="menu">
            <button className={`menu-trigger ${openMenu === 'upload' ? 'selected' : ''}`} aria-expanded={openMenu === 'upload'} onClick={() => setOpenMenu(openMenu === 'upload' ? null : 'upload')}>Upload</button>
            {openMenu === 'upload' && <div className="menu-popover">
              <button onClick={() => { setOpenMenu(null); setView('workspace'); setUploadRequest((n) => n + 1); }}>Upload to current folder</button>
            </div>}
          </div>
          <div className="menu">
            <button className={`menu-trigger ${openMenu === 'view' ? 'selected' : ''}`} aria-expanded={openMenu === 'view'} onClick={() => setOpenMenu(openMenu === 'view' ? null : 'view')}>View</button>
            {openMenu === 'view' && <div className="menu-popover">
              <button onClick={() => setPref({ theme: nextTheme })}>Switch to {nextTheme} theme</button>
              <div className="menu-label">Preview size</div>
              {['s', 'm', 'l'].map((size) => <button key={size} onClick={() => setPref({ previewSize: size })}>{ { s: 'Small', m: 'Medium', l: 'Large' }[size] } previews{prefs.previewSize === size ? ' ✓' : ''}</button>)}
            </div>}
          </div>
          <button className="menu-help" onClick={() => { setOpenMenu(null); setHelpOpen(true); }}>Help</button>
        </nav>}
        <div className="topbar-right">
          <button className="icon-btn light" onClick={() => setPref({ theme: nextTheme })} title={`Theme: ${prefs.theme} (click for ${nextTheme})`} aria-label="Change theme">
            <Icon name={prefs.theme === 'dark' ? 'moon' : 'sun'} />
          </button>
          <div className="who"><strong>{user.name}</strong><span>{user.role}</span></div>
          <button className="icon-btn light" onClick={() => { setToken(null); setUser(null); }} title="Sign out" aria-label="Sign out"><Icon name="logout" /></button>
        </div>
      </header>
      <main>{view === 'admin' && (user.role === 'admin' || user.canCreateOrg || user.canCreateFolders) ? <Admin me={user} />
        : view === 'home' ? <Home user={user} onWorkspace={(orgId, folderId) => {
          if (orgId) setPref({ lastOrg: orgId, lastFolder: folderId });
          setView('workspace');
        }} onAdmin={() => setView('admin')} />
        : <Workspace user={user} uploadRequest={uploadRequest} />}</main>
      {helpOpen && <Modal title="DocuVault help" onClose={() => setHelpOpen(false)}>
        <p>Choose an organization and folder in the Workspace, then search, filter, and open images to view their details.</p>
        <p className="hint" style={{ marginTop: 12 }}>Use Upload when a folder is selected and you have upload permission. Administrators can manage organizations, folders, and access in Admin.</p>
      </Modal>}
    </div>
  );
}

export default function App() {
  return <PrefsProvider><ToastProvider><Shell /></ToastProvider></PrefsProvider>;
}
