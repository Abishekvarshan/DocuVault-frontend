import React, { useEffect, useRef, useState } from 'react';
import { uploadImage } from '../api.js';
import { Icon, Modal, formatBytes } from '../ui.jsx';

const LABEL = { queued: 'Ready', uploading: 'Uploading', processing: 'Processing', done: 'Uploaded', duplicate: 'Duplicate', error: 'Failed' };

function CameraCapture({ onCapture, onClose }) {
  const video = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let stream;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is unavailable in this browser.');
      return undefined;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((result) => {
        if (cancelled) { result.getTracks().forEach((track) => track.stop()); return; }
        stream = result;
        if (video.current) video.current.srcObject = stream;
      })
      .catch(() => setError('Allow camera access to take a photo.'));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const capture = () => {
    const element = video.current;
    if (!element?.videoWidth) return;
    const preview = element.parentElement.getBoundingClientRect();
    const scale = Math.max(preview.width / element.videoWidth, preview.height / element.videoHeight);
    const offsetX = (element.videoWidth * scale - preview.width) / 2;
    const offsetY = (element.videoHeight * scale - preview.height) / 2;
    const frame = { left: 0.29, top: 0.11, width: 0.42, height: 0.78 };
    const sx = Math.max(0, (offsetX + preview.width * frame.left) / scale);
    const sy = Math.max(0, (offsetY + preview.height * frame.top) / scale);
    const sw = Math.min(element.videoWidth - sx, preview.width * frame.width / scale);
    const sh = Math.min(element.videoHeight - sy, preview.height * frame.height / scale);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    canvas.getContext('2d').drawImage(element, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) { setError('Could not capture the photo. Please try again.'); return; }
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      onCapture(new File([blob], `camera-${stamp}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
    }, 'image/jpeg', 0.92);
  };

  return <Modal title="Capture photo" onClose={onClose} footer={<>
    <button className="btn" onClick={onClose}>Cancel</button>
    <button className="btn primary" onClick={capture} disabled={!ready}>Capture photo</button>
  </>}>
    <div className="camera-preview">
      <video ref={video} autoPlay muted playsInline onLoadedMetadata={() => setReady(true)} />
      <div className="camera-frame-guide" aria-hidden="true"><span>Align document in frame</span></div>
      {!ready && !error && <span className="camera-status">Starting camera…</span>}
    </div>
    {error && <p className="camera-error" role="alert">{error}</p>}
  </Modal>;
}

export default function UploadDialog({ folder, onClose, onDone }) {
  const [items, setItems] = useState([]);
  const [batchDoc, setBatchDoc] = useState('');
  const [running, setRunning] = useState(false);
  const [drag, setDrag] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const input = useRef();
  const previewUrls = useRef(new Set());
  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  const patch = (key, p) => setItems((l) => l.map((i) => (i.key === key ? { ...i, ...p } : i)));

  const add = (files) => {
    const imgs = [...files].filter((f) => f.type.startsWith('image/'));
    if (imgs.length < files.length) setItems((l) => l); // non-images are skipped silently below
    setItems((l) => [...l, ...imgs.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.add(previewUrl);
      return { key: Math.random(), file, previewUrl, docId: batchDoc, status: 'queued', progress: 0, error: '' };
    })]);
  };

  async function send(it, force) {
    patch(it.key, { status: 'uploading', progress: 0, error: '', dupe: null });
    try {
      await uploadImage({ file: it.file, folderId: folder.id, documentId: it.docId.trim(), force,
        onProgress: (p) => patch(it.key, { progress: p }), onUploaded: () => patch(it.key, { status: 'processing', progress: 100 }) });
      patch(it.key, { status: 'done', progress: 100 });
      return true;
    } catch (e) {
      e.status === 409 && e.data?.duplicate ? patch(it.key, { status: 'duplicate', dupe: e.data.duplicate, error: e.message }) : patch(it.key, { status: 'error', error: e.message });
      return false;
    }
  }

  async function start() {
    const todo = items.filter((i) => i.status === 'queued' || i.status === 'error');
    if (todo.some((i) => !i.docId.trim())) { setItems((l) => l.map((i) => (!i.docId.trim() && i.status !== 'done' ? { ...i, error: 'Document ID is required' } : i))); return; }
    setRunning(true);
    const q = [...todo];
    const results = await Promise.all([0, 1].map(async () => {
      let succeeded = true;
      while (q.length) if (!await send(q.shift(), false)) succeeded = false;
      return succeeded;
    }));
    setRunning(false);
    onDone();
    if (results.every(Boolean)) onClose();
  }

  const pending = items.filter((i) => ['queued', 'error'].includes(i.status)).length;
  const finished = items.filter((i) => i.status === 'done').length;

  return <>
    <Modal wide title={`Upload to ${folder.code} ${folder.name}`} onClose={running || cameraOpen ? undefined : onClose}
      footer={<>
        <span className="grow muted">{items.length ? `${finished} of ${items.length} uploaded` : 'Select images to begin'}</span>
        <button className="btn" onClick={onClose} disabled={running}>{finished ? 'Close' : 'Cancel'}</button>
        <button className="btn primary" onClick={start} disabled={running || !pending}>{running ? 'Uploading…' : `Upload ${pending || ''} ${pending === 1 ? 'image' : 'images'}`}</button></>}>
      <div className={`drop ${drag ? 'drag' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }} onClick={() => input.current.click()}>
        <Icon name="upload" size={28} /><strong>Drop images here or browse</strong><span>JPG, PNG, WebP, GIF, TIFF, AVIF · up to 60 MB each</span>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      </div>
      <div className="upload-source-actions"><span>Or take a new photo</span><button className="btn" disabled={running} onClick={() => setCameraOpen(true)}><Icon name="camera" size={16} />Use camera</button></div>
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
              <img className="up-thumb" src={i.previewUrl} alt="" />
              <div className="up-name"><strong title={i.file.name}>{i.file.name}</strong><span className="muted">{formatBytes(i.file.size)}</span></div>
              <input className={`up-docid ${i.error === 'Document ID is required' ? 'invalid' : ''}`} placeholder="Document ID (required)" value={i.docId} disabled={!['queued', 'error'].includes(i.status)}
                onChange={(e) => patch(i.key, { docId: e.target.value, error: '' })} />
              <span className={`pill ${i.status}`}>{LABEL[i.status]}{i.status === 'uploading' ? ` ${i.progress}%` : ''}</span>
              {['queued', 'error', 'duplicate'].includes(i.status) && !running && <button className="icon-btn up-remove" aria-label="Remove" onClick={() => {
                const item = items.find((x) => x.key === i.key);
                if (item) { URL.revokeObjectURL(item.previewUrl); previewUrls.current.delete(item.previewUrl); }
                setItems((l) => l.filter((x) => x.key !== i.key));
              }}><Icon name="close" size={16} /></button>}
            </div>
            {['uploading', 'processing'].includes(i.status) && <div className="bar"><div className={i.status === 'processing' ? 'indet' : ''} style={{ width: `${i.progress}%` }} /></div>}
            {i.status === 'duplicate' && <p className="note warn">Already stored as <strong>{i.dupe.documentId}</strong> in {i.dupe.folderPath}. <button className="link" onClick={() => send(i, true)}>Upload anyway</button></p>}
            {i.error && i.status !== 'duplicate' && <p className="note err">{i.error}</p>}
          </li>
        ))}
      </ul>
    </Modal>
    {cameraOpen && !running && <CameraCapture onClose={() => setCameraOpen(false)} onCapture={(file) => { add([file]); setCameraOpen(false); }} />}
  </>;
}
