import React from 'react';
import { Modal } from '../ui.jsx';

/** Pick a destination folder. Only folders where the user can upload are selectable. */
export default function FolderPicker({ title, org, current, busy, onPick, onClose, confirmLabel }) {
  const [sel, setSel] = React.useState(null);
  const kids = (pid) => org.folders.filter((f) => f.parentId === pid);
  const Node = ({ f, depth }) => {
    const ok = f.perms.includes('upload');
    return (
      <>
        <button className={`pick ${sel === f.id ? 'sel' : ''}`} disabled={!ok} style={{ paddingLeft: 12 + depth * 18 }} onClick={() => setSel(f.id)}
          title={ok ? '' : 'You need upload permission on this folder'}>
          <span className="code">{f.code}</span>{f.name}{f.id === current && <em> (current)</em>}
        </button>
        {kids(f.id).map((c) => <Node key={c.id} f={c} depth={depth + 1} />)}
      </>
    );
  };
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={!sel || busy} onClick={() => onPick(sel)}>{busy ? 'Working…' : confirmLabel}</button></>}>
      <div className="picklist">{kids(null).map((f) => <Node key={f.id} f={f} depth={0} />)}</div>
    </Modal>
  );
}
