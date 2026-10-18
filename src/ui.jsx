import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const P = {
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01',
  upload: 'M12 16V4m0 0L7 9m5-5 5 5M4 20h16',
  download: 'M12 4v12m0 0 5-5m-5 5-5-5M4 20h16',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  move: 'M5 12h14m0 0-5-5m5 5-5 5',
  copy: 'M8 8h11v12H8zM5 16V4h11',
  trash: 'M5 7h14M10 7V4h4v3m-8 0 1 13h10l1-13',
  close: 'M6 6l12 12M18 6 6 18',
  menu: 'M4 6h16M4 12h16M4 18h16',
  lock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3',
  check: 'M5 12l5 5 9-10',
  alert: 'M12 4 2 20h20zM12 10v5m0 3h.01',
  rotate: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5',
  moon: 'M20 14a8 8 0 1 1-10-10 6 6 0 0 0 10 10z',
  share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 10.5l6.8-3.9M8.6 13.5l6.8 3.9',
  chevron: 'M9 6l6 6-6 6',
  left: 'M15 6l-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  refresh: 'M20 11a8 8 0 0 0-14.5-3M4 4v4h4M4 13a8 8 0 0 0 14.5 3M20 20v-4h-4',
  logout: 'M9 4H5v16h4M16 8l4 4-4 4M20 12H9',
};
export const Icon = ({ name, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[name]} /></svg>
);

export const formatBytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
export const formatDate = (s) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');

// ---------- toasts ----------
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((message, kind = 'success') => {
    const id = Math.random();
    setList((l) => [...l, { id, message, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}><Icon name={t.kind === 'error' ? 'alert' : 'check'} />{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- preferences ----------
const PrefCtx = createContext(null);
export const usePrefs = () => useContext(PrefCtx);
const DEFAULTS = { theme: 'light', previewSize: 'm', lastOrg: null, lastFolder: null, includeSub: true };
export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('dv_prefs') || '{}');
      return { ...DEFAULTS, ...saved, theme: saved.theme === 'dark' ? 'dark' : 'light' };
    } catch { return DEFAULTS; }
  });
  useEffect(() => {
    localStorage.setItem('dv_prefs', JSON.stringify(prefs));
    document.documentElement.dataset.theme = prefs.theme === 'dark' ? 'dark' : 'light';
  }, [prefs]);
  const setPref = useCallback((patch) => setPrefs((p) => ({ ...p, ...patch })), []);
  return <PrefCtx.Provider value={{ prefs, setPref }}>{children}</PrefCtx.Provider>;
}

// ---------- shared pieces ----------
export const Spinner = ({ label = 'Loading…' }) => <div className="center-note"><span className="spinner" />{label}</div>;
export const ErrorBox = ({ message, onRetry }) => (
  <div className="banner error" role="alert"><Icon name="alert" /><span>{message}</span>{onRetry && <button className="btn sm" onClick={onRetry}>Try again</button>}</div>
);
export const Empty = ({ title, children }) => <div className="empty"><strong>{title}</strong><p>{children}</p></div>;

export function Modal({ title, onClose, children, wide, footer }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button></header>
        <div className="modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

export function useLoad(fn, deps) {
  const [state, set] = useState({ data: null, loading: true, error: null });
  const ref = useRef(0);
  const run = useCallback(() => {
    const n = ++ref.current;
    set((s) => ({ ...s, loading: true, error: null }));
    fn().then((data) => n === ref.current && set({ data, loading: false, error: null }))
      .catch((e) => n === ref.current && set({ data: null, loading: false, error: e.message }));
    // eslint-disable-next-line
  }, deps);
  useEffect(run, [run]);
  return { ...state, reload: run };
}
