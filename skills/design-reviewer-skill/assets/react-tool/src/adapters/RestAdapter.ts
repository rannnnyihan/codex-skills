/**
 * RestAdapter - 通过 REST API 同步评审数据
 *
 * 后端需要实现 4 个接口：
 *   GET  {baseUrl}/reviews/:storageKey          → { pageAnnos, snaps, snapAnnos }
 *   POST {baseUrl}/reviews/:storageKey/events   ← { t: 'pageAnno:add', ... }（单个事件）
 *   GET  {baseUrl}/reviews/:storageKey/events?since=123  → 轮询增量（可选）
 *
 * 使用：
 *   import { createRestAdapter } from 'design-reviewer/adapters';
 *
 *   <DesignReviewApp config={{
 *     storageKey: 'myapp_v1',
 *     adapter: createRestAdapter({
 *       baseUrl: 'https://your-api.com',
 *       pollInterval: 10000,  // 每 10 秒轮询一次（可选）
 *     }),
 *     ...
 *   }} />
 */
import type {
  SyncAdapter, SyncAdapterContext, SyncData, SyncEvent,
} from '../types';

export interface RestAdapterOptions {
  baseUrl: string;
  /** 请求头（比如 Authorization） */
  headers?: Record<string, string>;
  /** 轮询间隔（ms），不填则不轮询 */
  pollInterval?: number;
}

export function createRestAdapter(opts: RestAdapterOptions): SyncAdapter {
  let ctx: SyncAdapterContext;
  let lastSyncedAt = 0;
  let pollTimer: any = null;
  let subHandler: ((e: SyncEvent | { t: 'snapshot'; data: SyncData }) => void) | null = null;

  function headers() {
    return {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    };
  }

  return {
    async init(c: SyncAdapterContext) {
      ctx = c;
    },

    async load(): Promise<SyncData> {
      const url = `${opts.baseUrl}/reviews/${encodeURIComponent(ctx.storageKey)}`;
      const resp = await fetch(url, { headers: headers() });
      if (!resp.ok) {
        if (resp.status === 404) {
          // 该 storageKey 尚无数据，返回空
          return { pageAnnos: {}, snaps: [], snapAnnos: {} };
        }
        throw new Error(`load failed: ${resp.status}`);
      }
      const data = (await resp.json()) as SyncData;
      lastSyncedAt = Date.now();
      return {
        pageAnnos: data.pageAnnos || {},
        snaps: data.snaps || [],
        snapAnnos: data.snapAnnos || {},
      };
    },

    async push(event: SyncEvent): Promise<void> {
      const url = `${opts.baseUrl}/reviews/${encodeURIComponent(ctx.storageKey)}/events`;
      await fetch(url, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          ...event,
          by: ctx.user.nickname,
          at: Date.now(),
        }),
      });
    },

    subscribe(handler) {
      subHandler = handler;
      if (!opts.pollInterval) return () => { subHandler = null; };

      pollTimer = setInterval(async () => {
        try {
          const url = `${opts.baseUrl}/reviews/${encodeURIComponent(ctx.storageKey)}/events?since=${lastSyncedAt}`;
          const resp = await fetch(url, { headers: headers() });
          if (!resp.ok) return;
          const events = (await resp.json()) as SyncEvent[];
          lastSyncedAt = Date.now();
          for (const e of events) {
            subHandler?.(e);
          }
        } catch (err) {
          console.warn('[RestAdapter] poll error:', err);
        }
      }, opts.pollInterval);

      return () => {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
        subHandler = null;
      };
    },

    destroy() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      subHandler = null;
    },
  };
}
