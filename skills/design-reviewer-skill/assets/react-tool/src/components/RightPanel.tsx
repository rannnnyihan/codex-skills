/** RightPanel - 根据 mode 展示对应的标注列表 */
import React, { useMemo } from 'react';
import { useReviewStore, normalizeFrameKey, findPage, colorFromName } from '../store';
import { TYPE_META } from '../constants';
import type { PageAnnotation, SnapAnnotation, FilterType, AnnoType } from '../types';

export function RightPanel() {
  const mode = useReviewStore(s => s.mode);
  return (
    <aside className="rv-right">
      <FilterBar />
      {mode === 'pages' ? <PageAnnoList /> : <SnapAnnoList />}
    </aside>
  );
}

/* ==== Filter ==== */
function FilterBar() {
  const filter = useReviewStore(s => s.filter);
  const setFilter = useReviewStore(s => s.setFilter);
  const items: Array<{ k: FilterType; label: string }> = [
    { k: 'all',      label: '全部' },
    { k: 'interact', label: '交互' },
    { k: 'bug',      label: '问题' },
    { k: 'suggest',  label: '建议' },
    { k: 'intent',   label: '设计意图' },
  ];
  return (
    <div className="rv-filter">
      {items.map(it => (
        <button
          key={it.k}
          className={`rv-chip ${filter === it.k ? 'on' : ''}`}
          onClick={() => setFilter(it.k)}
          type="button"
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* ==== Pages ==== */
function PageAnnoList() {
  const config = useReviewStore(s => s.config);
  const pageAnnos = useReviewStore(s => s.pageAnnos);
  const currentPageKey = useReviewStore(s => s.currentPageKey);
  const filter = useReviewStore(s => s.filter);

  /* 只展示当前页的标注 */
  const page = currentPageKey ? findPage(config.pages, currentPageKey) : null;
  const frameKey = page ? normalizeFrameKey(page.file) : '';
  const list = useMemo(() => pageAnnos[frameKey] || [], [pageAnnos, frameKey]);
  const filtered = useMemo(
    () => filter === 'all' ? list : list.filter(a => a.type === filter),
    [list, filter]
  );

  if (!page) {
    return (
      <div className="rv-right-body">
        <div className="rv-right-head">评论与标注</div>
        <Empty title="请先选择一个页面" />
      </div>
    );
  }

  return (
    <div className="rv-right-body">
      <div className="rv-right-head">
        <span>{page.name}</span>
        <span className="rv-right-count">{filtered.length}{filtered.length !== list.length ? `/${list.length}` : ''} 条</span>
      </div>
      {filtered.length === 0 ? (
        <Empty title={list.length === 0 ? '暂无标注' : '当前筛选无结果'} sub={list.length === 0 ? '开启"标注模式"点击页面组件' : undefined} />
      ) : (
        <div className="rv-annos">
          {filtered.map((a, i) => (
            <PageAnnoRow key={a.id} anno={a} idx={list.indexOf(a)} frameKey={frameKey} />
          ))}
        </div>
      )}
    </div>
  );
}

function PageAnnoRow({ anno, idx, frameKey }: {
  anno: PageAnnotation; idx: number; frameKey: string;
}) {
  const meta = TYPE_META[anno.type] || TYPE_META.interact;
  const setEditing = useReviewStore(s => s.setEditing);
  return (
    <button
      className="rv-anno-row"
      onClick={() => setEditing({ scope: 'page', bucketKey: frameKey, annoId: anno.id })}
      type="button"
    >
      <span className={`rv-anno-num t-${anno.type}`}>{idx + 1}</span>
      <div className="rv-anno-body">
        <div className="rv-anno-header">
          <span className={`rv-anno-type t-${anno.type}`}>{meta.label}</span>
          {anno.author && (
            <span className="rv-anno-author">
              <span className="rv-avatar rv-avatar-xs" style={{ background: colorFromName(anno.author) }}>
                {anno.author.slice(0, 1).toUpperCase()}
              </span>
              {anno.author}
            </span>
          )}
        </div>
        <div className="rv-anno-text">
          {anno.text || <span className="rv-anno-empty">(未填写)</span>}
        </div>
        {anno.targetSummary && (
          <div className="rv-anno-target" title={anno.selector || ''}>{anno.targetSummary}</div>
        )}
        <div className="rv-anno-time">{formatTime(anno.createdAt)}</div>
      </div>
    </button>
  );
}

/* ==== Snaps ==== */
function SnapAnnoList() {
  const snaps = useReviewStore(s => s.snaps);
  const snapAnnos = useReviewStore(s => s.snapAnnos);
  const currentSnapId = useReviewStore(s => s.currentSnapId);
  const updateSnapNote = useReviewStore(s => s.updateSnapNote);
  const filter = useReviewStore(s => s.filter);
  const showToast = useReviewStore(s => s.showToast);

  const snap = currentSnapId ? snaps.find(s => s.id === currentSnapId) : null;
  const list = useMemo(
    () => (currentSnapId && snapAnnos[currentSnapId]) || [],
    [snapAnnos, currentSnapId]
  );
  const filtered = useMemo(
    () => filter === 'all' ? list : list.filter(a => a.type === filter),
    [list, filter]
  );

  const [note, setNote] = React.useState('');
  React.useEffect(() => { setNote(snap?.note || ''); }, [snap?.id]);

  if (!snap) {
    return (
      <div className="rv-right-body">
        <div className="rv-right-head">快照标注</div>
        <Empty title={snaps.length === 0 ? '暂无快照' : '请选择快照'} />
      </div>
    );
  }

  return (
    <div className="rv-right-body">
      <div className="rv-right-head">
        <span>{snap.pageName}</span>
        <span className="rv-right-count">{filtered.length}{filtered.length !== list.length ? `/${list.length}` : ''} 条</span>
      </div>

      {/* 快照信息 */}
      <div className="rv-snap-meta">
        <div className="rv-snap-meta-time">{new Date(snap.createdAt).toLocaleString('zh-CN')}</div>
        <textarea
          className="rv-snap-note"
          placeholder="快照说明..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => { updateSnapNote(snap.id, note); showToast('已保存'); }}
        />
      </div>

      {filtered.length === 0 ? (
        <Empty title={list.length === 0 ? '暂无标注' : '当前筛选无结果'} sub={list.length === 0 ? '开启"标注模式"点击快照放置' : undefined} />
      ) : (
        <div className="rv-annos">
          {filtered.map(a => (
            <SnapAnnoRow key={a.id} anno={a} idx={list.indexOf(a)} snapId={snap.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function SnapAnnoRow({ anno, idx, snapId }: {
  anno: SnapAnnotation; idx: number; snapId: string;
}) {
  const meta = TYPE_META[anno.type] || TYPE_META.interact;
  const setEditing = useReviewStore(s => s.setEditing);
  return (
    <button
      className="rv-anno-row"
      onClick={() => setEditing({ scope: 'snap', bucketKey: snapId, annoId: anno.id })}
      type="button"
    >
      <span className={`rv-anno-num t-${anno.type}`}>{idx + 1}</span>
      <div className="rv-anno-body">
        <div className="rv-anno-header">
          <span className={`rv-anno-type t-${anno.type}`}>{meta.label}</span>
          {anno.author && (
            <span className="rv-anno-author">
              <span className="rv-avatar rv-avatar-xs" style={{ background: colorFromName(anno.author) }}>
                {anno.author.slice(0, 1).toUpperCase()}
              </span>
              {anno.author}
            </span>
          )}
        </div>
        <div className="rv-anno-text">
          {anno.text || <span className="rv-anno-empty">(未填写)</span>}
        </div>
        <div className="rv-anno-time">{formatTime(anno.createdAt)}</div>
      </div>
    </button>
  );
}

/* ==== Empty / Utils ==== */
function Empty({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="rv-empty">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div className="rv-empty-title">{title}</div>
      {sub && <div className="rv-empty-sub">{sub}</div>}
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
