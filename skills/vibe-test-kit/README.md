# vibe-test-kit

> 零侵入的用户测试工具包 · 为 Vibe Coding 页面而生

在任意 Web 项目里引入 3 个 `<script>` 标签，即可获得：

- **无感埋点** — 自动记录操作序列、犹豫点、困惑行为、停留时长、JS 错误
- **情境问卷** — 在用户"正在做事的时候"弹出微问卷，而不是事后补发
- **任务气泡** — 右下角浮动引导，逐步呈现目标任务
- **独立看板** — 生成专属测试链接、查看漏斗/问题/路径，可切换模拟数据 / 本地 localStorage / 真实 API

---

## 目录结构

```
vibe-test-kit/
├── src/                       # 注入到被测产品的 SDK
│   ├── tracker.js            # 行为采集（含手动打点 API）
│   ├── survey.js              # 情境问卷 + 任务气泡 + 总结问卷
│   └── survey.config.js       # 默认问卷配置（SUS / EV / 情境 / 任务）
├── dashboard/                 # 独立看板（测试中心）
│   ├── index.html            # 生成链接 + 查看数据
│   └── mock-data.js           # 模拟数据生成器
├── demo/
│   └── app.html              # 接入示例页
└── docs/
    ├── integration.md         # 如何接入你的项目
    ├── data-schema.md         # 埋点事件格式
    └── customize.md           # 自定义任务/问卷
```

---

## 快速开始（3 步）

### 1. 把 `src/` 拷到你的项目

```bash
cp -r vibe-test-kit/src your-project/vibe-test-kit/
```

### 2. 在产品页里引入

```html
<!-- 问卷配置（可选，覆盖默认） -->
<script src="/vibe-test-kit/survey.config.js"></script>
<!-- 埋点 SDK -->
<script src="/vibe-test-kit/tracker.js"
        data-endpoint="https://your-server/track"></script>
<!-- 问卷引擎 -->
<script src="/vibe-test-kit/survey.js"></script>
```

`data-endpoint` 可选，缺省只落 `localStorage`（便于本地 demo / 离线调试）。

### 3. 在关键节点打点

```javascript
// 任务开始
VibeTracker.milestone('task_started');

// 进入处理阶段（问卷引擎在 30s 后会弹 SAM 情绪量表）
VibeTracker.phaseStart('processing');

// 查看结果
VibeTracker.milestone('view_result');

// 任务完成（对应任务气泡的 T1/T2/T3）
VibeTracker.taskComplete('T1', '完成首个任务');
```

---

## 激活测试模式

给受测者分发形如下面的链接（由 `dashboard/index.html` 生成）：

```
https://your-product.com/page.html
  ?uid=tester_01
  &test=round1
  &smode=test               # 激活问卷引擎
  &stype=internal           # 类型：internal / user
  &ssurveys=1&sexit=1       # 开启情境问卷 / 总结问卷
  &swelcome=1&stasks=1      # 开启欢迎页 / 任务气泡
  &scp=onboard_ease,wait_sam,result_sam,edit_ease  # 启用哪些情境节点
```

受测者打开链接 → 弹出欢迎页 → 完成任务 → 在关键节点弹出微问卷 → 最后弹出总结问卷（SUS + EV + NPS + 开放题）。

产品方通过 `dashboard/index.html` 查看数据：漏斗、SUS/NPS 分数、问题发现、用户路径时间线。

---

## 打开 Demo

```bash
cd vibe-test-kit
npx serve . -p 4300
# 然后浏览器打开：
#   http://localhost:4300/demo/app.html
#   http://localhost:4300/dashboard/index.html
```

---

## License

MIT
