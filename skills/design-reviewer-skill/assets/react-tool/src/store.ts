/**
 * Design Review Tool - Zustand Store (v3)
 *
 * 变化相对 v2：
 *  - 标注带 author 字段，自动注入 currentUser.nickname
 *  - 通过 SyncAdapter 插件化后端（默认 LocalStorageAdapter）
 *  - 支持 subscribe 回流远端事件
 */
import { create } from 'zustand';
import type {
  PageAnnotation, SnapAnnotation, Snapshot,
  PageGroup, PageItem, ReviewConfig,
  ViewMode, FilterType, ToastMessage, EditingRef,
  CurrentUser, SyncAdapter, SyncData, SyncEvent, SyncSnapshotEvent,
} from './types';
import { DEFAULT_CONFIG, TYPE_META } from './constants';
import { LocalStorageAdapter } from './adapters/LocalStorageAdapter';

/* ---------- 用户昵称持久化 ---------- */

const USER_KEY = '__review_user__';

export function loadUser(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.nickname === 'string') return parsed;
  } catch {}
  return null;
}

export function saveUser(user: CurrentUser | null) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

/** 昵称 → 颜色（固定映射） */
export function colorFromName(name: string): string {
  const palette = [
    '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
    '#ef4444', '#ec4899', '#14b8a6', '#6366f1',
    '#84cc16', '#f97316',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

/* ---------- URL / Page helpers ---------- */

export function normalizeFrameKey(href?: string): string {
  if (!href) return '';
  try {
    const origin = typeof window !== 'undefined'
      ? window.location.origin + window.location.pathname
      : 'http://localhost';
    const u = new URL(href, origin);
    const seg = u.pathname.split('/').filter(Boolean).pop() || '';
    return seg + (u.search || '');
  } catch { return href || ''; }
}

export function findPage(pages: PageGroup[], key: string): PageItem | null {
  for (const g of pages) {
    const it = g.items.find(x => x.key === key);
    if (it) return it;
    for (const p of g.items) {
      if (p.sub) {
        const sub = p.sub.find(x => x.key === key);
        if (sub) return sub;
      }
    }
  }
  return null;
}

export function buildSelector(el: Element): string | null {
  if (!el || el.nodeType !== 1) return null;
  if (el.id && /^[a-zA-Z_][\w-]*$/.test(el.id)) return '#' + CSS.escape(el.id);
  const parts: string[] = [];
  let cur: Element | null = el;
  const doc = cur.ownerDocument!;
  while (cur && cur.nodeType === 1 && cur !== doc.body && cur !== doc.documentElement) {
    let part = cur.tagName.toLowerCase();
    if (cur.id && /^[a-zA-Z_][\w-]*$/.test(cur.id)) {
      return '#' + CSS.escape(cur.id) + (parts.length ? ' > ' + parts.join(' > ') : '');
    }
    if (cur.classList.length > 0) {
      const cls = Array.from(cur.classList)
        .filter(c => !/^(hover|active|on|flash|vis|open|collapsed|show)$/.test(c))
        .slice(0, 2);
      if (cls.length > 0) part += '.' + cls.map(c => CSS.escape(c)).join('.');
    }
    if (cur.parentElement) {
      const idx = Array.from(cur.parentElement.children).indexOf(cur) + 1;
      part += `:nth-child(${idx})`;
    }
    parts.unshift(part);
    cur = cur.parentElement;
    if (parts.length >= 6) break;
  }
  return parts.join(' > ');
}

export function summarizeEl(el: Element): string {
  if (!el) return '';
  const tag = el.tagName.toLowerCase();
  const id = el.id ? '#' + el.id : '';
  const cls = el.classList.length ? '.' + Array.from(el.classList).slice(0, 2).join('.') : '';
  let txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 20);
  if (txt && el.textContent!.length > 20) txt += '\u2026';
  return `<${tag}${id}${cls}>` + (txt ? ` "${txt}"` : '');
}

/* ---------- store ---------- */

type PageAnnoMap = Record<string, PageAnnotation[]>;
type SnapAnnoMap = Record<string, SnapAnnotation[]>;

interface ReviewStore {
  /* 配置 + 当前用户 */
  config: ReviewConfig;
  setConfig: (cfg: Partial<ReviewConfig>) => void;
  user: CurrentUser | null;
  setUser: (u: CurrentUser | null) => void;

  /* 视图模式 */
  mode: ViewMode;
  setMode: (m: ViewMode) => void;

  currentPageKey: string | null;
  openPage: (key: string) => void;

  currentSnapId: string | null;
  openSnap: (id: string | null) => void;

  /* 数据 */
  pageAnnos: PageAnnoMap;
  snaps: Snapshot[];
  snapAnnos: SnapAnnoMap;

  /* 业务 actions（会同时写本地和调 adapter） */
  addPageAnno: (frameKey: string, data: Omit<PageAnnotation, 'id' | 'createdAt' | 'author'>) => string;
  updatePageAnno: (frameKey: string, id: string, patch: Partial<PageAnnotation>) => void;
  deletePageAnno: (frameKey: string, id: string) => void;

  addSnap: (data: Omit<Snapshot, 'id' | 'createdAt' | 'author'>) => string;
  deleteSnap: (id: string) => void;
  updateSnapNote: (id: string, note: string) => void;

  addSnapAnno: (snapId: string, data: Omit<SnapAnnotation, 'id' | 'createdAt' | 'author'>) => string;
  updateSnapAnno: (snapId: string, id: string, patch: Partial<SnapAnnotation>) => void;
  deleteSnapAnno: (snapId: string, id: string) => void;

  /* UI 状态 */
  annoMode: boolean;
  toggleAnnoMode: () => void;

  filter: FilterType;
  setFilter: (f: FilterType) => void;

  editing: EditingRef | null;
  setEditing: (e: EditingRef | null) => void;

  leftCollapsed: boolean;
  rightCollapsed: boolean;
  toggleLeft: () => void;
  toggleRight: () => void;

  toasts: ToastMessage[];
  showToast: (msg: string) => void;

  /* Adapter（内部） */
  _adapter: SyncAdapter | null;
  _unsubscribe: (() => void) | null;
  /** 初始化 adapter（首次 setUser 后调用） */
  _initAdapter: () => Promise<void>;
  /** 应用远端事件到本地（不回推 adapter） */
  _applyRemoteEvent: (e: SyncEvent | SyncSnapshotEvent) => void;
}

export const useReviewStore = create<ReviewStore>((set, get) => ({
  config: DEFAULT_CONFIG,
  user: loadUser(),

  setConfig: (patch) => {
    set(s => ({ config: { ...s.config, ...patch } }));
    get()._initAdapter();
  },

  setUser: (u) => {
    saveUser(u);
    set({ user: u });
    get()._initAdapter();
  },

  mode: 'pages',
  setMode: (m) => set({ mode: m, editing: null, annoMode: false }),

  currentPageKey: null,
  openPage: (key) => set(s => {
    if (!findPage(s.config.pages, key)) return {};
    return { currentPageKey: key, mode: 'pages', editing: null };
  }),

  currentSnapId: null,
  openSnap: (id) => set({ currentSnapId: id, mode: 'snaps', editing: null }),

  pageAnnos: {},
  snaps: [],
  snapAnnos: {},

  /* ========== Page Annos ========== */
  addPageAnno: (frameKey, data) => {
    const id = `pa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const author = get().user?.nickname || '匿名';
    const anno: PageAnnotation = { ...data, id, createdAt: Date.now(), author };
    set(s => ({
      pageAnnos: { ...s.pageAnnos, [frameKey]: [...(s.pageAnnos[frameKey] || []), anno] },
      editing: { scope: 'page', bucketKey: frameKey, annoId: id },
    }));
    get()._adapter?.push({ t: 'pageAnno:add', frameKey, data: anno }).catch(console.warn);
    return id;
  },

  updatePageAnno: (frameKey, id, patch) => {
    const finalPatch = { ...patch, updatedAt: Date.now() };
    set(s => {
      const list = (s.pageAnnos[frameKey] || []).map(a =>
        a.id === id ? { ...a, ...finalPatch } : a);
      return { pageAnnos: { ...s.pageAnnos, [frameKey]: list } };
    });
    get()._adapter?.push({ t: 'pageAnno:update', frameKey, id, patch: finalPatch }).catch(console.warn);
  },

  deletePageAnno: (frameKey, id) => {
    set(s => {
      const list = (s.pageAnnos[frameKey] || []).filter(a => a.id !== id);
      return {
        pageAnnos: { ...s.pageAnnos, [frameKey]: list },
        editing: s.editing?.annoId === id ? null : s.editing,
      };
    });
    get()._adapter?.push({ t: 'pageAnno:delete', frameKey, id }).catch(console.warn);
  },

  /* ========== Snaps ========== */
  addSnap: (data) => {
    const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const author = get().user?.nickname || '匿名';
    const snap: Snapshot = { ...data, id, createdAt: Date.now(), author };
    set(s => ({ snaps: [snap, ...s.snaps] }));
    get()._adapter?.push({ t: 'snap:add', data: snap }).catch(console.warn);
    return id;
  },

  deleteSnap: (id) => {
    set(s => {
      const newSnapAnnos = { ...s.snapAnnos };
      delete newSnapAnnos[id];
      return {
        snaps: s.snaps.filter(x => x.id !== id),
        snapAnnos: newSnapAnnos,
        currentSnapId: s.currentSnapId === id ? null : s.currentSnapId,
        editing: s.editing?.bucketKey === id ? null : s.editing,
      };
    });
    get()._adapter?.push({ t: 'snap:delete', id }).catch(console.warn);
  },

  updateSnapNote: (id, note) => {
    set(s => ({ snaps: s.snaps.map(x => x.id === id ? { ...x, note } : x) }));
    get()._adapter?.push({ t: 'snap:updateNote', id, note }).catch(console.warn);
  },

  /* ========== Snap Annos ========== */
  addSnapAnno: (snapId, data) => {
    const id = `sa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const author = get().user?.nickname || '匿名';
    const anno: SnapAnnotation = { ...data, id, createdAt: Date.now(), author };
    set(s => ({
      snapAnnos: { ...s.snapAnnos, [snapId]: [...(s.snapAnnos[snapId] || []), anno] },
      editing: { scope: 'snap', bucketKey: snapId, annoId: id },
    }));
    get()._adapter?.push({ t: 'snapAnno:add', snapId, data: anno }).catch(console.warn);
    return id;
  },

  updateSnapAnno: (snapId, id, patch) => {
    const finalPatch = { ...patch, updatedAt: Date.now() };
    set(s => {
      const list = (s.snapAnnos[snapId] || []).map(a =>
        a.id === id ? { ...a, ...finalPatch } : a);
      return { snapAnnos: { ...s.snapAnnos, [snapId]: list } };
    });
    get()._adapter?.push({ t: 'snapAnno:update', snapId, id, patch: finalPatch }).catch(console.warn);
  },

  deleteSnapAnno: (snapId, id) => {
    set(s => {
      const list = (s.snapAnnos[snapId] || []).filter(a => a.id !== id);
      return {
        snapAnnos: { ...s.snapAnnos, [snapId]: list },
        editing: s.editing?.annoId === id ? null : s.editing,
      };
    });
    get()._adapter?.push({ t: 'snapAnno:delete', snapId, id }).catch(console.warn);
  },

  /* ========== UI ========== */
  annoMode: false,
  toggleAnnoMode: () => set(s => ({ annoMode: !s.annoMode, editing: null })),

  filter: 'all',
  setFilter: (f) => set({ filter: f }),

  editing: null,
  setEditing: (e) => set({ editing: e }),

  leftCollapsed: false,
  rightCollapsed: false,
  toggleLeft: () => set(s => ({ leftCollapsed: !s.leftCollapsed })),
  toggleRight: () => set(s => ({ rightCollapsed: !s.rightCollapsed })),

  toasts: [],
  showToast: (msg) => {
    const id = Date.now();
    set(s => ({ toasts: [...s.toasts.slice(-4), { id, msg }] }));
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
    }, 2200);
  },

  /* ========== Adapter (internal) ========== */
  _adapter: null,
  _unsubscribe: null,

  _initAdapter: async () => {
    const { config, user, _unsubscribe, _applyRemoteEvent } = get();

    /* 清理旧 adapter */
    if (_unsubscribe) _unsubscribe();
    const prev = get()._adapter;
    if (prev?.destroy) await prev.destroy();

    /* 创建新 adapter（用户传的，或默认 LocalStorageAdapter） */
    const adapter = config.adapter || new LocalStorageAdapter();
    const ctx = {
      storageKey: config.storageKey,
      user: user || { nickname: '匿名', color: colorFromName('匿名') },
      log: (m: string) => console.log('[Review]', m),
      toast: (m: string) => get().showToast(m),
    };
    if (adapter.init) await adapter.init(ctx);

    /* 加载远端数据 */
    try {
      const data = await adapter.load();
      set({
        pageAnnos: data.pageAnnos || {},
        snaps: data.snaps || [],
        snapAnnos: data.snapAnnos || {},
      });
    } catch (err) {
      console.warn('[Review] load failed:', err);
    }

    /* 订阅远端事件 */
    let unsub: (() => void) | null = null;
    if (adapter.subscribe) {
      unsub = adapter.subscribe((e) => _applyRemoteEvent(e));
    }

    set({ _adapter: adapter, _unsubscribe: unsub });
  },

  _applyRemoteEvent: (e) => {
    set(s => {
      /* snapshot 全量覆盖 */
      if (e.t === 'snapshot') {
        return {
          pageAnnos: e.data.pageAnnos || {},
          snaps: e.data.snaps || [],
          snapAnnos: e.data.snapAnnos || {},
        };
      }
      /* 增量事件 */
      switch (e.t) {
        case 'pageAnno:add': {
          const list = s.pageAnnos[e.frameKey] || [];
          if (list.find(a => a.id === e.data.id)) return {};  // 已有，跳过
          return { pageAnnos: { ...s.pageAnnos, [e.frameKey]: [...list, e.data] } };
        }
        case 'pageAnno:update': {
          const list = (s.pageAnnos[e.frameKey] || []).map(a =>
            a.id === e.id ? { ...a, ...e.patch } : a);
          return { pageAnnos: { ...s.pageAnnos, [e.frameKey]: list } };
        }
        case 'pageAnno:delete': {
          const list = (s.pageAnnos[e.frameKey] || []).filter(a => a.id !== e.id);
          return { pageAnnos: { ...s.pageAnnos, [e.frameKey]: list } };
        }
        case 'snap:add':
          if (s.snaps.find(x => x.id === e.data.id)) return {};
          return { snaps: [e.data, ...s.snaps] };
        case 'snap:delete': {
          const newSA = { ...s.snapAnnos };
          delete newSA[e.id];
          return {
            snaps: s.snaps.filter(x => x.id !== e.id),
            snapAnnos: newSA,
          };
        }
        case 'snap:updateNote':
          return { snaps: s.snaps.map(x => x.id === e.id ? { ...x, note: e.note } : x) };
        case 'snapAnno:add': {
          const list = s.snapAnnos[e.snapId] || [];
          if (list.find(a => a.id === e.data.id)) return {};
          return { snapAnnos: { ...s.snapAnnos, [e.snapId]: [...list, e.data] } };
        }
        case 'snapAnno:update': {
          const list = (s.snapAnnos[e.snapId] || []).map(a =>
            a.id === e.id ? { ...a, ...e.patch } : a);
          return { snapAnnos: { ...s.snapAnnos, [e.snapId]: list } };
        }
        case 'snapAnno:delete': {
          const list = (s.snapAnnos[e.snapId] || []).filter(a => a.id !== e.id);
          return { snapAnnos: { ...s.snapAnnos, [e.snapId]: list } };
        }
      }
      return {};
    });
  },
}));
