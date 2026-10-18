const KEY = 'dv_token';
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(API_BASE + '/api' + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Check your connection and that the backend is running.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && getToken()) window.dispatchEvent(new Event('dv-unauth'));
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

export const fileUrl = (id, variant, download) =>
  `${API_BASE}/api/workspace/images/${id}/file?variant=${variant}&token=${getToken()}${download ? '&download=1' : ''}`;

/** Upload one file with progress. Resolves with the response JSON; rejects with {message,status,data}. */
export function uploadImage({ file, folderId, documentId, force, onProgress, onUploaded }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append('folderId', folderId);
    fd.append('documentId', documentId);
    if (force) fd.append('force', '1');
    fd.append('file', file);
    xhr.open('POST', `${API_BASE}/api/workspace/images`);
    xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.upload.onload = () => onUploaded?.();
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch {}
      xhr.status < 300 ? resolve(data) : reject({ message: data.error || `Upload failed (${xhr.status})`, status: xhr.status, data });
    };
    xhr.onerror = () => reject({ message: 'Network error during upload.' });
    xhr.send(fd);
  });
}
