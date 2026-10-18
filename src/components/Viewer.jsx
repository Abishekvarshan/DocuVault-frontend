import React, { useEffect, useState } from 'react';
import { api, fileUrl } from '../api.js';
import { ErrorBox, Icon, Modal, Spinner, formatBytes, formatDate, useLoad, useToast } from '../ui.jsx';
import FolderPicker from './FolderPicker.jsx';

const VARIANTS = [['original', 'Original'], ['hd', 'HD (2560 px)'], ['web', 'Web (1280 px)'], ['thumb', 'Thumbnail (320 px)']];

export default function Viewer({ items, index, org, onIndex, onClose, onChanged }) {
  const toast = useToast();
  const id = items[index].id;
  const d = useLoad(() => api(`/workspace/images/${id}`), [id]);
  const img = d.data;
  const [variant, setVariant] = useState('web');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ documentId: '', title: '', tags: '' });
  const [picker, setPicker] = useState(null); // 'move' | 'copy'
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState('');
  const [rev, setRev] = useState(0); // cache-buster after edits

  useEffect(() => { setEditing(false); setVariant('web'); }, [id]);
  useEffect(() => {
    const k = (e) => {
      if (e.target.tagName === 'INPUT' || picker || confirmDel) return;
      if (e.key === 'ArrowRight' && index < items.length - 1) onIndex(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [index, items.length, picker, confirmDel]);

  const has = (p) => img?.perms.includes(p);
  const why = (p) => (has(p) ? '' : `Requires ${p} permission`);

  async function run(label, fn, done) {
    setBusy(label);
    try { await fn(); done(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(''); }
  }
  const startEdit = () => { setForm({ documentId: img.documentId, title: img.title, tags: img.tags.join(', ') }); setEditing(true); };
  const save = () => run('save', () => api(`/workspace/images/${id}`, { method: 'PATCH', body: { documentId: form.documentId, title: form.title, tags: form.tags.split(',') } }),
    () => { setEditing(false); d.reload(); onChanged('Image details saved'); });
  const rotate = () => run('rotate', () => api(`/workspace/images/${id}/rotate`, { method: 'POST', body: { degrees: 90 } }),
    () => { setRev((r) => r + 1); d.reload(); onChanged('Image rotated and all versions regenerated'); });
  const transfer = (kind, folderId) => run(kind, () => api(`/workspace/images/${id}/${kind}`, { method: 'POST', body: { folderId } }),
    () => { setPicker(null); onChanged(kind === 'move' ? 'Image moved' : 'Image copied'); if (kind === 'move') onClose(); });
  const remove = () => run('delete', () => api(`/workspace/images/${id}`, { method: 'DELETE' }),
    () => { setConfirmDel(false); onChanged('Image deleted'); onClose(); });

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Image preview">
      <div className="v-stage">
        <button className="icon-btn light v-close" onClick={onClose} aria-label="Close preview"><Icon name="close" /></button>
        <button className="nav prev" disabled={index === 0} onClick={() => onIndex(index - 1)} aria-label="Previous image"><Icon name="left" size={22} /></button>
        <img key={`${id}-${variant}-${rev}`} src={`${fileUrl(id, variant === 'original' ? 'hd' : variant)}&v=${rev}`} alt={img?.title || img?.documentId || 'Selected image'} />
        <button className="nav next" disabled={index >= items.length - 1} onClick={() => onIndex(index + 1)} aria-label="Next image"><Icon name="chevron" size={22} /></button>
        <div className="v-count">{index + 1} / {items.length}</div>
      </div>

      <aside className="v-panel">
        {d.loading && !img ? <Spinner /> : d.error ? <ErrorBox message={d.error} onRetry={d.reload} /> : img && (
          <>
            {editing ? (
              <div className="edit-form">
                <label>Document ID<input value={form.documentId} onChange={(e) => setForm({ ...form, documentId: e.target.value })} /></label>
                <label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
                <label>Tags (comma separated)<input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></label>
                <div className="row"><button className="btn primary" onClick={save} disabled={busy === 'save' || !form.documentId.trim()}>{busy === 'save' ? 'Saving…' : 'Save changes'}</button><button className="btn" onClick={() => setEditing(false)}>Cancel</button></div>
              </div>
            ) : (
              <div className="v-head"><h2>{img.documentId}</h2>{img.title && <p>{img.title}</p>}
                {img.tags.length > 0 && <div className="tags">{img.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>}</div>
            )}

            <div className="actions">
              <details className="menu">
                <summary className={`btn ${has('download') ? '' : 'disabled'}`} onClick={(e) => !has('download') && e.preventDefault()} title={why('download')}><Icon name="download" size={16} />Download</summary>
                <div className="menu-list">
                  {VARIANTS.map(([k, label]) => <a key={k} href={fileUrl(id, k, true)}>{label}<span>{formatBytes(img.variantSizes[k] || 0)}</span></a>)}
                </div>
              </details>
              <button className="btn" disabled={!has('edit') || editing} title={why('edit')} onClick={startEdit}><Icon name="edit" size={16} />Edit</button>
              <button className="btn" disabled={!has('edit') || busy === 'rotate'} title={why('edit')} onClick={rotate}><Icon name="rotate" size={16} />{busy === 'rotate' ? 'Rotating…' : 'Rotate'}</button>
              <button className="btn" disabled={!has('move')} title={why('move')} onClick={() => setPicker('move')}><Icon name="move" size={16} />Move</button>
              <button className="btn" disabled={!has('download')} title={why('download')} onClick={() => setPicker('copy')}><Icon name="copy" size={16} />Copy</button>
              <button className="btn danger" disabled={!has('delete')} title={why('delete')} onClick={() => setConfirmDel(true)}><Icon name="trash" size={16} />Delete</button>
              <button className="btn" disabled title="Share links are not available yet"><Icon name="share" size={16} />Share link</button>
            </div>

            <div className="seg full" role="group" aria-label="Preview quality">
              {['web', 'hd'].map((v) => <button key={v} className={variant === v ? 'active' : ''} onClick={() => setVariant(v)}>{v === 'web' ? 'Web preview' : 'HD preview'}</button>)}
            </div>

            <dl className="meta">
              <dt>Folder</dt><dd>{img.folderPath}</dd>
              <dt>File name</dt><dd>{img.originalName}</dd>
              <dt>Format</dt><dd>{img.mime.replace('image/', '').toUpperCase()}</dd>
              <dt>Dimensions</dt><dd>{img.width} × {img.height} px</dd>
              <dt>Original size</dt><dd>{formatBytes(img.size)}</dd>
              <dt>Uploaded by</dt><dd>{img.uploadedBy || 'Deleted user'}</dd>
              <dt>Uploaded</dt><dd>{formatDate(img.createdAt)}</dd>
              <dt>Last changed</dt><dd>{formatDate(img.updatedAt)}</dd>
              <dt>Your access</dt><dd>{img.perms.join(', ')}</dd>
            </dl>
          </>
        )}
      </aside>

      {picker && <FolderPicker title={picker === 'move' ? 'Move image to…' : 'Copy image to…'} org={org} current={img.folderId} busy={!!busy}
        confirmLabel={picker === 'move' ? 'Move here' : 'Copy here'} onClose={() => setPicker(null)} onPick={(fid) => transfer(picker, fid)} />}
      {confirmDel && <Modal title="Delete this image?" onClose={() => setConfirmDel(false)} footer={<>
        <button className="btn" onClick={() => setConfirmDel(false)}>Keep image</button>
        <button className="btn danger solid" onClick={remove} disabled={busy === 'delete'}>{busy === 'delete' ? 'Deleting…' : 'Delete image'}</button></>}>
        <p><strong>{img.documentId}</strong> and all its versions (thumbnail, web, HD, original) will be permanently removed.</p></Modal>}
    </div>
  );
}
