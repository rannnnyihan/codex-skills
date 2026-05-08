# Design Reviewer Skill

> 一个开箱即用的 **CodeBuddy Skill**，给任何 React 项目嵌入**设计评审工具**，支持**多人协作**。

## ✨ 功能亮点（v3）

- 🎭 **用户身份** — 首次填昵称，所有标注带头像 + 作者
- 📝 **页面标注** — iframe 嵌入目标页面，点击组件自动生成 CSS selector + Pin
- 📸 **快照标注** — 截取特定状态为图片，对图片坐标做标注（适合弹窗、动态交互）
- 🎨 **4 种标注类型** — 交互 / 问题 / 建议 / 设计意图，支持筛选
- 🔌 **插件化后端** — 默认纯本地 / 可接 REST / WebSocket / CloudBase 实现协作
- 📤 **JSON 导出** — 一键导出评审记录

## 🚀 同事如何使用

### 步骤 1：安装 Skill 到本地 CodeBuddy

```bash
cd ~/.codebuddy/skills
git clone https://git.woa.com/darianyi/design-reviewer-skill.git design-reviewer
```

### 步骤 2：重启 CodeBuddy

让 CodeBuddy 识别新 skill。

### 步骤 3：在对话里唤起 skill

打开你要加评审功能的 React 项目，对 CodeBuddy 说：

> "给我的项目加设计评审工具"

> "导入 design reviewer"

AI 会**自动识别 skill**，按 SKILL.md 里的流程把源码集成到你的项目。

### 步骤 4（可选）：加后端实现协作

如果想多人一起评审：
- **简单**：让 AI 帮你接 CloudBase（见 `assets/backend-examples/cloudbase/`）
- **免费**：让 AI 帮你部署 SCF（见 `assets/backend-examples/scf-nodejs/`）
- **自建**：实现 SyncAdapter 接口（见 SKILL.md）

## 📋 技术要求

- **React**: 18 或 19
- **TypeScript**: 推荐
- **必需依赖**: `zustand@^5`, `html2canvas@^1.4`

## 📂 Skill 内容

```
design-reviewer-skill/
├── SKILL.md                              ← CodeBuddy 会读这个文件判断何时调用
├── README.md                             ← 本文件
└── assets/
    ├── react-tool/src/                   ← 完整 React 源码（15+ 文件）
    │   ├── App.tsx
    │   ├── store.ts
    │   ├── styles.css
    │   ├── adapters/                     ← 3 种后端 Adapter
    │   │   ├── LocalStorageAdapter.ts   （默认，纯本地）
    │   │   ├── RestAdapter.ts           （接 REST API）
    │   │   └── WebSocketAdapter.ts      （WebSocket 实时协作）
    │   └── components/
    │       ├── LoginModal.tsx           （v3 新增）
    │       ├── Topbar.tsx
    │       ├── Sidebar.tsx
    │       └── ...
    └── backend-examples/                 ← 后端参考实现
        ├── scf-nodejs/                   （腾讯云 SCF 完整代码）
        └── cloudbase/                    （CloudBase 指南）
```

## 🎯 典型使用场景

- **设计评审**：团队在开发完成前集中 review，高效记录意见
- **远程协作评审**：分布式团队同时标注，实时看到对方的意见
- **验收测试**：产品经理/设计师对页面做验收，问题分类跟踪
- **用户测试笔记**：观察用户操作时记录困惑点

## 📖 手动集成（不用 CodeBuddy）

直接看 [`assets/react-tool/INTEGRATION.md`](assets/react-tool/INTEGRATION.md)

## 📄 更新日志

- **v3.0.0** (2026-04-27)：🎉 多人协作版
  - ➕ 用户登录机制（昵称 + 头像色）
  - ➕ SyncAdapter 插件化后端接口
  - ➕ RestAdapter / WebSocketAdapter 内置
  - ➕ 所有标注带 author 字段
  - ➕ SCF / CloudBase 后端参考代码
  - ⚠️ 破坏性变化：localStorage key 结构变了，v2 数据无法直接读

- **v1.0.0** (2026-04-23): 首次发布
  - 页面标注 + 快照标注双模式
  - CSS selector 自动生成
  - 本地 localStorage 持久化
  - JSON 导出

## 🐛 反馈

有问题直接找 **@darianyi** 或在这个仓库提 Issue。

---

**Made for fellow CodeBuddy users @ Tencent** ❤️
