/**
 * Design Review Tool - Type Definitions (v3 - author + pluggable backend)
 */

export type AnnoType = 'interact' | 'bug' | 'suggest' | 'intent';

export interface TypeMeta {
  label: string;
  color: string;
}

/** 页面上的标注 */
export interface PageAnnotation {
  id: string;
  type: AnnoType;
  text: string;
  createdAt: number;
  updatedAt?: number;
  author?: string;              // 创建者昵称（v3 新增）
  selector: string | null;
  targetSummary: string | null;
  xInEl: number;
  yInEl: number;
  xInFrame: number;
  yInFrame: number;
}

/** 快照上的标注 */
export interface SnapAnnotation {
  id: string;
  type: AnnoType;
  text: string;
  createdAt: number;
  updatedAt?: number;
  author?: string;              // v3 新增
  xPct: number;
  yPct: number;
}

/** 页面配置 */
export interface PageItem {
  key: string;
  file: string;
  name: string;
  desc?: string;
  sub?: PageItem[];
}

export interface PageGroup {
  group: string;
  items: PageItem[];
}

/** 快照 */
export interface Snapshot {
  id: string;
  pageKey: string;
  pageName: string;
  imgData: string;
  createdAt: number;
  author?: string;              // v3 新增：谁截的图
  note: string;
}

/** 当前用户 */
export interface CurrentUser {
  nickname: string;
  color: string;        // 由昵称 hash 出来的固定色
}

/** 工具全局配置 */
export interface ReviewConfig {
  productName: string;
  storageKey: string;
  pages: PageGroup[];
  /** v3 新增：自定义后端（不传 = 纯本地模式） */
  adapter?: SyncAdapter;
}

export interface EditingRef {
  scope: 'page' | 'snap';
  bucketKey: string;
  annoId: string;
}

export type ViewMode = 'pages' | 'snaps';
export type FilterType = AnnoType | 'all';

export interface ToastMessage {
  id: number;
  msg: string;
}

/* ====================================================
 *  SyncAdapter - 可插拔后端接口
 * ==================================================== */

/** 所有需要同步的数据 */
export interface SyncData {
  pageAnnos: Record<string, PageAnnotation[]>;
  snaps: Snapshot[];
  snapAnnos: Record<string, SnapAnnotation[]>;
}

/**
 * 后端适配器接口
 *
 * 最少只需实现 `load` 和 `save`，就能获得跨端/多人查看能力。
 * 想要真正实时协作，额外实现 `subscribe`（WebSocket/SSE/long polling）。
 *
 * 实现示例：见 assets/backend-examples/
 */
export interface SyncAdapter {
  /** 初始化（可选，连接 WS、检查登录等） */
  init?(ctx: SyncAdapterContext): void | Promise<void>;

  /** 加载远端全部数据（初次进入时调用一次） */
  load(): Promise<SyncData>;

  /** 推送单条变更 */
  push(event: SyncEvent): Promise<void>;

  /** 订阅其他用户的变更（可选，不实现则无实时同步）
   *  返回取消订阅函数
   */
  subscribe?(handler: (event: SyncEvent | SyncSnapshotEvent) => void): () => void;

  /** 销毁（断开连接等） */
  destroy?(): void | Promise<void>;
}

/** Adapter 可以使用的上下文（由 store 注入） */
export interface SyncAdapterContext {
  storageKey: string;
  user: CurrentUser;
  /** 框架提供的日志函数 */
  log: (msg: string) => void;
  /** 显示 toast */
  toast: (msg: string) => void;
}

/** 同步事件（增量变更） */
export type SyncEvent =
  | { t: 'pageAnno:add'; frameKey: string; data: PageAnnotation }
  | { t: 'pageAnno:update'; frameKey: string; id: string; patch: Partial<PageAnnotation> }
  | { t: 'pageAnno:delete'; frameKey: string; id: string }
  | { t: 'snap:add'; data: Snapshot }
  | { t: 'snap:delete'; id: string }
  | { t: 'snap:updateNote'; id: string; note: string }
  | { t: 'snapAnno:add'; snapId: string; data: SnapAnnotation }
  | { t: 'snapAnno:update'; snapId: string; id: string; patch: Partial<SnapAnnotation> }
  | { t: 'snapAnno:delete'; snapId: string; id: string };

/** 订阅回调可能收到 snapshot 事件（服务端通知"重新全量同步"） */
export interface SyncSnapshotEvent {
  t: 'snapshot';
  data: SyncData;
}
