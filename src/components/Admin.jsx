import React, { useState } from 'react';
import { api } from '../api.js';
import { Empty, ErrorBox, Icon, Modal, Spinner, formatDate, useLoad, useToast } from '../ui.jsx';

const PERMS = [['view', 'View'], ['download', 'Download'], ['upload', 'Upload'], ['edit', 'Edit'], ['move', 'Move / copy'], ['delete', 'Delete']];
const ROLE_HELP = { admin: 'Full control of everything', staff: 'Works with images where granted', customer: 'Read-only: view and download only' };

function useAct() {
  const toast = useToast();
  return async (fn, ok) => { try { const r = await fn(); ok && toast(ok); return r ?? true; } catch (e) { toast(e.message, 'error'); return false; } };
}

function FolderActions({ items }) {
  return <details className="folder-actions">
    <summary className="icon-btn" aria-label="Folder actions" title="Folder actions"><Icon name="more" /></summary>
    <div className="folder-action-menu">{items.map((item) => <button key={item.label} className={item.danger ? 'danger' : ''}
      onClick={(e) => { e.currentTarget.closest('details').open = false; item.onSelect(); }}>{item.label}</button>)}</div>
  </details>;
}

function RenameDialog({ title, initialValue, onClose, onSave }) {
  const [value, setValue] = useState(initialValue);
  return <Modal title={title} onClose={onClose} footer={<>
    <button className="btn" onClick={onClose}>Cancel</button>
    <button className="btn primary" disabled={!value.trim()} onClick={async () => { if (await onSave(value.trim())) onClose(); }}>Save</button>
  </>}><label>New name<input autoFocus value={value} onChange={(e) => setValue(e.target.value)} /></label></Modal>;
}

function DeleteDialog({ title, description, onClose, onDelete }) {
  return <Modal title={title} onClose={onClose} footer={<>
    <button className="btn" onClick={onClose}>Cancel</button>
    <button className="btn danger solid" onClick={async () => { if (await onDelete()) onClose(); }}>Delete</button>
  </>}><p>{description}</p></Modal>;
}

function Users({ me }) {
  const q = useLoad(() => api('/admin/users'), []);
  const act = useAct();
  const [form, setForm] = useState(null);
  const [pw, setPw] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const patch = (u, body, msg) => act(() => api(`/admin/users/${u.id}`, { method: 'PATCH', body }), msg).then((r) => r && q.reload());
  return (
    <section>
      <div className="sec-head"><div><h3>Users</h3><p className="muted">Sign-ups arrive as customers. Grant staff setup permissions here and image access under Access.</p></div>
        <button className="btn primary" onClick={() => setForm({ name: '', email: '', password: '', role: 'staff' })}>Add user</button></div>
      {q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> : q.loading && !q.data ? <Spinner /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Grants</th><th>Setup permissions</th><th>Joined</th><th></th></tr></thead>
          <tbody>{q.data.users.map((u) => (
            <tr key={u.id}>
              <td><strong>{u.name}</strong><div className="muted">{u.email}</div></td>
              <td><select value={u.role} disabled={u.id === me.id} title={ROLE_HELP[u.role]} onChange={(e) => patch(u, { role: e.target.value }, 'Role updated')}>
                {Object.keys(ROLE_HELP).map((r) => <option key={r}>{r}</option>)}</select></td>
              <td><label className="switch"><input type="checkbox" checked={u.active} disabled={u.id === me.id} onChange={(e) => patch(u, { active: e.target.checked }, e.target.checked ? 'User enabled' : 'User disabled')} /><span>{u.active ? 'Active' : 'Disabled'}</span></label></td>
              <td>{u.role === 'admin' ? 'All' : u.grants}</td>
              <td>{u.role === 'staff' ? <div className="staff-capabilities">
                <label className="check"><input type="checkbox" checked={u.canCreateOrg} onChange={(e) => patch(u, { canCreateOrg: e.target.checked }, 'Setup permission updated')} />Create organizations</label>
                <label className="check"><input type="checkbox" checked={u.canCreateFolders} onChange={(e) => patch(u, { canCreateFolders: e.target.checked }, 'Setup permission updated')} />Create folders</label>
              </div> : '—'}</td>
              <td>{formatDate(u.createdAt).split(',')[0]}</td>
              <td className="right"><button className="btn sm" onClick={() => setPw({ user: u, password: '' })}>Reset password</button>
                {u.id !== me.id && <button className="btn sm danger" onClick={() => setDeleteUser(u)}>Delete</button>}</td>
            </tr>))}</tbody></table></div>)}
      {form && <Modal title="Add user" onClose={() => setForm(null)} footer={<><button className="btn" onClick={() => setForm(null)}>Cancel</button>
        <button className="btn primary" onClick={async () => (await act(() => api('/admin/users', { method: 'POST', body: form }), 'User created')) && (setForm(null), q.reload())}>Create user</button></>}>
        <div className="form-grid">
          <label>Full name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Temporary password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          <label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{Object.keys(ROLE_HELP).map((r) => <option key={r}>{r}</option>)}</select></label>
        </div><p className="hint">{ROLE_HELP[form.role]}.</p></Modal>}
      {pw && <Modal title={`Reset password for ${pw.user.name}`} onClose={() => setPw(null)} footer={<><button className="btn" onClick={() => setPw(null)}>Cancel</button>
        <button className="btn primary" onClick={async () => (await act(() => api(`/admin/users/${pw.user.id}`, { method: 'PATCH', body: { password: pw.password } }), 'Password reset')) && setPw(null)}>Set password</button></>}>
        <label>New password (8+ characters)<input type="password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></label></Modal>}
      {deleteUser && <DeleteDialog title="Delete user?" description={`${deleteUser.name} will lose access. Their uploaded images remain.`} onClose={() => setDeleteUser(null)}
        onDelete={async () => { const ok = await act(() => api(`/admin/users/${deleteUser.id}`, { method: 'DELETE' }), 'User deleted'); if (ok) q.reload(); return ok; }} />}
    </section>
  );
}

function Orgs({ onChange }) {
  const q = useLoad(() => api('/admin/orgs'), []);
  const act = useAct();
  const [name, setName] = useState('');
  const [renameOrg, setRenameOrg] = useState(null);
  const [deleteOrg, setDeleteOrg] = useState(null);
  const done = () => { q.reload(); onChange(); };
  return (
    <section>
      <div className="sec-head"><div><h3>Organizations</h3><p className="muted">Each organization has its own folder tree and image library.</p></div></div>
      <form className="inline-form" onSubmit={async (e) => { e.preventDefault(); if (await act(() => api('/admin/orgs', { method: 'POST', body: { name } }), 'Organization created')) { setName(''); done(); } }}>
        <input placeholder="New organization name" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn primary" disabled={!name.trim()}>Create organization</button></form>
      {q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> : q.loading && !q.data ? <Spinner /> : !q.data.organizations.length ? <Empty title="No organizations">Create the first one above.</Empty> : (
        <div className="table-wrap"><table><thead><tr><th>Name</th><th>Folders</th><th>Images</th><th></th></tr></thead><tbody>
          {q.data.organizations.map((o) => (
            <tr key={o.id}><td><strong>{o.name}</strong></td><td>{o.folders}</td><td>{o.images}</td>
              <td className="right"><button className="btn sm" onClick={() => setRenameOrg(o)}>Rename</button>
                <button className="btn sm danger" onClick={() => setDeleteOrg(o)}>Delete</button></td></tr>))}
        </tbody></table></div>)}
      {renameOrg && <RenameDialog title="Rename organization" initialValue={renameOrg.name} onClose={() => setRenameOrg(null)}
        onSave={async (value) => { const ok = await act(() => api(`/admin/orgs/${renameOrg.id}`, { method: 'PATCH', body: { name: value } }), 'Organization renamed'); if (ok) done(); return ok; }} />}
      {deleteOrg && <DeleteDialog title="Delete organization?" description="Its folders and images will also be deleted." onClose={() => setDeleteOrg(null)}
        onDelete={async () => { const ok = await act(() => api(`/admin/orgs/${deleteOrg.id}`, { method: 'DELETE' }), 'Organization deleted'); if (ok) done(); return ok; }} />}
    </section>
  );
}

function Folders({ orgs }) {
  const [orgId, setOrgId] = useState('');
  const oid = orgId || orgs[0]?.id;
  const q = useLoad(() => (oid ? api(`/admin/folders?orgId=${oid}`) : Promise.resolve({ folders: [] })), [oid]);
  const act = useAct();
  const [add, setAdd] = useState(null);
  const [renameFolder, setRenameFolder] = useState(null);
  const [deleteFolder, setDeleteFolder] = useState(null);
  if (!orgs.length) return <Empty title="No organizations">Create an organization first.</Empty>;
  const folders = q.data?.folders || [];
  const depth = (f) => f.code.split('.').length - 1;
  return (
    <section>
      <div className="sec-head folder-sec-head"><div><h3>Folders</h3><p className="muted">Folders are numbered automatically: 1, 1.1, 1.2, 2…</p>
          <button className="btn primary folder-create-top" onClick={() => setAdd({ parentId: null, name: '', label: 'Create top-level folder' })}>Create top-level folder</button></div>
        <select value={oid} onChange={(e) => setOrgId(Number(e.target.value))} aria-label="Organization">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
      {q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> : q.loading ? <Spinner /> : !folders.length ? <Empty title="No folders yet">Add a top-level folder to start organizing images.</Empty> : (
        <ul className="admin-tree">{folders.map((f) => (
          <li key={f.id} style={{ paddingLeft: depth(f) * 22 }}><span className="code">{f.code}</span><strong>{f.name}</strong><span className="muted">{f.images} images</span>
            <FolderActions items={[
              { label: 'Create subfolder', onSelect: () => setAdd({ parentId: f.id, name: '', label: `Subfolder of ${f.code} ${f.name}` }) },
              { label: 'Rename folder', onSelect: () => setRenameFolder(f) },
              { label: 'Delete folder', danger: true, onSelect: () => setDeleteFolder(f) },
            ]} /></li>))}</ul>)}
      {add && <Modal title={add.label} onClose={() => setAdd(null)} footer={<><button className="btn" onClick={() => setAdd(null)}>Cancel</button>
        <button className="btn primary" disabled={!add.name.trim()} onClick={async () => (await act(() => api('/admin/folders', { method: 'POST', body: { orgId: oid, parentId: add.parentId, name: add.name } }), 'Folder created')) && (setAdd(null), q.reload())}>Create folder</button></>}>
        <label>Folder name<input autoFocus value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} /></label></Modal>}
      {renameFolder && <RenameDialog title="Rename folder" initialValue={renameFolder.name} onClose={() => setRenameFolder(null)}
        onSave={async (value) => { const ok = await act(() => api(`/admin/folders/${renameFolder.id}`, { method: 'PATCH', body: { name: value } }), 'Folder renamed'); if (ok) q.reload(); return ok; }} />}
      {deleteFolder && <DeleteDialog title="Delete folder?" description="The folder must be empty before it can be deleted." onClose={() => setDeleteFolder(null)}
        onDelete={async () => { const ok = await act(() => api(`/admin/folders/${deleteFolder.id}`, { method: 'DELETE' }), 'Folder deleted'); if (ok) q.reload(); return ok; }} />}
    </section>
  );
}

function Access({ orgs }) {
  const users = useLoad(() => api('/admin/users'), []);
  const [uid, setUid] = useState('');
  const [orgId, setOrgId] = useState('');
  const [folderId, setFolderId] = useState('');
  const [perms, setPerms] = useState(['view', 'download']);
  const act = useAct();
  const list = (users.data?.users || []).filter((u) => u.role !== 'admin');
  const user = list.find((u) => u.id === Number(uid)) || list[0];
  const oid = Number(orgId) || orgs[0]?.id;
  const grants = useLoad(() => (user ? api(`/admin/grants?userId=${user.id}`) : Promise.resolve({ grants: [] })), [user?.id]);
  const fl = useLoad(() => (oid ? api(`/admin/folders?orgId=${oid}`) : Promise.resolve({ folders: [] })), [oid]);
  const allowed = user?.role === 'customer' ? ['view', 'download'] : PERMS.map((p) => p[0]);
  const eff = perms.filter((p) => allowed.includes(p));

  if (users.loading && !users.data) return <Spinner />;
  if (users.error) return <ErrorBox message={users.error} onRetry={users.reload} />;
  if (!list.length || !orgs.length) return <Empty title="Nothing to assign yet">Access grants need at least one non-admin user and one organization. Administrators already see everything.</Empty>;
  return (
    <section>
      <div className="sec-head"><div><h3>Access</h3><p className="muted">A grant on a folder also applies to everything inside it. Choose “Entire organization” to cover all folders.</p></div></div>
      <div className="access-grid">
        <div className="panel">
          <label>User<select value={user.id} onChange={(e) => setUid(e.target.value)}>{list.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}</select></label>
          <h4>Current grants</h4>
          {grants.loading ? <Spinner /> : !grants.data.grants.length ? <p className="muted">No access granted. This user sees nothing yet.</p> : (
            <ul className="grants">{grants.data.grants.map((g) => (
              <li key={g.id}><div><strong>{g.orgName}</strong> / {g.folderLabel}<div className="tags">{g.perms.map((p) => <span key={p} className="tag">{p}</span>)}</div></div>
                <button className="btn sm danger" onClick={async () => (await act(() => api(`/admin/grants/${g.id}`, { method: 'DELETE' }), 'Access removed')) && grants.reload()}>Remove</button></li>))}</ul>)}
        </div>
        <div className="panel">
          <h4>Grant access</h4>
          <label>Organization<select value={oid} onChange={(e) => { setOrgId(e.target.value); setFolderId(''); }}>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
          <label>Folder<select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">Entire organization</option>{(fl.data?.folders || []).map((f) => <option key={f.id} value={f.id}>{'— '.repeat(f.code.split('.').length - 1)}{f.code} {f.name}</option>)}</select></label>
          <fieldset><legend>Permissions</legend>{PERMS.map(([k, l]) => (
            <label key={k} className="check"><input type="checkbox" disabled={k === 'view' || !allowed.includes(k)} checked={k === 'view' || eff.includes(k)}
              onChange={(e) => setPerms(e.target.checked ? [...perms, k] : perms.filter((p) => p !== k))} />{l}{!allowed.includes(k) && <em className="muted"> (not for customers)</em>}</label>))}</fieldset>
          <button className="btn primary block" onClick={async () => (await act(() => api('/admin/grants', { method: 'PUT', body: { userId: user.id, orgId: oid, folderId: folderId ? Number(folderId) : null, perms: eff } }), 'Access saved')) && grants.reload()}>Save access</button>
        </div>
      </div>
    </section>
  );
}

export default function Admin({ me }) {
  if (me.role !== 'admin') return <StaffSetup />;
  return <FullAdmin me={me} />;
}

function FullAdmin({ me }) {
  const [tab, setTab] = useState('users');
  const orgs = useLoad(() => api('/admin/orgs'), []);
  const list = orgs.data?.organizations || [];
  const tabs = { users: 'Users', orgs: 'Organizations', folders: 'Folders', access: 'Access' };
  return (
    <div className="admin pad">
      <div className="tabs wide">{Object.entries(tabs).map(([k, v]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{v}</button>)}</div>
      {tab === 'users' && <Users me={me} />}
      {tab === 'orgs' && <Orgs onChange={orgs.reload} />}
      {tab === 'folders' && <Folders orgs={list} />}
      {tab === 'access' && <Access orgs={list} />}
    </div>
  );
}

function StaffSetup() {
  const access = useLoad(() => api('/admin/manage/access'), []);
  const act = useAct();
  const [tab, setTab] = useState('orgs');
  const [orgName, setOrgName] = useState('');
  const [orgId, setOrgId] = useState('');
  const [folderName, setFolderName] = useState('');
  const [folderAdd, setFolderAdd] = useState(null);
  const canCreateOrg = !!access.data?.canCreateOrg;
  const canCreateFolders = !!access.data?.canCreateFolders;
  const orgs = access.data?.organizations || [];
  const org = orgs.find((o) => o.id === Number(orgId)) || orgs[0];
  const tabs = { ...(canCreateOrg ? { orgs: 'Organizations' } : {}), ...(canCreateFolders ? { folders: 'Folders' } : {}) };

  React.useEffect(() => { if (!tabs[tab]) setTab(Object.keys(tabs)[0] || ''); }, [access.data]);
  const reload = () => access.reload();
  const createOrg = async (e) => {
    e.preventDefault();
    if (await act(() => api('/admin/manage/orgs', { method: 'POST', body: { name: orgName } }), 'Organization created')) {
      setOrgName(''); reload();
    }
  };
  const createFolder = async () => {
    if (!org) return;
    if (await act(() => api('/admin/manage/folders', { method: 'POST', body: { orgId: org.id, parentId: folderAdd.parentId, name: folderName } }), 'Folder created')) {
      setFolderName(''); setFolderAdd(null); reload();
    }
  };

  if (access.loading && !access.data) return <Spinner />;
  if (access.error) return <div className="admin pad"><ErrorBox message={access.error} onRetry={reload} /></div>;
  if (!Object.keys(tabs).length) return <div className="admin pad"><Empty title="No setup permissions">Ask an administrator to enable organization or folder creation for your account.</Empty></div>;

  return <div className="admin pad">
    <div className="tabs wide">{Object.entries(tabs).map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === 'orgs' && canCreateOrg && <section>
      <div className="sec-head"><div><h3>Create organization</h3><p className="muted">You can create organizations. Administrators control renaming, deletion, and access grants.</p></div></div>
      <form className="inline-form" onSubmit={createOrg}><input placeholder="Organization name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
        <button className="btn primary" disabled={!orgName.trim()}>Create organization</button></form>
    </section>}
    {tab === 'folders' && canCreateFolders && <section>
      <div className="sec-head folder-sec-head"><div><h3>Folders</h3><p className="muted">Use a folder’s action menu to add a subfolder. Administrators manage folder names and deletion.</p>
          {org?.canCreateRoot && <button className="btn primary folder-create-top" onClick={() => { setFolderName(''); setFolderAdd({ parentId: null, title: 'Create top-level folder' }); }}>Create top-level folder</button>}</div>
        {orgs.length > 0 && <select value={org?.id || ''} onChange={(e) => setOrgId(Number(e.target.value))} aria-label="Organization">
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}
      </div>
      {!orgs.length ? <Empty title="No folders available">Ask an administrator to grant you access to an organization or folder.</Empty>
        : !org?.folders.length ? <Empty title="No accessible folders yet">Ask an administrator to grant you view access to a folder.</Empty> : (
          <ul className="admin-tree">{org.folders.map((f) => <li key={f.id} style={{ paddingLeft: (f.code.split('.').length - 1) * 22 }}>
            <span className="code">{f.code}</span><strong>{f.name}</strong><span className="grow" />
            <FolderActions items={[{ label: 'Create subfolder', onSelect: () => { setFolderName(''); setFolderAdd({ parentId: f.id, title: `Subfolder of ${f.code} ${f.name}` }); } }]} />
          </li>)}</ul>)}
      {folderAdd && <Modal title={folderAdd.title} onClose={() => setFolderAdd(null)} footer={<>
        <button className="btn" onClick={() => setFolderAdd(null)}>Cancel</button>
        <button className="btn primary" disabled={!folderName.trim()} onClick={createFolder}>Create folder</button></>}>
        <label>Folder name<input autoFocus value={folderName} onChange={(e) => setFolderName(e.target.value)} /></label>
      </Modal>}
    </section>}
  </div>;
}
