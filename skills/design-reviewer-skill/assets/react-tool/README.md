# Design Reviewer — React 版设计评审工具

一个开箱即用的 Web 产品设计评审组件，内嵌到任何 React 项目中即可使用。

## ✨ 核心功能

- **页面模式**：iframe 嵌入目标页面，点击组件直接放置标注（自动生成 CSS selector）
- **快照模式**：截取特定交互瞬间（弹窗/状态）为图片，对图片上的位置标注
- **双空间隔离**：页面标注和快照标注独立存储，互不干扰
- **标注类型**：交互 / 问题 / 建议 / 设计意图
- **本地持久化**：所有数据存 localStorage，无需后端
- **导出 JSON**：一键导出评审记录用于团队分享

## 📦 依赖要求

```json
{
  "react": "^18 || ^19",
  "react-dom": "^18 || ^19",
  "zustand": "^5",
  "html2canvas": "^1.4"
}
```

## 🚀 集成步骤

### 1. 复制源码

把 `src/` 目录整个复制到你的项目（例如 `src/review/`）。

### 2. 安装依赖

```bash
npm install zustand html2canvas
```

### 3. 创建路由页面

```tsx
// pages/ReviewPage.tsx
import { DesignReviewApp } from './review'

const MY_PAGES = [
  {
    group: '主流程',
    items: [
      { key: 'home',       file: '/',          name: '首页',    desc: '落地页' },
      { key: 'dashboard',  file: '/dashboard', name: '仪表盘',  desc: '数据看板' },
    ],
  },
  {
    group: '次要页面',
    items: [
      { key: 'settings',   file: '/settings',  name: '设置' },
    ],
  },
]

export default function ReviewPage() {
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      <DesignReviewApp
        config={{
          productName: '我的产品',
          storageKey: 'myapp_review_v1',   // 每个项目用独立 key
          pages: MY_PAGES,
        }}
      />
    </div>
  )
}
```

### 4. 注册路由

以 `react-router-dom` 为例：

```tsx
// App.tsx
import ReviewPage from './pages/ReviewPage'

<Route path="/review" element={<ReviewPage />} />
```

访问 `/review` 即可打开评审工具。

## ⚙️ 配置说明

```ts
interface ReviewConfig {
  productName: string   // 左上角显示的产品名
  storageKey:  string   // localStorage 命名空间（必须唯一）
  pages:       PageGroup[]
}

interface PageGroup {
  group: string
  items: PageItem[]
}

interface PageItem {
  key:   string     // 唯一标识（必填）
  file:  string     // iframe 加载的 URL 或路径
  name:  string     // 侧边栏显示的名称
  desc?: string     // 可选说明（鼠标悬停展示）
  sub?:  PageItem[] // 可选子页面
}
```

## 🗂 数据结构

localStorage 中会写入 3 份数据：

| Key | 内容 |
|---|---|
| `{storageKey}_pageAnnos` | 页面标注 `{ [frameKey]: PageAnnotation[] }` |
| `{storageKey}_snaps`     | 快照列表 `Snapshot[]` |
| `{storageKey}_snapAnnos` | 快照标注 `{ [snapId]: SnapAnnotation[] }` |

## ⌨️ 快捷键

| 按键 | 功能 |
|---|---|
| `A` | 切换标注模式 |
| `Esc` | 关闭弹窗 / 退出标注 |
| `⌘+[` / `Ctrl+[` | 切换左侧栏 |
| `⌘+]` / `Ctrl+]` | 切换右侧栏 |

## 📋 使用说明

### 页面标注模式
1. 左侧点选目标页面 → 中间 iframe 加载
2. 顶部点"标注模式" → iframe 变蓝框
3. 点击页面中的组件 → 弹窗编辑标注
4. 右侧面板列出当前页所有标注，可筛选类型

### 快照标注模式
1. 在页面模式下，点顶部"截取"按钮 → 保存当前页快照
2. 自动切换到快照模式，中间显示截图
3. 点"标注模式" → 图片变 crosshair
4. 点图片任意位置 → 弹窗编辑标注
5. 右侧列出该快照的所有标注
6. 左侧快照缩略图 hover 显示 × 删除按钮

## 💡 典型应用场景

- **设计评审**：团队在开发完成前集中 review，高效记录意见
- **验收测试**：产品经理/设计师对页面做验收，问题分类跟踪
- **用户测试笔记**：观察用户操作时记录困惑点和交互问题
- **设计稿对比**：快照保存不同版本，标注差异

## 🔧 自定义

所有样式变量在 `styles.css` 顶部可覆盖：

```css
.review-app {
  --accent:  #8b5cf6;   /* 主题色 */
  --bg:      #0b0b12;   /* 深色背景 */
  /* ... */
}
```

标注类型和颜色在 `constants.ts` 中修改：

```ts
export const TYPE_META = {
  interact: { label: '交互', color: '#3b82f6' },
  bug:      { label: '问题', color: '#ef4444' },
  // ...
}
```
