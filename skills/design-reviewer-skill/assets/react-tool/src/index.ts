/** Design Reviewer - entry */
export { DesignReviewApp, default } from './App';

/* Adapter 工厂（使用者按需导入） */
export {
  LocalStorageAdapter,
  createRestAdapter,
  createWebSocketAdapter,
} from './adapters';
export type { RestAdapterOptions, WebSocketAdapterOptions } from './adapters';

/* 类型（供用户实现自定义 Adapter） */
export type {
  SyncAdapter,
  SyncAdapterContext,
  SyncData,
  SyncEvent,
  SyncSnapshotEvent,
  PageAnnotation,
  SnapAnnotation,
  Snapshot,
  CurrentUser,
  ReviewConfig,
} from './types';
