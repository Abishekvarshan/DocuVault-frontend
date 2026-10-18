import React, { useRef, useState } from 'react';
import { uploadImage } from '../api.js';
import { Icon, Modal, formatBytes } from '../ui.jsx';

const LABEL = { queued: 'Ready', uploading: 'Uploading', processing: 'Processing', done: 'Uploaded', duplicate: 'Duplicate', error: 'Failed' };

export default function UploadDialog({ folder, onClose, onDone }) {
  const [items, setItems] = useState([]);
  const [batchDoc, setBatchDoc] = useState('');
  const [running, setRunning] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef();
  const patch = (key, p) => setItems((l) => l.map((i) => (i.key === key ? { ...i, ...p } : i)));

  const add = (files) => {
    const imgs = [...files].filter((f) => f.type.startsWith('image/'));
    if (imgs.length < files.length) setItems((l) => l); // non-images are skipped silently below
    setItems((l) => [...l, ...imgs.map((file) => ({ key: Math.random(), file, docId: batchDoc, status: 'queued', progress: 0, error: '' }))]);
  };

  async function send(it, force) {
    patch(it.key, { status: 'uploading', progress: 0, error: '', dupe: null });
    try {
      await uploadImage({ file: it.file, folderId: folder.id, documentId: it.docId.trim(), force,
        onProgress: (p) => patch(it.key, { progress: p }), onUploaded: () => patch(it.key, { status: 'processing', progress: 100 }) });
      patch(it.key, { status: 'done', progress: 100 });
    } catch (e) {
      e.status === 409 && e.data?.duplicate ? patch(it.key, { status: 'duplicate', dupe: e.data.duplicate, error: e.message }) : patch(it.key, { status: 'error', error: e.message });
    }
  }

  async function start() {
    const todo = items.filter((i) => i.status === 'queued' || i.status === 'error');
    if (todo.some((i) => !i.docId.trim())) { setItems((l) => l.map((i) => (!i.docId.trim() && i.status !== 'done' ? { ...i, error: 'Document ID is required' } : i))); return; }
    setRunning(true);
    const q = [...todo];
    await Promise.all([0, 1].map(async () => { while (q.length) await send(q.shift(), false); }));
    setRunning(false);
    onDone();
  }

  const pending = items.filter((i) => ['queued', 'error'].includes(i.status)).length;
  const finished = items.filter((i) => i.status === 'done').length;

  return (
    <Modal wide title={`Upload to ${folder.code} ${folder.name}`} onClose={running ? undefined : onClose}
      footer={<>
        <span className="grow muted">{items.length ? `${finished} of ${items.length} uploaded` : 'Select images to begin'}</span>
        <button className="btn" onClick={onClose} disabled={running}>{finished ? 'Close' : 'Cancel'}</button>
        <button className="btn primary" onClick={start} disabled={running || !pending}>{running ? 'Uploading…' : `Upload ${pending || ''} ${pending === 1 ? 'image' : 'images'}`}</button></>}>
      <div className={`drop ${drag ? 'drag' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }} onClick={() => input.current.click()}>
        <Icon name="upload" size={28} /><strong>Drop images here or browse</strong><span>JPG, PNG, WebP, GIF, TIFF, AVIF · up to 60 MB each</span>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      </div>
      {items.length > 0 && (
        <div className="batch">
          <label>Document ID for new files<input value={batchDoc} onChange={(e) => setBatchDoc(e.target.value)} placeholder="e.g. INV-2026-0142" /></label>
          <button className="btn" onClick={() => setItems((l) => l.map((i) => (i.docId ? i : { ...i, docId: batchDoc, error: '' })))} disabled={!batchDoc.trim()}>Apply to empty rows</button>
        </div>
      )}
      <ul className="uplist">
        {items.map((i) => (
          <li key={i.key} className={i.status}>
            <div className="up-main">
              <div className="up-name"><strong title={i.file.name}>{i.file.name}</strong><span className="muted">{formatBytes(i.file.size)}</span></div>
              <input className={i.error === 'Document ID is required' ? 'invalid' : ''} placeholder="Document ID (required)" value={i.docId} disabled={!['queued', 'error'].includes(i.status)}
                onChange={(e) => patch(i.key, { docId: e.target.value, error: '' })} />
              <span className={`pill ${i.status}`}>{LABEL[i.status]}{i.status === 'uploading' ? ` ${i.progress}%` : ''}</span>
              {['queued', 'error', 'duplicate'].includes(i.status) && !running && <button className="icon-btn" aria-label="Remove" onClick={() => setItems((l) => l.filter((x) => x.key !== i.key))}><Icon name="close" size={16} /></button>}
            </div>
            {['uploading', 'processing'].includes(i.status) && <div className="bar"><div className={i.status === 'processing' ? 'indet' : ''} style={{ width: `${i.progress}%` }} /></div>}
            {i.status === 'duplicate' && <p className="note warn">Already stored as <strong>{i.dupe.documentId}</strong> in {i.dupe.folderPath}. <button className="link" onClick={() => send(i, true)}>Upload anyway</button></p>}
            {i.error && i.status !== 'duplicate' && <p className="note err">{i.error}</p>}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
