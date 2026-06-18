# Competitor Analysis Skill

端到端竞品分析平台生成器（Claude Code Skill，为交互设计师打造）。

> 用户说一句"帮我做竞品分析"，AI 自动完成：
> **目标设定 → 产品画像 → 功能域推导 → 发掘竞品 → 批量截图 → 目标导向差距分析 → 生成可分享站点**。

---

## ⭐ 核心能力一：目标导向，不当复读机

> 大多数竞品分析工具败在第二步：**AI 看到竞品就觉得哪都好**，
> 最终报告写成"侧边栏好看、对话框动画不错"的流水账，用户拿到不知道下一步做什么。

这个 skill 在所有动作之前先做一件事：**问用户为什么要做这次分析**。

### 强制 Step 0：分析目标设定

用户说"帮我做竞品分析"，AI 第一反应**不是**扫代码、**不是**找竞品，而是给出常见目标清单：

```
📉 首屏留存低     🚪 核心功能完成率低    ⏳ 异步等待流失
🎯 学习成本高     🔁 单次使用不回头      💰 转化差
🤔 自定义
```

用户多选/补充后，AI 会做三件事：

1. **转译为可衡量指标**："留存不好" → "首屏 30s 跳出率 > 60%"（假设性）
2. **合并近义目标 + 排优先级**：1 个 P0 必填 + 可选 P1/P2，**总数 ≤ 3**
3. **写入 `analysisGoals`**，后续每一步都要引用这些 goal id

### 目标贯穿全流程

| 环节 | 如何用上目标 |
|---|---|
| 功能域推导 | 每个域标"最相关的 goal id"，无关 goal 的域降权或删 |
| 竞品发掘 | 按 goal 找标杆（想解决留存→找留存高的产品，不是机械凑 5+3）|
| 差距分析 | 每个 cell 必填 `goalRelevance` + `expectedImpact` + `hypothesis`（可证伪的因果链）|
| verdict | 新增 `not-for-our-goal`（竞品做得好但跟我们目标无关，**明确不借鉴**）|
| 最终洞察 | `keyInsightsByGoal`：每个 goal 下列 3-5 条最值得落地的借鉴 + 预期指标变化 |

### 一条合格的差距分析长这样

```json
{
  "competitor": "Runway",
  "verdict": "borrow-strong",
  "goalRelevance": "onboarding-dropoff",
  "expectedImpact": {
    "metric": "首屏 30s 跳出率",
    "direction": "↓",
    "estimate": "-5 到 -10pp",
    "confidence": "medium"
  },
  "hypothesis": "用户跳出是因为看不懂能干啥；Runway 用首屏 3 秒动效演示替代静态 hero，把'做什么'从文字说明变成视觉演示；借鉴后用户在第一屏就能理解主要能力，跳出率应显著下降",
  "actionItem": "P0: 把 SkillPicker 的静态卡片改成 hover 自动播放 3 秒 demo loop"
}
```

每一条 borrow 都能回答："借鉴它 → 解决哪个 goal → 预计指标怎么变 → 这个假设可不可被验证"。

---

## ⭐ 核心能力二：截图不再是营销页

> 市面上 99% 的竞品分析败在第一步：**截图截到的全是 Pricing、Hero、Get Started 这种官网营销页**，
> 后面 AI 写的分析全是空话。这个 skill 把"截图"做成了能穿透登录墙、能分辨真假页面、能主动探索真 UI 的工程系统。

### 一、截图之前先做 URL 体检

进主流程前先给每个竞品 URL 做一遍体检：

- **状态码探测**：HEAD/GET 双探，被反爬站拒绝（403/404 装作不存在）也能识别出来
- **真/假页面判定**：直接爬到的就是营销页？自动从同域链接里挖 `/app`、`/docs/<id>`、`/templates/<slug>` 这些真功能页候选
- **生成替代 URL 清单**：每个竞品 × 每个模块都给一组带打分的替代 URL，截图阶段某个 URL 失败能秒切

### 二、每页 3 张状态图（v0.6）

每个 module 不再是"1 张快照"而是 **3 张状态图**：主屏 above-the-fold + 滚动 50% + 滚动 100%（底部）。
交互设计师要看的是「fold 下的功能列表、价格、FAQ、footer 入口」，单张主屏完全看不到。

### 三、主截图时尽量像真人浏览器

- **伪装成真人 Chrome**：完整的浏览器指纹（Client Hints / UA / Accept-Language），绕过简单反爬
- **登录态自动挂载**：之前弹窗登过一次的网站，后续截图自动带上 cookies + localStorage
- **元素位置 dump**：每张截图同时存一份 DOM 坐标，后面 AI 做"红框标注"用
- **双端双视口**：桌面 1440×900 + 移动 375×812 同时截

### 四、截到坏图自动自愈（v0.6 四选一兜底）

主截图失败或被判定为"坏图"时，按 `--fallback-mode` 控制：

| 模式 | 做什么 | 适合 |
|---|---|---|
| `auto`（默认） | 直接抓官网视频抽 5 帧作为素材 | 没有截图素材，想快速跑完 |
| `manual` | 写 pending 清单，指定 expectedFile 路径让用户贴图 | 手头已有线下收集的竞品截图 |
| `ask-first` | 两条路径都走：写 pending 清单 + 同时抓视频备份 | 两手准备，最后用哪个由分析时决定 |
| `skip` | 跳过，放弃该竞品这几个模块 | 这竞品不是 P0 重点 |

外加自动处理链路：
| 情形 | 处理 |
|---|---|
| **登录墙** | 自动弹出真浏览器让你登录一次，登录态落盘复用（v0.5.1 修了 URL 稳定 10s 兜底，大多数 SPA 能识别） |
| **营销页** | 启动主动探索：AI 像真人一样在页面上找"Try / Open App / Live Demo / Gallery"按钮，点进去直到看到真 UI |

### 五、坏图识别（每张截图都过这一关）

从截图的 OCR 文字 + DOM 结构 + 视觉特征三路融合，识别 4 类坏图：

```
1. 登录墙    → 检测到 "Sign in with Google" + 邮箱密码组合
2. 错误页    → 检测到 "404 / Page not found / 找不到"
3. 空白页    → 可见元素 < 3 个，大概率加载失败
4. 营销页    → 三条独立规则任一命中即判营销页：
               ├─ 密集 CTA：含 5+ 个营销关键词（Get Started / Book Demo / Free Trial...）
               ├─ CTA 密度异常：单屏行动按钮密度超过阈值
               └─ 官网三件套：检测到 Pricing 区 + CTA 区 + Footer 同时出现（最难骗过）
```

**凡是没通过这一关的截图，绝对不会进入差距分析。** 坏图自动回到上一步的"三重兜底"重试。

---

## ⭐ 核心能力三：功能域 × 组件 —— 设计师视角，不是 PM 视角

传统竞品分析会这么写：

> "Coda 在灵活性上比 Notion 更强，在协作能力上也更胜一筹"

这种话对 PM 可能有用，**对交互设计师毫无帮助**——它没有告诉你**具体哪个 UI 做成什么样**。

这个 skill 的做法是：

### 不套模板的功能域

每次分析时，AI 会根据**当前产品的模块和定位**，**现场推导**出 2-4 个该产品专属的功能域：

- Notion → 内容创作 / 信息管理 / 多人协作 / 系统反馈
- Figma → 画布操作 / 组件复用 / 原型跳转 / 协同设计
- Linear → Issue 流转 / 规划与报表 / 快捷操作
- Descript → 录制 / 剪辑 / 转写 / 导出

**不会**强行套用"内容创作 / 管理 / 协作"这种通用模板。

### 12 个通用交互组件

组件是稳定的：导航、列表、工具栏、对话框、悬浮层、菜单、表单、编辑器、画布、反馈、空状态、引导、协作痕迹。

### 最终对比维度 = 功能域 × 组件

每个分析维度是一个组合，比如：

- `content-creation.editor`（内容创作 · 编辑器）→ 对比 block 编辑器的 slash 命令、粘贴、光标
- `info-management.list`（信息管理 · 列表）→ 对比文档树嵌套、最近访问、拖拽重排
- `collaboration.avatar-collab`（多人协作 · 协作痕迹）→ 对比协作光标、头像栈、typing indicator

**这样对比出来的差距是设计师能直接拿去改稿的"具体决策点"**，不是"灵活性更强"这种没法落地的判断。

---

## 🚀 快速开始

```
用户：帮我做竞品分析
AI：在动手前我需要先搞清楚——你希望这次分析回答什么问题？
     [给出 6 个常见目标 + 自定义]
     ↓
用户：首屏留存低 + 异步等待流失
AI：我把这两个整理成 P0 + P1 两个 goal，假设指标和预期收益是 ...，确认吗？
     ↓
用户：确认
AI：[识别到当前工作区是 Tideo] 自动跑产品画像 → 现场推导功能域（标 goal 相关性）
     ↓
用户：可以
AI：（按 goal 找竞品 → URL 体检 → 列清单）
     ↓
用户：开始截图
AI：（批量截图 → 撞登录墙弹浏览器 → 撞营销页自动探索 → 视频兜底）
     ↓
AI：（差距分析，每条带 goalRelevance + expectedImpact + hypothesis）
     ↓
用户：可以
AI：（生成站点：首屏按 goal 分组列 top 借鉴，每条都有"预计指标怎么变"）
```

---

## 📜 端到端命令

```bash
# 0. ⭐ 分析目标设定（v0.5 新增，AI 内部完成，可手动看模板）
node scripts/components-library.js --prompt-goal     # 打印"分析目标设定"引导

# 1. 产品画像（两种模式）
npm run step1 -- --url http://localhost:3000 --name MyProduct --out ./work/   # 有 URL
npm run step1 -- --no-url --name MyProduct --out ./work/                       # 无 URL（对话式）

# 1.5 功能域推导
node scripts/components-library.js --prompt-domain   # "推导当前产品功能域"引导
node scripts/components-library.js --prompt-bind     # "给功能域配组件"引导
node scripts/components-library.js --list            # 看 12 个通用组件池

# 2. 竞品 URL 体检 + 替代页挖掘
npm run step2 -- --competitors ./work/competitors.json --out ./work/vet-report.json

# 3. 批量截图（三重兜底 + 坏图自愈）
npm run step3 -- --profile ./work/product-profile.json \
                 --competitors ./work/competitors.json \
                 --out ./site/assets/screenshots/

# 4. AI 写差距分析（按 prompts/gap-analysis.md，每个 cell 必填 goalRelevance + expectedImpact + hypothesis）

# 5. 生成独立站点（首屏按 goal 分组展示）
npm run step5 -- --data ./work/analysis-data.json \
                 --screenshots ./site/assets/screenshots/ \
                 --out ./site/ --serve
```

---

## 📁 文件结构

```
competitor-analysis-skill/
├── SKILL.md                            # AI 主入口
├── README.md                           # 本文件
├── package.json
├── scripts/
│   ├── step1-analyze-product.js        # 产品画像（系统内自动 / 外部对话双模式）
│   ├── step2-vet-competitors.js        # URL 体检 + 替代页挖掘
│   ├── step3-capture-all.js            # ⭐ 批量截图主入口（编排三重兜底）
│   ├── step3-explore.js                # ⭐ 主动探索（穿透营销页进试用页）
│   ├── step3-fallback-video.js         # ⭐ 视频兜底（官方 demo 抽帧）
│   ├── verify-screenshots.js           # ⭐ 4 类坏图识别
│   ├── capture.js                      # 截图核心（浏览器伪装）
│   ├── login.js / login-interactive.js # 登录态：手动保存 / AI 弹窗
│   ├── frame-extract.js                # 视频抽帧
│   ├── components-library.js           # 12 个通用组件 + 功能域推导 prompt
│   ├── batch.js / clean-rules.js / validate-data.js
│   └── step5-generate-site.js          # 生成独立 SPA
├── site-template/                      # 站点模板（支持红框标注 + 组件特征渲染）
├── templates/                          # Notion 示例 + schema
└── prompts/
    └── gap-analysis.md                 # AI 写差距分析的引导（功能域 × 组件视角）
```

---

## 🎯 能力全景

- **端到端流程**：产品画像 → 功能域推导 → 竞品发掘 → URL 体检 → 批量截图 → 差距分析 → 站点生成
- **双产品模式**：系统内产品（自动分析代码 + 路由 + README）/ 外部产品（对话式问答）
- **双竞品维度**：全方位对标（≥ 5 个，覆盖所有模块）+ 单点对标（3 个，每个只对标一个关键模块）
- **截图三重兜底**：登录弹窗 → 主动探索 → 视频抽帧（**这是本 skill 的核心壁垒**）
- **坏图自动自愈**：4 类坏图识别 + 自动重试 / 切替代 URL / 升级兜底层级
- **功能域不套模板**：每次分析现场推导 2-4 个产品专属功能域，不是固定的 6 个
- **组件视角差距**：12 类通用组件 × 产品专属功能域，输出设计师能直接落地的决策差距

## License

MIT
