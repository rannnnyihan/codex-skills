/** Topbar - 全局工具栏 */
import React from 'react';
import html2canvas from 'html2canvas';
import { useReviewStore, findPage } from '../store';

export function Topbar() {
  const config = useReviewStore(s => s.config);
  const mode = useReviewStore(s => s.mode);
  const setMode = useReviewStore(s => s.setMode);
  const annoMode = useReviewStore(s => s.annoMode);
  const toggleAnnoMode = useReviewStore(s => s.toggleAnnoMode);
  const toggleLeft = useReviewStore(s => s.toggleLeft);
  const toggleRight = useReviewStore(s => s.toggleRight);
  const leftCollapsed = useReviewStore(s => s.leftCollapsed);
  const rightCollapsed = useReviewStore(s => s.rightCollapsed);
  const currentPageKey = useReviewStore(s => s.currentPageKey);
  const currentSnapId = useReviewStore(s => s.currentSnapId);
  const addSnap = useReviewStore(s => s.addSnap);
  const openSnap = useReviewStore(s => s.openSnap);
  const showToast = useReviewStore(s => s.showToast);
  const snapsCount = useReviewStore(s => s.snaps.length);
  const pageAnnos = useReviewStore(s => s.pageAnnos);
  const snapAnnos = useReviewStore(s => s.snapAnnos);
  const snaps = useReviewStore(s => s.snaps);

  /* 截取当前 iframe 快照 */
  async function captureSnap() {
    if (mode !== 'pages') { showToast('请先切到页面模式'); return; }
    const iframe = document.querySelector('.rv-frame') as HTMLIFrameElement | null;
    const doc = iframe?.contentDocument;
    const win = iframe?.contentWindow;
    if (!iframe || !doc || !win || !doc.body) {
      showToast('未找到可截图的页面'); return;
    }

    const pg = currentPageKey ? findPage(config.pages, currentPageKey) : null;
    const pageName = pg?.name || '未知页面';
    showToast('正在截取...');

    try {
      const maxWidth = 1400;
      const bodyW = doc.body.scrollWidth || win.innerWidth;
      const scale = bodyW > maxWidth ? maxWidth / bodyW : 1;
      const canvas = await html2canvas(doc.body, {
        useCORS: true, allowTaint: true,
        backgroundColor: '#ffffff',
        scale,
        windowWidth: win.innerWidth,
        windowHeight: win.innerHeight,
        logging: false,
        height: Math.min(doc.body.scrollHeight, win.innerHeight * 3),
      } as any);
      const imgData = canvas.toDataURL('image/jpeg', 0.7);
      const id = addSnap({
        pageKey: currentPageKey || '',
        pageName,
        imgData,
        note: '',
      });
      showToast('快照已保存');
      /* 可选：自动切到快照模式 */
      setTimeout(() => { openSnap(id); }, 200);
    } catch (err) {
      console.error(err);
      showToast('快照失败：' + (err as Error).message);
    }
  }

  /* 导出 JSON */
  function exportJSON() {
    const data = {
      product: config.productName,
      exportedAt: new Date().toISOString(),
      pageAnnos,
      snaps: snaps.map(s => ({ ...s, imgData: '[omitted]' })),
      snapAnnos,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `review-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已导出');
  }

  const canAnno = (mode === 'pages' && currentPageKey) || (mode === 'snaps' && currentSnapId);

  return (
    <div className="rv-topbar">
      <div className="rv-logo">
        <span className="rv-logo-dot" />
        <span className="rv-logo-name">{config.productName}</span>
      </div>

      {/* 模式切换 Tabs */}
      <div className="rv-mode-tabs">
        <button
          className={`rv-mode-tab ${mode === 'pages' ? 'active' : ''}`}
          onClick={() => setMode('pages')}
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>
          </svg>
          页面
        </button>
        <button
          className={`rv-mode-tab ${mode === 'snaps' ? 'active' : ''}`}
          onClick={() => setMode('snaps')}
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          快照
          {snapsCount > 0 && <span className="rv-mode-tab-count">{snapsCount}</span>}
        </button>
      </div>

      <div className="rv-spacer" />

      {/* 标注模式 */}
      <button
        className={`rv-btn rv-btn-icon ${annoMode ? 'active' : ''} ${canAnno ? '' : 'disabled'}`}
        onClick={() => canAnno && toggleAnnoMode()}
        title="标注模式 (A)"
        type="button"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
        {annoMode ? '退出标注' : '标注模式'}
      </button>

      {/* 截取快照（仅在页面模式下可用） */}
      {mode === 'pages' && (
        <button
          className={`rv-btn rv-btn-icon ${currentPageKey ? '' : 'disabled'}`}
          onClick={() => currentPageKey && captureSnap()}
          title="截取当前页快照"
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          截取
        </button>
      )}

      <button className="rv-btn" onClick={exportJSON} type="button">导出</button>

      <div className="rv-sep" />

      {/* 当前用户头像 */}
      <UserAvatar />

      <div className="rv-sep" />

      <button
        className={`rv-btn rv-btn-icon ${leftCollapsed ? 'active' : ''}`}
        onClick={toggleLeft}
        title="切换左侧栏 (⌘[)"
        type="button"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
        </svg>
      </button>
      <button
        className={`rv-btn rv-btn-icon ${rightCollapsed ? 'active' : ''}`}
        onClick={toggleRight}
        title="切换右侧栏 (⌘])"
        type="button"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/>
        </svg>
      </button>
    </div>
  );
}

/* ========== User Avatar ========== */
function UserAvatar() {
  const user = useReviewStore(s => s.user);
  const setUser = useReviewStore(s => s.setUser);
  const [open, setOpen] = React.useState(false);

  if (!user) return null;

  function handleLogout() {
    if (!window.confirm('切换账号将清除当前昵称，确认继续？')) return;
    setUser(null);
    setOpen(false);
  }

  return (
    <div className="rv-user-wrap">
      <button
        className="rv-user-btn"
        onClick={() => setOpen(v => !v)}
        title={user.nickname}
        type="button"
      >
        <span className="rv-avatar" style={{ background: user.color }}>
          {user.nickname.slice(0, 1).toUpperCase()}
        </span>
        <span className="rv-user-name">{user.nickname}</span>
      </button>
      {open && (
        <>
          <div className="rv-user-mask" onClick={() => setOpen(false)} />
          <div className="rv-user-menu">
            <div className="rv-user-menu-head">
              <span className="rv-avatar" style={{ background: user.color, width: 36, height: 36, fontSize: 14 }}>
                {user.nickname.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <div className="rv-user-menu-name">{user.nickname}</div>
                <div className="rv-user-menu-sub">当前评审人</div>
              </div>
            </div>
            <button className="rv-user-menu-item" onClick={handleLogout} type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              切换昵称
            </button>
          </div>
        </>
      )}
    </div>
  );
}
