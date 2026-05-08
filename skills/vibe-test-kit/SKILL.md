---
name: vibe-test-kit
description: |
  为 Vibe Coding 页面打造的用户测试工具包。在任意 Web 项目里引入 3 行 script，
  即可获得：无感埋点（操作序列、犹豫点、困惑行为、停留时长、JS 错误）、
  情境嵌入式问卷（在用户正在做事的时候弹出微问卷）、右下角任务气泡引导（支持贴边收起，
  统一锚定右下角的"任务中心"），以及独立的测试看板（生成链接、漏斗、问题发现、
  用户路径时间线）。支持模拟数据 / 本地 localStorage / 真实 API 三种数据源。
version: 1.1.0
location: plugin
---

# vibe-test-kit

> v1.1.0 更新（2026-04）：
> - 任务面板与所有问卷统一锚定右下角，形成集中"任务中心"
> - 任务气泡支持点贴边按钮收起，只露 30×60 小拉手贴在屏幕右边缘，鼠标 hover 自动弹回
> - 配色全面改为黑白灰（深石板灰 #1e293b → #334155），与产品主色解耦
> - 总结问卷（SUS/NPS）从全屏遮罩改为右下角小卡片（380px），不再阻挡用户操作
> - 修复任务面板创建顺序导致的 onclick 报错 + 跨页 sessionStorage 状态保留

## When to use

Use this skill when the user wants to:

- 给现有 Web 页面加埋点 / 用户测试能力（"我想看用户怎么用的"）
- 做可用性测试、情境问卷、SUS/NPS 评估
- 生成测试链接分发给受测者、收集操作轨迹与问卷
- 搭建轻量的"测试中心"看板
- 在 AI 产品 / Vibe Coding 项目中快速建立用户反馈闭环

关键词触发：用户测试、可用性测试、埋点、SUS、NPS、情境问卷、测试看板、tracker、survey

## Capabilities

### 1. 零侵入埋点（`src/tracker.js`）

自动采集：
- 页面访问 / 离开 / 停留时长
- 点击（含坐标、文本、action）
- 首次交互 → 犹豫时间
- 重复点击 → 困惑检测
- 滚动深度
- 文件选择、输入、焦点
- 页面切走 / 切回
- JS 错误（error + unhandledrejection）

手动打点 API：
```javascript
VibeTracker.milestone('task_started');
VibeTracker.phaseStart('processing');
VibeTracker.taskComplete('T1', '完成首个任务');
VibeTracker.success('upload', { size: '2.4MB' });
VibeTracker.failure('upload', 'Network Error');
```

数据可通过 `data-endpoint` 属性配置上报目标，同时自动落 `localStorage` 便于调试。

### 2. 情境嵌入式问卷（`src/survey.js`）

URL 带 `?smode=test` 即激活。支持：
- 欢迎浮层（任务说明 + 可选素材下载）
- 右下角任务气泡（逐步展示目标任务，完成后打勾）
- 情境微问卷（5 点 rating / SAM 情绪量表，在关键节点延迟弹出）
- 总结问卷（SUS 10 题 + EV 9 题 + NPS + 三词描述 + 开放题）
- 跨页面状态持久化（sessionStorage）

问卷内容 100% 配置驱动（`src/survey.config.js`），产品词用 `{product}` 占位符替换。

### 3. 测试看板（`dashboard/index.html`）

两步式：
- **Step 1：生成链接** — 填目标 URL + 轮次名 + 用户数，一键生成每人专属链接
- **Step 2：查看数据** — KPI / 转化漏斗 / 问题发现 / 问卷汇总 / 任务矩阵 / 用户详情

数据源三选一：
- **模拟数据** — 内置 8 个典型用户场景（完成 / 流失 / 困惑 / 报错 / 浏览）
- **本地 localStorage** — 读取当前浏览器里 tracker 落下的事件
- **真实 API** — 填 endpoint，自动 30s 刷新

## How to integrate

三步：

1. 把 `src/` 目录拷贝到你的项目
2. 在产品页引入 3 个 script（tracker / survey / survey.config）
3. 在关键业务节点调用 `VibeTracker.milestone()` / `taskComplete()`

详见 `docs/integration.md`。

## File layout

```
vibe-test-kit/
├── src/
│   ├── tracker.js          # 269 行，行为采集 SDK
│   ├── survey.js            # 556 行，问卷引擎（v1.1 含贴边气泡 + 右下角统一布局）
│   └── survey.config.js     # 180 行，默认问卷配置
├── dashboard/
│   ├── index.html          # 测试中心
│   └── mock-data.js         # 8 个模拟用户场景
├── demo/
│   └── app.html            # 接入示例（可直接跑）
├── docs/
│   ├── integration.md       # 接入指南
│   ├── data-schema.md       # 事件格式
│   └── customize.md         # 自定义任务/问卷
├── README.md
└── LICENSE
```

## Running the demo

```bash
npx serve vibe-test-kit -p 4300
# 浏览器打开：
#   http://localhost:4300/demo/app.html           # 被测产品示例
#   http://localhost:4300/dashboard/index.html    # 测试看板
```
