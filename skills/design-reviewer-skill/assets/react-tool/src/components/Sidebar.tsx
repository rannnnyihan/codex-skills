/** Sidebar - 根据 mode 展示页面列表 或 快照列表 */
import React from 'react';
import { useReviewStore, normalizeFrameKey } from '../store';

export function Sidebar() {
  const mode = useReviewStore(s => s.mode);
  return (
    <aside className="rv-sidebar">
      {mode === 'pages' ? <PagesList /> : <SnapsList />}
    </aside>
  );
}

/* ========== Pages ========== */
function PagesList() {
  const config = useReviewStore(s => s.config);
  const pageAnnos = useReviewStore(s => s.pageAnnos);
  const currentPageKey = useReviewStore(s => s.currentPageKey);
  const openPage = useReviewStore(s => s.openPage);

  return (
    <div className="rv-list">
      <div className="rv-list-head">页面导航</div>
      {config.pages.map(group => (
        <div key={group.group} className="rv-group">
          <div className="rv-group-title">{group.group}</div>
          {group.items.map(item => {
            const fk = normalizeFrameKey(item.file);
            const count = (pageAnnos[fk] || []).length;
            const active = currentPageKey === item.key;
            const hasSub = !!(item.sub && item.sub.length);
            return (
              <React.Fragment key={item.key}>
                <button
                  className={`rv-item ${active ? 'active' : ''}`}
                  onClick={() => openPage(item.key)}
                  type="button"
                >
                  <span className="rv-item-icon">
                    {hasSub ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 15l3 3 3-3"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
                    )}
                  </span>
                  <span className="rv-item-name" title={item.desc || ''}>{item.name}</span>
                  {count > 0 && <span className="rv-badge">{count}</span>}
                </button>
                {item.sub?.map(sub => {
                  const sfk = normalizeFrameKey(sub.file);
                  const scount = (pageAnnos[sfk] || []).length;
                  const sactive = currentPageKey === sub.key;
                  return (
                    <button
                      key={sub.key}
                      className={`rv-item rv-item-sub ${sactive ? 'active' : ''}`}
                      onClick={() => openPage(sub.key)}
                      type="button"
                    >
                      <span className="rv-item-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                      </span>
                      <span className="rv-item-name" title={sub.desc || ''}>{sub.name}</span>
                      {scount > 0 && <span className="rv-badge">{scount}</span>}
                    </button>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ========== Snaps ========== */
function SnapsList() {
  const snaps = useReviewStore(s => s.snaps);
  const snapAnnos = useReviewStore(s => s.snapAnnos);
  const currentSnapId = useReviewStore(s => s.currentSnapId);
  const openSnap = useReviewStore(s => s.openSnap);
  const deleteSnap = useReviewStore(s => s.deleteSnap);
  const showToast = useReviewStore(s => s.showToast);

  function clearAll() {
    if (!window.confirm(`清空全部 ${snaps.length} 张快照？\n关联标注也会一并删除`)) return;
    const state = useReviewStore.getState();
    snaps.forEach(s => deleteSnap(s.id));
    showToast('已清空');
  }

  if (snaps.length === 0) {
    return (
      <div className="rv-list">
        <div className="rv-list-head">快照</div>
        <div className="rv-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <div className="rv-empty-title">暂无快照</div>
          <div className="rv-empty-sub">切到页面模式，点击"截取"按钮<br/>可为当前页拍照</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rv-list">
      <div className="rv-list-head">
        <span>快照 · {snaps.length}</span>
        <button className="rv-clear-btn" onClick={clearAll} type="button">清空</button>
      </div>
      {snaps.map(snap => {
        const count = (snapAnnos[snap.id] || []).length;
        const active = currentSnapId === snap.id;
        return (
          <div
            key={snap.id}
            className={`rv-snap-item ${active ? 'active' : ''}`}
            onClick={() => openSnap(snap.id)}
            role="button"
            tabIndex={0}
          >
            <div className="rv-snap-thumb">
              <img src={snap.imgData} alt="" loading="lazy" />
            </div>
            <div className="rv-snap-info">
              <div className="rv-snap-name">{snap.pageName}</div>
              <div className="rv-snap-time">{formatTime(snap.createdAt)}</div>
              {count > 0 && <span className="rv-badge">{count}</span>}
            </div>
            <button
              className="rv-snap-del"
              onClick={(e) => {
                e.stopPropagation();
                if (!window.confirm(`删除这张快照？\n（${count} 条关联标注也会一起删除）`)) return;
                deleteSnap(snap.id);
                showToast('已删除');
              }}
              title="删除快照"
              type="button"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
