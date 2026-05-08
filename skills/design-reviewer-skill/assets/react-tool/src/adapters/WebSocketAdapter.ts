/**
 * WebSocketAdapter - 基于 WebSocket 的实时协作 Adapter
 *
 * 后端需要：
 *   1. 接受 WebSocket 连接 wss://xxx?key={storageKey}&user={nickname}
 *   2. 连接成功后先推一条 { type: 'snapshot', data: { pageAnnos, snaps, snapAnnos } }
 *   3. 收到客户端 event → 持久化 → 广播给房间内其他连接
 *
 * 协议：
 *   C → S: { t: 'pageAnno:add', frameKey, data, by, at }
 *   S → C: { type: 'snapshot', data } | { type: 'event', event }
 *
 * 使用：
 *   import { createWebSocketAdapter } from 'design-reviewer/adapters';
 *
 *   adapter: createWebSocketAdapter({ wsUrl: 'wss://your-api.com/review' })
 */
import type {
  SyncAdapter, SyncAdapterContext, SyncData, SyncEvent, SyncSnapshotEvent,
} from '../types';

export interface WebSocketAdapterOptions {
  wsUrl: string;
  /** 掉线重连基础间隔（ms），默认 1500 */
  reconnectBase?: number;
  /** 最大重连间隔（ms），默认 30000 */
  reconnectMax?: number;
}

export function createWebSocketAdapter(opts: WebSocketAdapterOptions): SyncAdapter {
  let ctx: SyncAdapterContext;
  let ws: WebSocket | null = null;
  let subHandler: ((e: SyncEvent | SyncSnapshotEvent) => void) | null = null;
  let reconnectTimer: any = null;
  let heartbeatTimer: any = null;
  let reconnectDelay = opts.reconnectBase || 1500;
  const maxDelay = opts.reconnectMax || 30000;
  let closedByUser = false;
  let pendingSnapshot: Promise<SyncData>;
  let resolveSnapshot: ((d: SyncData) => void) | null = null;

  function buildUrl() {
    const u = new URL(opts.wsUrl);
    u.searchParams.set('key', ctx.storageKey);
    u.searchParams.set('user', ctx.user.nickname);
    return u.toString();
  }

  function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    try {
      ws = new WebSocket(buildUrl());
    } catch (err) {
      console.error('[WSAdapter] create failed:', err);
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      ctx.log('WebSocket connected');
      reconnectDelay = opts.reconnectBase || 1500;
      startHeartbeat();
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'snapshot' && resolveSnapshot) {
          /* 首次 snapshot，resolve pending promise */
          resolveSnapshot(msg.data);
          resolveSnapshot = null;
        } else if (msg.type === 'snapshot') {
          /* 后续 snapshot（服务端发的重同步信号） */
          subHandler?.({ t: 'snapshot', data: msg.data });
        } else if (msg.type === 'event' && msg.event) {
          subHandler?.(msg.event as SyncEvent);
        }
      } catch (err) {
        console.warn('[WSAdapter] invalid message:', ev.data);
      }
    };

    ws.onerror = (err) => console.warn('[WSAdapter] error:', err);

    ws.onclose = () => {
      stopHeartbeat();
      ws = null;
      if (!closedByUser) {
        ctx.log('WebSocket disconnected, reconnecting...');
        scheduleReconnect();
      }
    };
  }

  function scheduleReconnect() {
    if (closedByUser) return;
    stopReconnect();
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 1.5, maxDelay);
      connect();
    }, reconnectDelay);
  }

  function stopReconnect() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ t: '__ping__' })); } catch {}
      }
    }, 25000);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  }

  return {
    async init(c) {
      ctx = c;
      closedByUser = false;

      /* 建立一个 promise，等 connect 收到 snapshot 后 resolve */
      pendingSnapshot = new Promise<SyncData>((resolve) => {
        resolveSnapshot = resolve;
        /* 兜底：5 秒内没有 snapshot 返回空（服务端不发就用空数据） */
        setTimeout(() => {
          if (resolveSnapshot) {
            resolveSnapshot({ pageAnnos: {}, snaps: [], snapAnnos: {} });
            resolveSnapshot = null;
          }
        }, 5000);
      });

      connect();
    },

    async load() {
      return pendingSnapshot;
    },

    async push(event: SyncEvent) {
      if (ws?.readyState !== WebSocket.OPEN) return;
      try {
        ws.send(JSON.stringify({
          ...event,
          by: ctx.user.nickname,
          at: Date.now(),
        }));
      } catch (err) {
        console.warn('[WSAdapter] send failed:', err);
      }
    },

    subscribe(handler) {
      subHandler = handler;
      return () => { subHandler = null; };
    },

    async destroy() {
      closedByUser = true;
      stopHeartbeat();
      stopReconnect();
      if (ws) { ws.close(); ws = null; }
      subHandler = null;
    },
  };
}
