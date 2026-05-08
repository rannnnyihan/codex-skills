---
name: design-reviewer
description: "Embed a complete design review tool (page annotations + snapshot annotations + JSON export) with optional multi-user collaboration (via pluggable backend adapter) into any React project. Use when user says 导入评审工具, 集成 design review, 评审工具, 给页面加标注, 添加评论功能, 做设计评审, design reviewer, review tool, annotation tool, or wants to add design review/collaboration capability to a React app."
description_zh: "React 项目嵌入设计评审工具，支持多人协作（可插拔后端）"
description_en: "Embed a design review tool with pluggable backend for team collaboration"
version: 3.0.0
allowed-tools: Read,Write,Bash
metadata:
  clawdbot:
    emoji: 📝
---

# Design Reviewer — React 设计评审工具（v3 协作版）

## Overview

**v3 版本的核心变化：**

- 🎭 **用户身份** — 首次进入填写昵称，所有标注自动带 author（显示头像 + 姓名）
- 🔌 **插件化后端** — 通过 `SyncAdapter` 接口可接入任意后端（REST / WebSocket / CloudBase），或完全不接（默认 localStorage）
- 👥 **团队协作** — 接上后端即可多人同时评审、实时看到对方的标注
- 📦 **开箱即用** — 默认配置下是纯本地单人模式，零配置

**保留的功能：**

- 📝 页面模式（iframe 嵌入目标页面，点击组件生成 CSS selector）
- 📸 快照模式（html2canvas 截取，对图片坐标标注）
- 🎨 4 种标注类型：交互 / 问题 / 建议 / 设计意图
- 📤 JSON 导出

## When to Use This Skill

触发词（中文）：
- "导入评审工具"、"评审工具"、"给页面加标注"、"做设计评审"
- "多人评审"、"协作评审"、"团队评审"
- "添加评论功能"

触发词（英文）：
- "design reviewer", "review tool", "annotation tool", "collaborative review"

使用场景：
- 想给 React 项目嵌入评审工具
- 用户问"能不能多人一起用"、"有后端版本吗"
- 用户想给已有页面增加标注评审能力

## Technical Requirements

- **React**: 18 或 19
- **TypeScript**: 推荐
- **必需依赖**: `zustand@^5`, `html2canvas@^1.4`
- **可选依赖**（接后端时）：无（REST Adapter 用 fetch；WebSocket Adapter 用原生 WebSocket）

## File Structure

```
design-reviewer/
├── SKILL.md                              ← 本文件
├── README.md                             ← 说明
├── UPLOAD-TO-MARKETPLACE.md              ← 投稿到官方 marketplace 的指南
└── assets/
    ├── react-tool/                       ← 完整前端源码
    │   ├── README.md
    │   ├── INTEGRATION.md
    │   └── src/
    │       ├── App.tsx
    │       ├── index.ts                  ← 对外导出
    │       ├── store.ts                  ← Zustand state + adapter 编排
    │       ├── constants.ts
    │       ├── types.ts                  ← 类型 + SyncAdapter 接口
    │       ├── styles.css
    │       ├── adapters/                 ← 后端 Adapter
    │       │   ├── index.ts
    │       │   ├── LocalStorageAdapter.ts   ← 默认（单人本地）
    │       │   ├── RestAdapter.ts           ← REST API + 轮询
    │       │   └── WebSocketAdapter.ts      ← WebSocket 实时协作
    │       └── components/
    │           ├── Layout.tsx
    │           ├── LoginModal.tsx        ← v3 新增：填昵称
    │           ├── Topbar.tsx            ← v3 改动：加用户头像
    │           ├── Sidebar.tsx
    │           ├── PreviewArea.tsx
    │           ├── RightPanel.tsx
    │           ├── PinPopup.tsx
    │           └── Toast.tsx
    └── backend-examples/                 ← 后端参考实现（按需用）
        ├── scf-nodejs/                   ← 腾讯云 SCF + COS
        │   ├── index.js
        │   ├── package.json
        │   └── README.md
        └── cloudbase/                    ← 腾讯云 CloudBase
            └── README.md
```

## Quick Integration

### Step 1：复制源码
```bash
cp -r <skill>/assets/react-tool/src  <user-project>/src/review
```

### Step 2：装依赖
```bash
npm install zustand html2canvas
```

### Step 3：创建页面

#### 场景 A：单人本地模式（默认）
```tsx
import { DesignReviewApp } from '../review'

export default function ReviewPage() {
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      <DesignReviewApp
        config={{
          productName: '产品名',
          storageKey: 'myapp_review_v1',   // 用来隔离多个项目的数据
          pages: [
            {
              group: '主流程',
              items: [
                { key: 'home', file: '/', name: '首页' },
                { key: 'list', file: '/list', name: '列表' },
              ],
            },
          ],
        }}
      />
    </div>
  )
}
```

数据存浏览器 localStorage，**单机使用**。

#### 场景 B：团队协作（REST API）
```tsx
import { DesignReviewApp, createRestAdapter } from '../review'

<DesignReviewApp
  config={{
    productName: '产品名',
    storageKey: 'myapp_review_v1',
    pages: [...],
    adapter: createRestAdapter({
      baseUrl: 'https://your-api.com',
      pollInterval: 10000,     // 每 10 秒轮询一次，准实时
    }),
  }}
/>
```

部署后端：参考 `assets/backend-examples/scf-nodejs/README.md`

#### 场景 C：实时协作（WebSocket）
```tsx
import { DesignReviewApp, createWebSocketAdapter } from '../review'

<DesignReviewApp
  config={{
    productName: '产品名',
    storageKey: 'myapp_review_v1',
    pages: [...],
    adapter: createWebSocketAdapter({
      wsUrl: 'wss://your-api.com/review',
    }),
  }}
/>
```

#### 场景 D：CloudBase（最简单）
参考 `assets/backend-examples/cloudbase/README.md`

### Step 4：加路由
```tsx
<Route path="/review" element={<ReviewPage />} />
```

## SyncAdapter 接口

如果你不想用内置的 3 种 adapter，可以自己实现。接口简单：

```ts
interface SyncAdapter {
  init?(ctx: SyncAdapterContext): void | Promise<void>;

  /** 初次加载所有数据（必需） */
  load(): Promise<SyncData>;

  /** 推送一条变更（必需） */
  push(event: SyncEvent): Promise<void>;

  /** 订阅远端变更（可选，实现才有协作） */
  subscribe?(handler: (e: SyncEvent | SyncSnapshotEvent) => void): () => void;

  /** 销毁清理（可选） */
  destroy?(): void | Promise<void>;
}
```

最少只实现 `load` + `push`，就能获得"多端同步"。实现 `subscribe` 就能有"实时协作"。

## Configuration Reference

```ts
interface ReviewConfig {
  productName: string          // 左上角标题
  storageKey:  string          // 命名空间，隔离多个项目
  pages:       PageGroup[]
  adapter?:    SyncAdapter     // v3 新增：不传 = 本地模式
}
```

## Data Model

```ts
interface PageAnnotation {
  id, type, text, createdAt, author,
  selector, targetSummary,
  xInEl, yInEl, xInFrame, yInFrame
}

interface SnapAnnotation {
  id, type, text, createdAt, author,
  xPct, yPct
}

interface Snapshot {
  id, pageKey, pageName, imgData, createdAt, author, note
}
```

## Keyboard Shortcuts

| 按键 | 功能 |
|------|------|
| `A` | 切换标注模式 |
| `Esc` | 关闭弹窗 / 退出标注 |
| `⌘[` / `Ctrl+[` | 切换左侧栏 |
| `⌘]` / `Ctrl+]` | 切换右侧栏 |

## 推荐做法

- ✅ 评审工具独立路由 `/review`
- ✅ 每个项目用独立 `storageKey`
- ✅ **团队协作时** 用 REST Adapter + SCF，搭建 10 分钟
- ✅ 重要评审节点用快照模式固化
- ❌ 不要把评审入口加进产品主导航（侵入式）

## v3 迁移说明

如果从 v2 升级，需要做：
1. 覆盖所有 src/ 文件
2. 首次进入会弹登录窗，填昵称即可
3. 旧数据（v2 存的 localStorage）需要清除或手动迁移（字段结构变了）
4. **不影响**已有 `storageKey` 配置（v3 默认仍然写 localStorage）
