/**
 * LocalStorageAdapter - 默认 Adapter
 *
 * 只读写 localStorage。单人本地使用，零依赖，零配置。
 * 适合：个人评审、单机场景、不希望搭后端
 *
 * 用法：
 *   // 不传 adapter 时，store 会自动用这个
 *   <DesignReviewApp config={{ storageKey: 'myapp_v1', ... }} />
 */
import type {
  SyncAdapter, SyncAdapterContext, SyncData, SyncEvent,
  PageAnnotation, SnapAnnotation, Snapshot,
} from '../types';

export class LocalStorageAdapter implements SyncAdapter {
  private storageKey = '';

  init(ctx: SyncAdapterContext) {
    this.storageKey = ctx.storageKey;
  }

  async load(): Promise<SyncData> {
    return {
      pageAnnos: readJSON(`${this.storageKey}_pageAnnos`, {}),
      snaps:     readJSON(`${this.storageKey}_snaps`, []),
      snapAnnos: readJSON(`${this.storageKey}_snapAnnos`, {}),
    };
  }

  async push(event: SyncEvent): Promise<void> {
    /* 简单粗暴：每次变更都重写整块数据
       对性能不敏感场景足够；如果标注特别多可以改成批量 */
    switch (event.t) {
      case 'pageAnno:add':
      case 'pageAnno:update':
      case 'pageAnno:delete': {
        const all = readJSON<Record<string, PageAnnotation[]>>(
          `${this.storageKey}_pageAnnos`, {});
        const list = all[event.frameKey] || [];
        if (event.t === 'pageAnno:add') {
          all[event.frameKey] = [...list, event.data];
        } else if (event.t === 'pageAnno:update') {
          all[event.frameKey] = list.map(a =>
            a.id === event.id ? { ...a, ...event.patch } : a);
        } else {
          all[event.frameKey] = list.filter(a => a.id !== event.id);
        }
        writeJSON(`${this.storageKey}_pageAnnos`, all);
        return;
      }
      case 'snap:add':
      case 'snap:delete':
      case 'snap:updateNote': {
        const snaps = readJSON<Snapshot[]>(`${this.storageKey}_snaps`, []);
        let next: Snapshot[];
        if (event.t === 'snap:add') {
          next = [event.data, ...snaps];
        } else if (event.t === 'snap:delete') {
          next = snaps.filter(s => s.id !== event.id);
          /* 同时删关联标注 */
          const sa = readJSON<Record<string, SnapAnnotation[]>>(
            `${this.storageKey}_snapAnnos`, {});
          delete sa[event.id];
          writeJSON(`${this.storageKey}_snapAnnos`, sa);
        } else {
          next = snaps.map(s => s.id === event.id ? { ...s, note: event.note } : s);
        }
        writeJSON(`${this.storageKey}_snaps`, next);
        return;
      }
      case 'snapAnno:add':
      case 'snapAnno:update':
      case 'snapAnno:delete': {
        const all = readJSON<Record<string, SnapAnnotation[]>>(
          `${this.storageKey}_snapAnnos`, {});
        const list = all[event.snapId] || [];
        if (event.t === 'snapAnno:add') {
          all[event.snapId] = [...list, event.data];
        } else if (event.t === 'snapAnno:update') {
          all[event.snapId] = list.map(a =>
            a.id === event.id ? { ...a, ...event.patch } : a);
        } else {
          all[event.snapId] = list.filter(a => a.id !== event.id);
        }
        writeJSON(`${this.storageKey}_snapAnnos`, all);
        return;
      }
    }
  }

  /* LocalStorage 是单端的，没有 subscribe */
}

/* ---------- helpers ---------- */

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    /* 防止超大数据（旧版 bug）卡住 */
    if (raw.length > 20 * 1024 * 1024) {
      console.warn(`[LocalStorageAdapter] ${key} too large, clearing`);
      localStorage.removeItem(key);
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('[LocalStorageAdapter] quota exceeded:', e);
  }
}
