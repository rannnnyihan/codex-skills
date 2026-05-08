# 🔌 集成指南 — 5 分钟接入 Design Reviewer

## 快速开始

### 步骤 1：拷贝源码

把 `src/` 目录复制到你的项目：

```bash
cp -r design-review/assets/react-tool/src  your-project/src/review
```

目录结构：
```
your-project/src/review/
├── App.tsx
├── index.ts
├── store.ts
├── constants.ts
├── types.ts
├── styles.css
└── components/
    ├── Layout.tsx
    ├── Topbar.tsx
    ├── Sidebar.tsx
    ├── PreviewArea.tsx
    ├── RightPanel.tsx
    ├── PinPopup.tsx
    └── Toast.tsx
```

### 步骤 2：安装依赖

```bash
npm install zustand html2canvas
```

如果还没装 React 和 React Router，也补上：

```bash
npm install react react-dom react-router-dom
```

### 步骤 3：创建评审页面

```tsx
// src/pages/ReviewPage.tsx
import { DesignReviewApp } from '../review'

const REVIEW_PAGES = [
  {
    group: '主流程',
    items: [
      { key: 'home',      file: '/',         name: '首页' },
      { key: 'translate', file: '/translate', name: '译制' },
    ],
  },
]

export default function ReviewPage() {
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      <DesignReviewApp
        config={{
          productName: '我的产品评审',
          storageKey: 'myproduct_review_v1',
          pages: REVIEW_PAGES,
        }}
      />
    </div>
  )
}
```

### 步骤 4：注册路由

```tsx
// App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ReviewPage from './pages/ReviewPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/review" element={<ReviewPage />} />
      </Routes>
    </BrowserRouter>
  )
}
```

### 步骤 5：启动

```bash
npm run dev
```

访问 `http://localhost:5173/review` 即可使用！

---

## 常见问题

### Q1: iframe 无法显示跨域页面？

**原因**：目标页面设置了 `X-Frame-Options: DENY` 或 CSP `frame-ancestors`。

**解决**：
- 如果 iframe 加载的是**同项目页面**，不会有跨域问题
- 如果是**外部网站**，需要后端代理或改用快照模式

### Q2: 截屏功能不工作？

**原因**：html2canvas 无法访问跨域 iframe 内容。

**解决**：
- 确保 iframe 内的页面是同源的
- 对图片资源开启 `crossorigin="anonymous"`

### Q3: 标注消失了？

**原因**：
- 清了浏览器缓存 / localStorage
- 换了 `storageKey`
- iframe 页面的 DOM 结构大幅变动，CSS selector 失效

**建议**：关键评审节点用**快照模式**固化内容，避免 DOM 变化影响。

### Q4: 如何分享评审数据给队友？

方式 A：**导出 JSON**
- 点顶部"导出"按钮 → 下载 `review-<timestamp>.json`
- 队友导入到同工具可查看（功能待实现）

方式 B：**localStorage 手动复制**
```js
// 导出
JSON.stringify({
  pageAnnos: JSON.parse(localStorage.getItem('myapp_review_v1_pageAnnos')),
  snaps:     JSON.parse(localStorage.getItem('myapp_review_v1_snaps')),
  snapAnnos: JSON.parse(localStorage.getItem('myapp_review_v1_snapAnnos')),
})

// 队友导入
localStorage.setItem('myapp_review_v1_pageAnnos', JSON.stringify(data.pageAnnos))
// ... 其他两个 key
```

方式 C：**后端同步（需自行实现）**
- 把 store 的持久化逻辑改为云端 API

### Q5: 可以嵌入到已有的大型 React 项目吗？

可以。`DesignReviewApp` 是一个完全独立的组件：
- 无外部样式污染（CSS 都限定在 `.review-app` 作用域）
- 全部通过 Zustand store 管理状态（独立 store 实例）
- 路由独立，不影响其他页面

只要确保路由路径不冲突即可。

---

## 生产环境建议

1. **独立路由**：把评审工具放在 `/review` 或 `/admin/review` 下，避免侵入产品主流程
2. **访问控制**：生产环境可加个简单的访问密码或权限判断
3. **storageKey 规范**：推荐格式 `{项目名}_review_v{版本}`，避免多项目冲突
4. **数据备份**：重要评审记录定期通过"导出"功能备份为 JSON

---

## 想要什么附加功能？

这个版本是精简版。如果你的团队需要：

- 云端同步（SCF / 自建后端）
- 历史快照对比
- 评审数据 Markdown 导出
- 多人协作实时同步

欢迎二次扩展，核心架构已经预留了扩展接口（`store.ts` 里所有 action 都可以改为异步）。
