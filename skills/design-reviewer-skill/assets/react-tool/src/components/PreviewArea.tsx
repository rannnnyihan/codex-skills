/** PreviewArea - 根据 mode 分发到 IframePage / SnapView */
import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useReviewStore, buildSelector, summarizeEl, normalizeFrameKey, findPage } from '../store';
import { TYPE_META } from '../constants';

export function PreviewArea() {
  const mode = useReviewStore(s => s.mode);
  if (mode === 'snaps') return <SnapView />;
  return <IframePage />;
}

/* ================================================
 * 模式 1：iframe 页面预览
 * ================================================ */
function IframePage() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  const config = useReviewStore(s => s.config);
  const currentPageKey = useReviewStore(s => s.currentPageKey);
  const pageAnnos = useReviewStore(s => s.pageAnnos);
  const annoMode = useReviewStore(s => s.annoMode);
  const editing = useReviewStore(s => s.editing);
  const addPageAnno = useReviewStore(s => s.addPageAnno);
  const setEditing = useReviewStore(s => s.setEditing);

  const page = useMemo(
    () => currentPageKey ? findPage(config.pages, currentPageKey) : null,
    [config.pages, currentPageKey]
  );
  const frameKey = page ? normalizeFrameKey(page.file) : '';
  const annos = useMemo(() => pageAnnos[frameKey] || [], [pageAnnos, frameKey]);

  /* 加载页面 */
  useEffect(() => {
    const f = frameRef.current;
    if (!f || !page) return;
    try {
      const cur = normalizeFrameKey(f.contentWindow?.location.href);
      if (cur !== frameKey) {
        f.src = 'about:blank';
        setTimeout(() => { if (f) f.src = page.file; }, 20);
      }
    } catch {
      f.src = page.file;
    }
  }, [page?.key, page?.file, frameKey]);

  /* 绑定 iframe 内的点击事件 */
  const onIframeLoad = useCallback(() => {
    const f = frameRef.current;
    if (!f) return;
    let doc: Document | null = null;
    let win: Window | null = null;
    try {
      doc = f.contentDocument;
      win = f.contentWindow;
    } catch { return; }
    if (!doc || !win) return;

    function handler(e: MouseEvent) {
      const st = useReviewStore.getState();
      if (!st.annoMode || st.mode !== 'pages') return;
      if (!st.currentPageKey) return;

      const pg = findPage(st.config.pages, st.currentPageKey);
      if (!pg) return;
      const fk = normalizeFrameKey(pg.file);

      e.preventDefault(); e.stopPropagation();
      const el = e.target as Element;
      if (!el || el.nodeType !== 1) return;

      const r = el.getBoundingClientRect();
      const xInEl = r.width ? ((e.clientX - r.left) / r.width) * 100 : 50;
      const yInEl = r.height ? ((e.clientY - r.top) / r.height) * 100 : 50;
      const winW = win!.innerWidth || 1;
      const winH = win!.innerHeight || 1;

      addPageAnno(fk, {
        type: 'interact',
        text: '',
        selector: buildSelector(el),
        targetSummary: summarizeEl(el),
        xInEl: Math.round(xInEl * 100) / 100,
        yInEl: Math.round(yInEl * 100) / 100,
        xInFrame: Math.round((e.clientX / winW) * 10000) / 100,
        yInFrame: Math.round((e.clientY / winH) * 10000) / 100,
      });
    }
    doc.addEventListener('click', handler, true);

    /* 滚动时刷新 pin 位置 */
    const onScroll = () => renderPins();
    win.addEventListener('scroll', onScroll, true);

    (f as any).__cleanup = () => {
      try { doc?.removeEventListener('click', handler, true); } catch {}
      try { win?.removeEventListener('scroll', onScroll, true); } catch {}
    };

    renderPins();
  }, [addPageAnno]);

  /* 渲染 pin 到 overlay 层 */
  function renderPins() {
    const layer = layerRef.current;
    const frame = frameRef.current;
    if (!layer || !frame) return;
    /* 清空旧 pin */
    Array.from(layer.querySelectorAll('.rv-pin')).forEach(n => n.remove());

    const st = useReviewStore.getState();
    if (st.mode !== 'pages' || !st.currentPageKey) return;
    const pg = findPage(st.config.pages, st.currentPageKey);
    if (!pg) return;
    const fk = normalizeFrameKey(pg.file);
    const list = st.pageAnnos[fk] || [];
    if (list.length === 0) return;

    let doc: Document | null = null;
    try { doc = frame.contentDocument; } catch { return; }
    if (!doc) return;

    const frameRect = frame.getBoundingClientRect();
    const layerRect = layer.getBoundingClientRect();

    list.forEach((a, idx) => {
      let vpLeft: number | undefined, vpTop: number | undefined;
      if (a.selector) {
        try {
          const el = doc!.querySelector(a.selector);
          if (el) {
            const r = el.getBoundingClientRect();
            if (!(r.width < 1 && r.height < 1)) {
              vpLeft = frameRect.left + r.left + (a.xInEl / 100) * r.width;
              vpTop = frameRect.top + r.top + (a.yInEl / 100) * r.height;
            }
          }
        } catch {}
      }
      if (vpLeft === undefined) {
        vpLeft = frameRect.left + (a.xInFrame / 100) * frameRect.width;
        vpTop = frameRect.top + (a.yInFrame / 100) * frameRect.height;
      }
      if (vpLeft < frameRect.left - 10 || vpLeft > frameRect.right + 10) return;
      if (vpTop! < frameRect.top - 10 || vpTop! > frameRect.bottom + 10) return;

      const localLeft = vpLeft - layerRect.left;
      const localTop = vpTop! - layerRect.top;
      const p = document.createElement('div');
      const isEditing = st.editing?.scope === 'page' && st.editing.annoId === a.id;
      p.className = `rv-pin t-${a.type}` + (isEditing ? ' editing' : '');
      p.style.left = localLeft + 'px';
      p.style.top = localTop + 'px';
      p.textContent = String(idx + 1);
      p.addEventListener('click', (ev) => {
        ev.stopPropagation();
        useReviewStore.getState().setEditing({
          scope: 'page', bucketKey: fk, annoId: a.id,
        });
      });
      layer.appendChild(p);
    });
  }

  /* annos / editing 变化时重新渲染 pin */
  useEffect(() => {
    renderPins();
  }, [annos, editing?.annoId]);

  if (!page) {
    return (
      <div className="rv-preview">
        <div className="rv-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
          </svg>
          <div className="rv-empty-title">请从左侧选择页面</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rv-preview ${annoMode ? 'anno-on' : ''}`}>
      <iframe
        ref={frameRef}
        className="rv-frame"
        onLoad={onIframeLoad}
        title="page-preview"
      />
      <div ref={layerRef} className={`rv-anno-layer ${annoMode ? 'active' : ''}`}>
        {annoMode && (
          <div className="rv-anno-hint">标注模式 · 点击页面元素 · Esc 退出</div>
        )}
      </div>
    </div>
  );
}

/* ================================================
 * 模式 2：快照预览
 * ================================================ */
function SnapView() {
  const currentSnapId = useReviewStore(s => s.currentSnapId);
  const snaps = useReviewStore(s => s.snaps);
  const snapAnnos = useReviewStore(s => s.snapAnnos);
  const annoMode = useReviewStore(s => s.annoMode);
  const editing = useReviewStore(s => s.editing);
  const addSnapAnno = useReviewStore(s => s.addSnapAnno);
  const setEditing = useReviewStore(s => s.setEditing);
  const openSnap = useReviewStore(s => s.openSnap);

  const snap = useMemo(
    () => currentSnapId ? snaps.find(s => s.id === currentSnapId) : null,
    [snaps, currentSnapId]
  );
  const annos = useMemo(
    () => (currentSnapId && snapAnnos[currentSnapId]) || [],
    [snapAnnos, currentSnapId]
  );

  const imgRef = useRef<HTMLImageElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => { setImgLoaded(false); }, [currentSnapId]);

  /* 自动选中第一个快照 */
  useEffect(() => {
    if (!currentSnapId && snaps.length > 0) {
      openSnap(snaps[0].id);
    }
  }, [currentSnapId, snaps, openSnap]);

  if (!snap) {
    return (
      <div className="rv-preview">
        <div className="rv-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <div className="rv-empty-title">{snaps.length === 0 ? '暂无快照' : '请从左侧选择快照'}</div>
          {snaps.length === 0 && (
            <div className="rv-empty-sub">切到"页面"模式点"截取"按钮保存快照</div>
          )}
        </div>
      </div>
    );
  }

  function onImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!annoMode || !snap) return;
    const img = imgRef.current;
    if (!img) return;
    const r = img.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right ||
        e.clientY < r.top || e.clientY > r.bottom) return;
    const xPct = ((e.clientX - r.left) / r.width) * 100;
    const yPct = ((e.clientY - r.top) / r.height) * 100;
    addSnapAnno(snap.id, {
      type: 'interact',
      text: '',
      xPct: Math.round(xPct * 100) / 100,
      yPct: Math.round(yPct * 100) / 100,
    });
  }

  return (
    <div className={`rv-preview rv-snap-preview ${annoMode ? 'anno-on' : ''}`}>
      <div className="rv-snap-stage" onClick={onImageClick}>
        <img
          ref={imgRef}
          src={snap.imgData}
          alt={snap.pageName}
          className="rv-snap-img"
          onLoad={() => setImgLoaded(true)}
          draggable={false}
        />
        {imgLoaded && annos.map((a, idx) => {
          const isEditing = editing?.scope === 'snap' && editing.annoId === a.id;
          return (
            <div
              key={a.id}
              className={`rv-pin t-${a.type} ${isEditing ? 'editing' : ''}`}
              style={{ left: `${a.xPct}%`, top: `${a.yPct}%` }}
              onClick={(ev) => {
                ev.stopPropagation();
                setEditing({ scope: 'snap', bucketKey: snap.id, annoId: a.id });
              }}
            >
              {idx + 1}
            </div>
          );
        })}
      </div>
      {annoMode && (
        <div className="rv-anno-hint rv-snap-hint">标注模式 · 点击图片位置放置 · Esc 退出</div>
      )}
    </div>
  );
}
