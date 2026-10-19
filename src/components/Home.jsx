import React from 'react';
import { api } from '../api.js';
import { Empty, ErrorBox, Icon, Spinner, formatDate, useLoad } from '../ui.jsx';

export default function Home({ user, onWorkspace, onAdmin }) {
  const tree = useLoad(() => api('/workspace/tree'), []);
  const organizations = tree.data?.organizations || [];
  const orgKey = organizations.map((org) => org.id).join(',');
  const recent = useLoad(async () => {
    if (!organizations.length) return { items: [] };
    const pages = await Promise.all(organizations.map((org) => api(`/workspace/images?orgId=${org.id}&sort=newest&limit=5`)));
    return { items: pages.flatMap((page) => page.items || [])
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6) };
  }, [orgKey]);

  const folders = organizations.flatMap((org) => org.folders
    .filter((folder) => folder.perms.includes('view'))
    .map((folder) => ({ ...folder, orgId: org.id, orgName: org.name })));
  const imageCount = folders.reduce((total, folder) => total + Number(folder.count || 0), 0);
  const locationFor = (image) => {
    const folder = folders.find((item) => item.id === image.folderId);
    return folder ? `${folder.code} ${folder.name}` : 'Your workspace';
  };
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const canOpenAdmin = user.role === 'admin' || user.canCreateOrg || user.canCreateFolders;

  if (tree.loading && !tree.data) return <div className="home-loading"><Spinner label="Loading your home…" /></div>;
  if (tree.error) return <div className="home-page"><ErrorBox message={tree.error} onRetry={tree.reload} /></div>;

  return <div className="home-page">
    <section className="home-hero">
      <div>
        <span className="home-eyebrow">DOCUVAULT WORKSPACE</span>
        <h1>{greeting}, {user.name}</h1>
        <p>Find and manage your document images from one organized workspace.</p>
      </div>
      <button className="btn primary" onClick={onWorkspace}><Icon name="image" size={16} />Open workspace</button>
    </section>

    <section className="home-stats" aria-label="Workspace summary">
      <article className="home-stat"><span>Accessible images</span><strong>{imageCount.toLocaleString()}</strong><small>Across folders you can view</small></article>
      <article className="home-stat"><span>Organizations</span><strong>{organizations.length.toLocaleString()}</strong><small>Available to your account</small></article>
      <article className="home-stat"><span>Folders</span><strong>{folders.length.toLocaleString()}</strong><small>With view access</small></article>
    </section>

    <section className="home-content-grid">
      <article className="home-card home-recent">
        <div className="home-card-head"><div><h2>Recent uploads</h2><p>Latest images in folders you can view.</p></div>
          <button className="link" onClick={onWorkspace}>Browse all</button></div>
        {recent.loading && !recent.data ? <Spinner label="Loading recent uploads…" /> : recent.error ? <ErrorBox message={recent.error} onRetry={recent.reload} />
          : !recent.data?.items.length ? <Empty title="No uploads yet">Uploaded images will appear here.</Empty> : (
            <ul className="home-recent-list">{recent.data.items.map((image) => {
              const folder = folders.find((item) => item.id === image.folderId);
              return <li key={image.id}><button className="home-recent-item" onClick={() => {
                if (folder) onWorkspace(folder.orgId, folder.id);
                else onWorkspace();
              }}>
                <span className="home-file-icon"><Icon name="image" size={17} /></span>
                <span className="home-file-text"><strong>{image.documentId}</strong><small>{image.title || image.originalName}</small></span>
                <span className="home-file-location">{locationFor(image)}</span>
                <time>{formatDate(image.createdAt)}</time>
              </button></li>;
            })}</ul>)}
      </article>

      <aside className="home-card home-about">
        <span className="home-eyebrow">YOUR DOCUMENT LIBRARY</span>
        <h2>Everything in its place</h2>
        <p>Browse previews, view image details, and use the actions your folder access allows.</p>
        <div className="home-feature"><Icon name="folder" size={17} /><span>Organized by organization and folder</span></div>
        <div className="home-feature"><Icon name="download" size={17} /><span>Web, HD, and original image versions</span></div>
        {canOpenAdmin && <button className="btn home-admin-link" onClick={onAdmin}>{user.role === 'admin' ? 'Open administration' : 'Open setup tools'}<Icon name="chevron" size={16} /></button>}
      </aside>
    </section>
  </div>;
}
