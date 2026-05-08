/**
 * Adapters - 可选的后端同步方案
 *
 * - LocalStorageAdapter：默认 Adapter，纯本地（单人使用）
 * - createRestAdapter：接入任意 REST API（简单，支持轮询同步）
 * - createWebSocketAdapter：WebSocket 实时协作（完整体验）
 *
 * 你也可以实现自己的 SyncAdapter，只要符合 `types.ts` 里的接口即可。
 * 参考 assets/backend-examples/ 下的服务端实现示例（SCF / CloudBase / Node.js）。
 */
export { LocalStorageAdapter } from './LocalStorageAdapter';
export { createRestAdapter, type RestAdapterOptions } from './RestAdapter';
export { createWebSocketAdapter, type WebSocketAdapterOptions } from './WebSocketAdapter';
