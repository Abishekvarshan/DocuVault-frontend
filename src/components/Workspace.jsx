import React, { useEffect, useMemo, useState } from 'react';
import { api, fileUrl } from '../api.js';
import { Empty, ErrorBox, Icon, Spinner, formatBytes, useLoad, usePrefs, useToast } from '../ui.jsx';
import UploadDialog from './UploadDialog.jsx';
import Viewer from './Viewer.jsx';

const SIZES = { s: 'Small', m: 'Medium', l: 'Large' };
const FORMATS = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/gif': 'GIF', 'image/tiff': 'TIFF', 'image/avif': 'AVIF' };

export default function Workspace({ user }) {
  const { prefs, setPref } = usePrefs();
  const toast = useToast();
  const tree = useLoad(() => api('/workspace/tree'), []);
  const orgs = tree.data?.organizations || [];
  const [orgId, setOrgId] = useState(prefs.lastOrg);
  const [folderId, setFolderId] = useState(prefs.lastFolder);
  const [f, setF] = useState({ q: '', format: '', sort: 'newest', from: '', to: '' });
  const [q, setQ] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [openIdx, setOpenIdx] = useState(null);
  const [collapsed, setCollapsed] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const org = orgs.find((o) => o.id === orgId) || orgs[0];
  const folders = org?.folders || [];
  const folder = folders.find((x) => x.id === folderId);

  // choose sensible defaults when the tree loads
  useEffect(() => {
    if (!org) return;
    if (org.id !== orgId) setOrgId(org.id);
    if (!folders.find((x) => x.id === folderId)) setFolderId((folders.find((x) => x.perms.includes('view')) || folders[0])?.id ?? null);
  }, [tree.data, orgId]);
  useEffect(() => { setPref({ lastOrg: orgId, lastFolder: folderId }); }, [orgId, folderId]);
  useEffect(() => { const t = setTimeout(() => setF((x) => ({ ...x, q })), 300); return () => clearTimeout(t); }, [q]);

  const list = useLoad(() => {
    if (!org || !folder || !folder.perms.includes('view')) return Promise.resolve({ items: [], total: 0 });
    const p = new URLSearchParams({ orgId: org.id, folderId: folder.id, ...(prefs.includeSub ? { includeSub: '1' } : {}) });
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    return api('/workspace/images?' + p);
  }, [org?.id, folder?.id, f, prefs.includeSub]);
  const items = list.data?.items || [];

  const kids = useMemo(() => {
    const m = new Map();
    folders.forEach((x) => m.set(x.parentId, [...(m.get(x.parentId) || []), x]));
    return m;
  }, [folders]);

  const refresh = () => { tree.reload(); list.reload(); };
  const canUpload = folder?.perms.includes('upload');
  const activeFilters = [f.format, f.from, f.to].filter(Boolean).length;

  const Node = ({ n, depth }) => {
    const sub = kids.get(n.id) || [];
    const open = !collapsed.has(n.id);
    const locked = !n.perms.includes('view');
    return (
      <li>
        <div className={`fnode ${n.id === folderId ? 'active' : ''} ${locked ? 'locked' : ''}`} style={{ paddingLeft: 8 + depth * 14 }}>
          <button className={`twist ${open ? 'open' : ''} ${sub.length ? '' : 'hide'}`} aria-label={open ? 'Collapse' : 'Expand'}
            onClick={() => setCollapsed((s) => { const c = new Set(s); c.has(n.id) ? c.delete(n.id) : c.add(n.id); return c; })}><Icon name="chevron" size={14} /></button>
          <button className="fname" disabled={locked} title={locked ? 'You do not have access to this folder' : ''} onClick={() => { setFolderId(n.id); setDrawer(false); }}>
            <span className="code">{n.code}</span><span className="label">{n.name}</span>
            {locked ? <Icon name="lock" size={13} /> : <span className="count">{n.count}</span>}
          </button>
        </div>
        {sub.length > 0 && open && <ul>{sub.map((c) => <Node key={c.id} n={c} depth={depth + 1} />)}</ul>}
      </li>
    );
  };

  if (tree.loading && !tree.data) return <Spinner label="Loading your folders…" />;
  if (tree.error) return <div className="pad"><ErrorBox message={tree.error} onRetry={tree.reload} /></div>;
  if (!orgs.length) return (
    <div className="pad"><Empty title="No access yet">
      {user.role === 'admin' ? 'Create an organization and its folders in the Admin area.' : 'Your account has no organizations assigned. Ask an administrator to grant you access, then refresh.'}
    </Empty></div>
  );

  return (
    <div className="workspace">
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}
      <aside className={`sidebar ${drawer ? 'open' : ''}`}>
        <label className="orgsel">Organization
          <select value={org.id} onChange={(e) => { setOrgId(Number(e.target.value)); setFolderId(null); }}>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        <div className="side-title">Folders</div>
        {folders.length ? <ul className="ftree">{(kids.get(null) || []).map((n) => <Node key={n.id} n={n} depth={0} />)}</ul>
          : <p className="muted pad-sm">No folders in this organization yet.</p>}
      </aside>

      <section className="content">
        <div className="toolbar">
          <button className="icon-btn show-mobile" onClick={() => setDrawer(true)} aria-label="Open folders"><Icon name="menu" /></button>
          <div className="crumb"><strong>{folder ? `${folder.code} ${folder.name}` : 'Select a folder'}</strong>
            <span className="muted">{list.loading ? 'Loading…' : `${list.data?.total ?? 0} images`}</span></div>
          <div className="search"><Icon name="search" size={16} /><input placeholder="Search document ID, title, file name, tag" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search images" /></div>
          <button className={`btn ${activeFilters ? 'on' : ''}`} onClick={() => setShowFilters((s) => !s)}>Filters{activeFilters ? ` (${activeFilters})` : ''}</button>
          <div className="seg" role="group" aria-label="Preview size">
            {Object.entries(SIZES).map(([k, v]) => <button key={k} className={prefs.previewSize === k ? 'active' : ''} onClick={() => setPref({ previewSize: k })} title={`${v} previews`}>{k.toUpperCase()}</button>)}
          </div>
          <button className="icon-btn" onClick={refresh} aria-label="Refresh" title="Refresh"><Icon name="refresh" /></button>
          <button className="btn primary" disabled={!canUpload} onClick={() => setUploading(true)} title={canUpload ? '' : 'You need upload permission on this folder'}><Icon name="upload" size={16} />Upload</button>
        </div>

        {showFilters && (
          <div className="filters">
            <label>Format<select value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })}><option value="">All formats</option>{Object.entries(FORMATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Sort by<select value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="doc">Document ID</option><option value="name">File name</option><option value="size">Largest first</option></select></label>
            <label>Uploaded from<input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
            <label>Uploaded to<input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
            <label className="check"><input type="checkbox" checked={prefs.includeSub} onChange={(e) => setPref({ includeSub: e.target.checked })} />Include sub-folders</label>
            <button className="btn" onClick={() => { setF({ ...f, format: '', from: '', to: '', sort: 'newest' }); }}>Clear filters</button>
          </div>
        )}

        <div className="gallery-wrap">
          {!folder ? <Empty title="Choose a folder">Pick a folder from the sidebar to see its images.</Empty>
            : !folder.perms.includes('view') ? <Empty title="No access to this folder">An administrator can grant you view access.</Empty>
            : list.error ? <ErrorBox message={list.error} onRetry={list.reload} />
            : list.loading && !items.length ? <Spinner label="Loading images…" />
            : !items.length ? <Empty title={q || activeFilters ? 'No images match' : 'This folder is empty'}>{q || activeFilters ? 'Try a different search or clear the filters.' : canUpload ? 'Use Upload to add the first document images.' : 'Nothing has been uploaded here yet.'}</Empty>
            : (
              <div className={`gallery size-${prefs.previewSize} ${list.loading ? 'dim' : ''}`}>
                {items.map((im, i) => (
                  <button key={im.id} className="tile" onClick={() => setOpenIdx(i)}>
                    <div className="thumb"><img loading="lazy" src={fileUrl(im.id, 'thumb')} alt={im.title || im.documentId} /></div>
                    <div className="tmeta"><strong>{im.documentId}</strong><span>{im.originalName}</span><span>{formatBytes(im.size)} · {im.width}×{im.height}</span></div>
                  </button>
                ))}
              </div>
            )}
        </div>
      </section>

      {uploading && folder && <UploadDialog folder={folder} onClose={() => setUploading(false)} onDone={refresh} />}
      {openIdx != null && items[openIdx] && (
        <Viewer items={items} index={openIdx} org={org} onIndex={setOpenIdx} onClose={() => setOpenIdx(null)}
          onChanged={(msg) => { msg && toast(msg); refresh(); }} />
      )}
    </div>
  );
}
