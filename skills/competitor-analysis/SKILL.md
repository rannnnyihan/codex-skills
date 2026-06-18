---
name: competitor-analysis
description: "端到端竞品分析平台生成器。AI 自动识别当前 CodeBuddy 工作区的产品（或引导用户描述外部产品）→ 按'产品型 + 功能型'两个维度发掘竞品 → URL 预检过滤营销页 → 双端批量截图（自动处理登录墙） → 差距分析 → 生成独立可分享 SPA 站点。触发词：「帮我做竞品分析」「分析一下我的产品」「找几个竞品对比 X」「给我一份竞品报告」「我要竞品分析平台」「帮我做 design review 找差距」。"
description_zh: "端到端竞品分析（产品型+功能型）→ 预检 → 双端截图 → 差距分析 → 独立站点"
description_en: "End-to-end competitor analysis with product-level + feature-level competitors"
version: 0.6.0
allowed-tools: Read,Write,Bash,WebSearch
metadata:
  clawdbot:
    emoji: 🔬
---

# Competitor Analysis Skill (v0.3)

> AI 帮你做一份严谨的竞品分析：**产品型 + 功能型**两维度竞品 → 预检过滤营销页 → 批量截图 → 差距分析 → 独立可分享网站。
> 关键节点必须跟用户对齐，AI 不能埋头跑完。

---

## ⭐ 核心原则（AI 必须遵守）

### 原则 -1：先问目标，再做分析（v0.5.0 起，最优先）

**竞品分析不是"欣赏竞品做得多好"，而是"为了解决我们自己的问题，去看别人是怎么做的"。**

所以第一件事 **不是** 扫产品代码、**不是** 找竞品，而是 **问用户这次分析要解决什么问题**。

如果没有目标：
- AI 会无差别地把每个竞品都打成"值得借鉴"（相当于拍马屁）
- 最终洞察会是"竞品 A 的侧边栏好看、B 的对话框动画不错"这种没法落地的碎片
- 用户拿到报告不知道 next step 是什么

所以 Step 0 必做：

1. **问用户**："你希望通过这次竞品分析回答什么问题？目前遇到的问题或想改进的指标是？"
2. **给 3-5 个常见目标做选项**让用户多选 / 补充，例如：
   - 📉 首屏留存低（大量用户第一屏就跳走）
   - 🚪 核心功能完成率低（启动了任务但没完成就流失）
   - ⏳ 异步等待流失严重（AI 任务跑着跑着用户关标签页了）
   - 🎯 新用户学习成本高（功能多但发现不到）
   - 🔁 用户只用一次不回来（单次使用体验断层）
   - 💰 免费到付费转化差（看到 paywall 就走）
3. **每个目标要落成可衡量的 metric**（AI 帮用户把"留存低"转译成"首屏 30s 跳出率 > 60%"这种假设性指标）
4. **目标数量控制在 1-3 个**。超过 3 个等于没目标，分析会散。
5. **写入 `product-profile.json` 的 `analysisGoals` 字段**，后续每一步都 **引用这些 goal**。

**贯穿后续所有环节**：

| 环节 | 如何体现目标导向 |
|------|-----------------|
| Step 1.5 功能域推导 | 每个功能域标"最相关的 goal"，无关 goal 的域可降权 |
| Step 2 竞品发掘 | 优先找"在对应 goal 上数据好/口碑好"的竞品（例如想解决留存→找留存高的） |
| Step 4 差距分析 | 每个 cell 必须写 `goalRelevance` + `expectedImpact` + `hypothesis` |
| Step 4 verdict | 新增 `not-for-our-goal`（竞品做法不错但跟我们目标无关，**不借鉴**） |
| Step 5 站点 | keyInsights 按 goal 分组，每个 goal 下列 3-5 条最相关借鉴 |

### 原则 0：分析视角 = 「该产品的功能域」×「通用交互组件」（v0.4.1 起）

**用户是交互设计师**，不是产品经理。竞品分析的 `dimensions` 必须同时满足两点：

1. 挂到**这个产品特有的功能域**（用户想完成什么目标）
2. 落到**具体可对比的交互组件**（dropdown / modal / list / 编辑器 ...）

**为什么两个都要？**

| 只讲组件 ❌ | 只讲功能域 ❌ | 两者结合 ✅ |
|------------|-------------|------------|
| "对比 Notion 的 dropdown 和 Coda 的 dropdown" → 脱离语境没法比 | "对比内容创作能力" → 太虚，没法落地到具体设计 | "对比两家在『文档创作』域里的『块类型选择器 (dropdown)』" → 既有场景又有抓手 |

**关键：功能域不是预设的，要每次分析时由 AI 根据产品推导**

不同产品的功能域天差地别，不要套模板：

- Notion → 内容创作 / 信息管理 / 多人协作
- Figma → 画布操作 / 组件复用 / 原型跳转 / 协同设计
- Linear → Issue 流转 / 规划与报表 / 快捷操作
- Descript → 录制 / 剪辑 / 转写 / 导出

AI 在 Step 1.5 调用 `scripts/components-library.js` 的 `promptForDomainInference()` 和 `promptForComponentBinding()` 拿到引导模板，**现场生成**该产品专属的 4-6 个 `<功能域>.<组件>` 组合作为 dimensions。

每个 `(module × dimension)` cell 描述**该组件在该功能域里的具体设计决策**：触发方式、布局尺寸、关闭交互、动画过渡 ...

### 原则 1：先说计划，再动手

用户第一次给请求 → AI **不能直接跑脚本**。先说明整体 6 步流程、预估耗时、输出位置，询问启动意愿。

### 原则 2：4 个硬停确认节点

| 节点 | 时机 | 必须给用户看 |
|------|------|-------------|
| 🛑 **A0** | **分析目标定好** | **"你希望这次分析解决哪 1-3 个问题？"（最先问，不问不往下走）** |
| 🛑 A1 | 产品画像定好 | "我理解你的产品是这样 {modules/dimensions}，对吗？" |
| 🛑 A2 | 竞品清单定好 | "共 {8} 个竞品（针对你的 goals 优先挑的），确认吗？" |
| 🛑 A3 | 差距分析写完 | "对每个 goal，最值得借鉴的 3 条如下，要不要调整后再生成站点？" |

### 原则 3：凡是 AI 能自己得到的信息，不要推给用户

- ✅ "我看到你工作区有 vite.config.ts 和 package.json，这像是 React Web App"
- ✅ "我扫了你的路由，看到 /editor、/library、/settings 这 3 个模块"
- ❌ "请告诉我你的产品有哪些模块" — 这是把 AI 的活推给用户

### 原则 4：截图质量不过关 → 自动修复 → 不行再问用户

- `empty` / `login-wall` / `marketing` / `error-page` 四类问题脚本会自愈
- `marketing` 专项：Step 2.5 会提前预检，挖替代 URL
- 自愈 2 次不成才抛给用户

### 原则 5：示例不预设具体产品

本 skill 的 templates/ 和示例以 **Notion** 为演示（大家都熟悉的公开产品），实际使用时用用户当前工作区的产品。

---

## 整体流程（7 步）

```
┌─ Step 0: 分析目标设定 ─┐  ← ⭐ v0.5 新增，最先做
│  用户回答"想解决什么问题" │
└──────────┬─────────────┘
           ↓
       🛑 A0 用户确认 goals
           ↓
┌─ Step 1: 产品画像 ─┐
│  系统内/外部两种模式  │
└──────────┬─────────┘
           ↓
┌─ Step 1.5: 功能域推导 ─┐  ← 每个域标相关 goal
└──────────┬─────────────┘
           ↓
       🛑 A1 用户确认画像 + 功能域
           ↓
┌─ Step 2: 双维竞品发掘 ──┐  ← 按 goal 筛选竞品
│  产品型 + 功能型         │
└──────────┬──────────────┘
           ↓
┌─ Step 2.5: URL 预检 ─┐
└──────────┬───────────┘
           ↓
       🛑 A2 用户确认竞品清单
           ↓
┌─ Step 3: 双端批量截图 ─┐  ← 自动处理登录墙
└──────────┬──────────────┘
           ↓
┌─ Step 4: 目标导向差距分析 ─┐  ← 每条借鉴写 goalRelevance + expectedImpact + hypothesis
└──────────┬──────────────────┘
           ↓
       🛑 A3 用户确认洞察（按 goal 分组）
           ↓
┌─ Step 5: 生成独立站点 ─┐
└───────────────────────────┘
```

---

## 启动响应模板

用户说"帮我分析一下我的产品" → AI 立即回（**第一问必须是目标**，不是"我扫到了什么"）：

```markdown
## 🔬 竞品分析流程确认

在动手之前，我需要先搞清楚 **这次分析是为了解决什么问题**——
竞品分析不是"看竞品做得多好"，而是"为了我们自己的问题去借鉴"。
没有目标，最后的报告只会是"竞品都很厉害"的流水账。

### 🎯 你希望这次分析回答哪 1-3 个问题？

常见分析目标（可多选 / 补充 / 自定义）：

- 📉 **首屏留存低**：用户进来一屏就跳走
- 🚪 **核心功能完成率低**：启动了任务但没完成
- ⏳ **异步等待流失**：AI 任务等待期间用户跑了
- 🎯 **学习成本高**：功能多但用户发现不到
- 🔁 **单次使用**：用户用一次就不回来
- 💰 **转化差**：免费用户不付费 / 付费入口点不开
- 🤔 **自定义**：告诉我你想解决什么

---

**我已经识别到的产品**：{Step 1 预览结果；外部产品就说"等目标定完再聊产品"}

**等你的目标** → 之后流程（约 30-45 分钟）：
1. 🎯 **分析目标设定** ← 当前 / A0
2. 📸 产品画像 + 功能域推导（目标会影响域的权重）— 3 分钟 ← A1
3. 🔍 按目标筛选的 5-8 个竞品（不再机械凑数）— 5 分钟 ← A2
4. 🎬 批量截图（登录墙自动弹浏览器）— 15-25 分钟
5. ✍️ **目标导向**差距分析（每条借鉴写明能解决哪个目标） — 5-10 分钟 ← A3
6. 🌐 生成独立站点（按目标分组展示洞察）— 1 分钟

**回复你的目标**（从清单选 or 自己描述），我才会进入下一步。
```

---

## Step 0：分析目标设定（v0.5 新增，最优先）

### AI 做什么

1. **永远先问目标**，哪怕用户说"直接开始就行"——也要追问一句"那你最想通过这次分析改进什么指标/体验？"
2. 用户答完后，AI 做三件事：
   - **转译为可衡量指标**：把"留存不好"翻译成假设性指标，如"首屏 30s 跳出率 > 60%"
   - **合并近义目标**：用户列了 5 条但其实是 2 类，帮用户收敛到 1-3 个主目标
   - **排优先级**：至少 1 个 P0 + 可选 P1/P2
3. 写入 `product-profile.json`：

```json
{
  "analysisGoals": [
    {
      "id": "onboarding-dropoff",
      "name": "首屏留存提升",
      "priority": "P0",
      "problem": "新用户进首页后 30 秒内跳出率高，怀疑不理解产品能干啥 / 不知道第一步做什么",
      "hypotheticalMetric": "首屏 30s 跳出率 > 60% → 目标降到 40% 以下",
      "expectedLift": "跳出率 -20pp / 对应 weekly active 预计 +25%",
      "relatedDomains": ["skill-onboarding"]
    },
    {
      "id": "async-wait-churn",
      "name": "异步等待流失",
      "priority": "P1",
      "problem": "AI 任务 5-15 分钟，很多用户关标签页就再没回来",
      "hypotheticalMetric": "等待期间标签页关闭率 > 40%",
      "expectedLift": "关闭率 -15pp / 任务完成率 +10pp",
      "relatedDomains": ["async-progress"]
    }
  ]
}
```

### 🛑 Checkpoint A0：目标确认

给用户看：

```markdown
## 我把你的问题整理成 2 个分析目标：

**P0 · 首屏留存提升**
  - 问题：新用户首屏 30s 跳出率高
  - 假设指标：跳出率 > 60% → 目标 < 40%
  - 预期收益：weekly active +25%
  - 最相关功能域：技能选择与素材投递

**P1 · 异步等待流失**
  - 问题：AI 任务等待期间用户关标签页再不回
  - 假设指标：等待期关闭率 > 40%
  - 预期收益：任务完成率 +10pp
  - 最相关功能域：异步任务感知

这两个目标抓准了吗？要增/删/改优先级请直说。
```

用户确认后写入 `analysisGoals` → 进入 Step 1。

**⚠️ 关键**：从此刻起，后续每一步（竞品选择、维度标注、差距分析、洞察总结）都必须引用这些 goal id，不能跑偏。

---

## Step 1：产品画像（两种模式）

### 模式判断（AI 自动做）

打开对话的第一件事，AI **检查当前 CodeBuddy 工作区**：

| 信号 | 模式 |
|------|------|
| 有 `package.json` / `pom.xml` / `Cargo.toml` + `src/` 目录 | 模式 A（系统内） |
| 有 `.html` 且目录下能 `python -m http.server` 起来 | 模式 A（静态站点） |
| 空目录 / 纯文档 / 只有 PRD / 用户明说"没部署" | 模式 B（外部） |

### 模式 A：系统内产品（自动分析）

**AI 做什么**：
1. 扫码 `package.json` → 读 name/description
2. 扫路由：`routes.ts`/`App.tsx`/`src/pages/` → 识别主模块
3. 扫 README → 提取定位描述
4. 用户本地能起服务就调 `localhost:PORT` 跑 step1 截首页；不能就跳过截图
5. AI **主动**填出初版 `product-profile.json`（不等用户回答）

```bash
# 有可访问 URL 时
node scripts/step1-analyze-product.js --url http://localhost:3000 --name "MyProduct" --out ./work/

# 无可访问 URL 时（仅静态分析代码）
node scripts/step1-analyze-product.js --no-url --name "MyProduct" --out ./work/
```

**然后给用户看**（这就是 🛑 A1）：

```markdown
## 我理解你的产品是这样

**产品名**：MyProduct（from package.json）
**类型**：React Web App — 看起来是 {类别}（AI 推断）
**主要模块**（from 路由扫描）：
  1. `/editor` 编辑器
  2. `/library` 素材库
  3. `/settings` 设置

**比较维度**（v0.4.1：**该产品专属功能域 × 通用交互组件**，AI 现场推导，不套模板）：
  - `content-creation.editor` 内容创作 · 编辑器（block / 富文本 / 快捷操作）
  - `content-creation.toolbar` 内容创作 · 工具栏（顶部 + 浮出 inline）
  - `content-creation.dropdown` 内容创作 · 块类型 slash command
  - `info-management.list` 信息管理 · 页面列表（嵌套树 / 最近访问 / 收藏）
  - `collaboration.avatar-collab` 多人协作 · 协作光标
  - `system-feedback.empty-state` 系统反馈 · 空状态（首次访问 / 搜索无结果 / 错误）

> 推导步骤（AI 在 Step 1 内部完成）：
>   1. 运行 `node scripts/components-library.js --prompt-domain` 拿到"功能域推导"引导
>   2. 根据当前产品的模块和定位，**临时**产出 2-4 个该产品专属功能域（**不要套"创作/管理/协作"这种通用分法**）
>   3. 运行 `node scripts/components-library.js --prompt-bind` 拿到"组件绑定"引导
>   4. 给每个功能域挑 1-2 个最核心的组件，组成 4-6 个最终 dimension

**对吗？** 有要改的请直说（改模块名 / 换组件 / ...）
```

### 模式 B：外部产品（对话引导）

**AI 做什么**：
1. 问用户："这个产品的名字？一句话定位？"
2. 问用户："主要模块是哪几个？每个模块做什么？"（如果用户有 URL 就顺便跑 step1 截图辅助）
3. 整理成 `product-profile.json` 后给用户确认

**AI 不要把列表甩给用户让他自己写**，要**边问边写**，每次问 1 个问题，写完一段让用户确认一次。

### 🛑 Checkpoint A1：产品画像确认

用户回复"对"或给出修正 → 写最终 `product-profile.json` → 进入 Step 1.5。

---

## Step 1.5：功能域推导（v0.4.1 新增）

**为什么需要这一步**：纯原子组件（dropdown/modal）脱离产品语境没法比，所以要先给当前产品推导 2-4 个专属功能域，再把组件挂进去。

### AI 做什么

1. 运行 `node scripts/components-library.js --prompt-domain`，把 stdout 当思考引导
2. 看当前产品的 `userProduct.modules` 和 `userProduct.summary`，**临时**推导 2-4 个功能域
   - ❌ 不要套"内容创作/信息管理/协作"这种通用分法（除非产品真的长这样）
   - ✅ 要贴产品：Figma 的域是"画布操作/组件复用/原型跳转/协同设计"，Descript 是"录制/剪辑/转写/导出"
3. 运行 `node scripts/components-library.js --prompt-bind`，把 stdout 当组件绑定引导
4. 给每个功能域挑 1-2 个核心组件，组成 4-6 个 `<功能域>.<组件>` 形式的 dimension
5. 每个 dimension 要填 `role`（组件在该域里的具体实例）和 `reviewFocus`（特殊关注点）
6. **（v0.5 新增）每个 domain 和 dimension 都要标 `goalRelevance`**：它最相关哪个 goal id
   - 如果和 Step 0 的任何 goal 都不相关，**降权或删掉这个 domain**
   - 不要堆 6 个 domain 覆盖全产品——只保留能打中目标的
7. 把推导结果写回 `product-profile.json` 的 `domains` 和 `dimensions` 字段

### 推导质量自检

推导完后 AI 自问三个问题：
1. **"这些功能域能套在任何其他产品上吗？"** → 如果能，说明推得太泛，重来
2. **"拿掉产品名，别人还看得出是哪个产品吗？"** → 看不出就说明贴了
3. **"每个 dimension 的 role 能直接指向一个具体 UI 元素吗？"** → "块类型选择器" 可以，"选择器" 不行

### 🛑 Checkpoint A1.5：功能域 + 组件确认（可并入 A1）

给用户看推导结果（可以和 A1 的产品画像一起确认）：

```markdown
我为 {产品名} 推导的功能域（4 个）：
  1. **内容创作**（用户目标: 快速把想法变成结构化文档）
     - dimension: `content-creation.editor` → block 编辑器（slash command / 粘贴处理 / ...）
     - dimension: `content-creation.toolbar` → 顶部 + inline 浮出工具栏
  2. **信息管理**（用户目标: 在大量页面中快速定位和归类）
     - dimension: `info-management.list` → 文档树 + 最近访问
  3. **多人协作**（用户目标: 感知他人存在不干扰自己）
     - dimension: `collaboration.avatar-collab` → 协作光标 + 头像栈
  4. **系统反馈**（用户目标: 理解当前状态）
     - dimension: `system-feedback.empty-state` → 首次访问 / 搜索无结果

**这些功能域贴你的产品吗？** 要增删或重命名请直说。
```

---

## Step 2：双维度竞品发掘

### 两种竞品类型

| 类型 | 是什么 | 数量 | 截图范围 |
|------|--------|------|---------|
| **产品型**（product） | 整体对标的同类产品 | **5 个**（必须 ≥5） | 覆盖你的**所有模块** |
| **功能型**（feature） | 跨行业某个功能的最佳实践 | **3 个**（在关键模块中挑 2-3 个配） | **只截对应模块** |

**产品型例子**（假设分析 Notion）：
- Coda / Obsidian / Craft / Roam / ClickUp Docs

**功能型例子**（假设分析 Notion 的 doc-editor 模块）：
- Google Docs（长文档编辑的最佳实践）
- Figjam（实时协作的最佳实践）
- Linear Docs（极简编辑体验）

### AI 做什么

**⚠️ v0.5 关键变更：竞品不是机械凑 5+3，而是"按 goal 精准挑"**

1. **先看 Step 0 的 `analysisGoals`**，给每个 goal 想"谁在这个问题上做得最好"：
   - goal=`onboarding-dropoff` → 找首屏留存高 / 引导做得好的产品
   - goal=`async-wait-churn` → 找异步任务等待体验好的产品（即使不是同类型产品）
   - goal=`learning-cost` → 找"上手即用"口碑好的产品
2. 用 `WebSearch` 搜"{goal 关键词} + best practice"/"{用户产品类型} + {goal}"，不是只搜 "{type} alternatives"
3. **产品型竞品**：≥3 个（覆盖多数 goals），要求有可访问网页版
4. **功能型竞品**：每个 P0 goal 必配 1 个"单点最佳实践"竞品（跨行业也行）
5. 给每个竞品配 URL + `targetGoals` 字段（这个竞品主要为哪个 goal 服务）
6. **⚠ 默认所有产品型竞品 `loginRequired: true`**
7. **桌面 App / 严重反爬站**：加 `demoVideoUrl` 触发视频兜底
8. 写 `competitors.json`（见 schema 小节）

**质量自检**：挑完竞品后问自己：
- 我为 P0 goal 挑的那个竞品，真的在这个问题上比用户产品强吗？
- 如果用户问"为啥选这个竞品而不是那个"，我能答出"因为它在 `<goalId>` 这个目标上是标杆"吗？

### 截图素材的三级 Tier

| Tier | 素材来源 | 质量 | 何时用 |
|------|---------|-----|-------|
| **Tier 1** | 登录后截真 UI | ⭐⭐⭐⭐⭐ 最真实 | 网页版 SaaS，用户有账号（默认目标） |
| **Tier 2** | demo 视频抽帧 | ⭐⭐⭐ 官方精选 UI | 桌面 App / 严重反爬 / 登录也不稳 |
| **Tier 3** | 营销页截图 | ⭐ 几乎无分析价值 | **禁止作为分析素材**（verify 会判 fail，step3 会触发 fallback） |

---

## Step 2.5：URL 预检（强制，硬门禁）

```bash
npm run step2 -- --competitors ./work/competitors.json --out ./work/vet-report.json
```

**脚本做什么**：
1. 对每个 moduleUrl 做快速预检（低分辨率截图 + DOM 抽取）
2. 规则判分：`ok` / `login-wall` / `marketing` / `error-page` / `empty`
3. 如果不是真功能页：抓同域所有 `<a>` + 用路径规则打分，给 top-3 替代 URL
4. 软警告：技术上 ok 但营销信号显著 >> 功能信号

**AI 读 vet-report.json 后必做**：
- 对每个 `needsFix` 条目决策：
  - 有高分候选（score≥5） → 改 `competitors.json` 的对应 URL
  - 没候选（login 墙）→ 标记 `loginRequired: true`，Step 3 会自动弹浏览器登
  - 候选也不理想 → WebSearch 找 / 换竞品
- 对每个 `softWarning` 酌情处理：该模块在分析维度里是"关键功能"就换

**step3 会兜底**：即使 AI 忘改 competitors.json，step3 读到 vet-report 后碰到 marketing 也会自动用候选 URL 重截。

### 🛑 Checkpoint A2：竞品清单确认

```markdown
## 竞品清单（预检完成）

### 产品型（5 个）
| 竞品 | 定位 | 登录 | 预检 |
|------|------|------|------|
| Coda | 文档+数据库一体化 | ✅ | ✓ |
| Obsidian | 本地优先知识库 | ✅ | ✓ |
| Craft | 极简美学文档 | ✅ | ✓ |
| ClickUp Docs | 团队协作 | 🔐 | 🔐 登录墙，将弹浏览器 |
| Roam | 双链笔记 | ✅ | ⚠ 改 URL：/app 而非 /features |

### 功能型（3 个 × 关键模块）
| 竞品 | 只看哪个模块 | 为什么 |
|------|-------------|-------|
| Google Docs | doc-editor | 长文档编辑的行业标杆 |
| Figjam | comments | 实时协作评论的最佳实践 |
| ChatGPT Canvas | ai-assistant | AI 深度集成的参考 |

**要调整吗**？（回复「开始截图」继续）
```

---

## Step 3：双端批量截图

```bash
npm run step3 -- \
  --profile ./work/product-profile.json \
  --competitors ./work/competitors.json \
  --out ./site/assets/screenshots/
  [--skip-login]                          # 跳过自动登录流（debug 用）
  [--skip-fallback]                       # 跳过视频抽帧 fallback（debug 用）
  [--fallback-mode=auto|manual|ask-first|skip]   # v0.6 新增：兜底方式
```

### v0.6 新增：多状态截图 + 兜底方式选择

**1) 每个模块默认产出 3 张截图**（之前只有 1 张首屏）：
- `competitors/<compId>-<moduleId>.png` — 默认首屏
- `competitors/<compId>-<moduleId>-scroll50.png` — 滚动到页面中部
- `competitors/<compId>-<moduleId>-bottom.png` — 滚动到页面底部

全屏画布类产品（Figma / Miro）不支持滚动，自动跳过后两张。

**2) 兜底方式 4 选 1（`--fallback-mode`）**：
- `auto`（默认）：遇到登录墙+营销页 → 直接抓视频抽帧。适合没有截图素材的场景。
- `manual`：跳过视频，只在 `fallback-pending/<compId>.json` 写需要截图的清单，让用户自己把截图放到指定路径。适合手头已有竞品截图的场景。
- `ask-first`：先写 pending 清单，同时也抓视频作为备份。两条路径都有，用户选用哪个。
- `skip`：放弃该竞品的兜底，manifest 里保留失败记录但不填充。

**3) pending 文件格式**：
```json
{
  "competitorId": "craft",
  "competitorName": "Craft",
  "mode": "manual",
  "expectedShots": [
    { "moduleId": "home", "expectedFile": "competitors/craft-home.png", "originalIssue": "login-wall", "originalUrl": "..." }
  ]
}
```
用户贴完图删除 pending 文件，下次跑 step4 就能识别新截图。

### 内置自愈流程（v0.3 以来）

1. **URL 预检** → 死链跳过；403/404 可能是反爬 → 让 playwright 试
2. **SPA 结构等待** → 等 `main`/`canvas` 等出现
3. **自动清扫浮层** → 弹窗/cookie条
4. **质量检查** → `empty` 自动延长 wait 重试
5. **登录墙 / 营销页自动处理**：每个竞品截完所有模块后，若 ≥1 张撞墙或营销 → 脚本**自动弹浏览器**让用户登录 → 登完保存 state 自动重截
   - v0.3.1 新增：marketing 也会触发登录（因为 SaaS 未登录看到的都是营销页，登录后才能看到真 UI）
   - state 存 `<workDir>/.auth/<competitorId>-state.json`，下次复用
6. **Tier 1.5 主动探索（explore）**：登录后仍 marketing → 触发 `step3-explore.js`（OpenClaw 模式）
   - 像真人一样在页面上找 "Try / Open App / Live Demo / Gallery" 按钮（关键词字典 + URL pattern 打分）
   - 递归点击进入子页面（深度 ≤ 3），每步 verify 是否变成功能页
   - 探索路径遇登录墙：自动弹浏览器登录 → 用 state 继续
   - 规则全部失败 → 写 `explore-pending.json` 让 AI 决策
7. **Tier 2 视频抽帧 fallback**：explore 也找不到真 UI → 触发 `step3-fallback-video.js`
   - 优先读 `competitor.demoVideoUrl`（YouTube/MP4 直链）
   - 没配就从官网首页抓 `<video>` / `<iframe src=youtube>`
   - ffmpeg 抽 5 帧（5% / 25% / 50% / 75% / 95% 时间点）
   - 帧保存到 `<out>/fallback-frames/` 并写入 manifest 的 `fallback` 字段

**功能型竞品特殊处理**：只截 `targetModules` 里列出的模块，其他模块跳过。

**CLI 参数**：
- `--skip-login`：跳过自动登录流（debug 用）
- `--skip-explore`：跳过主动探索（debug 用）
- `--skip-fallback`：跳过视频抽帧（debug 用）

**依赖工具（视频 fallback 需要）**：
```bash
brew install ffmpeg yt-dlp    # 或 apt install ffmpeg + pip install yt-dlp
```
不装也不影响主流程，只是 Tier 2 视频抽帧用不了。

---

## Step 4：AI 差距分析

**AI 做什么**（不需要脚本，全 AI）：
1. 看 step3 产出的所有截图
2. 参考 `prompts/gap-analysis.md` 的方法
3. 对每个模块：
   - 写 `userProductDoing`（自己产品在这个模块的现状）
   - 写 `competitorsBetter`（哪些竞品在这做得更好 + 为什么）
   - 写 `opportunities`（2-3 条可借鉴的点）
4. 对整体产品：写 6-10 条 `keyInsights`（关键洞察 + 优先级）
5. 输出 `analysis-data.json`

### 🛑 Checkpoint A3：洞察确认

把 6-10 条 keyInsights 给用户看，问："这些方向抓得对吗？要不要调整?"

---

## Step 5：生成独立站点

```bash
npm run step5 -- \
  --data ./work/analysis-data.json \
  --out ./site/
```

**产出**：`./site/index.html` + `./site/assets/` —— 独立 SPA 站点，可直接用浏览器打开，也可 push 到任何静态托管（GitHub Pages / CloudBase / EdgeOne Pages）。

**AI 最后用 `preview_url` 给用户看结果**。

---

## 数据 Schema

### product-profile.json

```json
{
  "userProduct": {
    "id": "notion",
    "name": "Notion",
    "monogram": "N",
    "url": "https://www.notion.so",
    "homeUrl": "https://www.notion.so",
    "type": "document",
    "summary": "把文档、数据库、wiki 合一的工作区",
    "modules": [
      { "id": "doc-editor", "name": "文档编辑", "url": "https://www.notion.so/product/docs" },
      { "id": "database", "name": "数据库/表格", "url": "https://www.notion.so/help/intro-to-databases" },
      { "id": "sidebar", "name": "左侧导航", "url": "https://www.notion.so" },
      { "id": "ai-assistant", "name": "AI 助手", "url": "https://www.notion.so/product/ai" },
      { "id": "comments", "name": "评论协作", "url": "https://www.notion.so/help/comments-mentions-and-reminders" }
    ],
    "domains": [
      { "id": "content-creation", "name": "内容创作", "userGoal": "快速把想法变成结构化文档", "relatedModules": ["doc-editor"] },
      { "id": "info-management", "name": "信息管理", "userGoal": "在大量页面中快速定位和归类", "relatedModules": ["sidebar", "database"] },
      { "id": "collaboration", "name": "多人协作", "userGoal": "感知他人存在不干扰自己", "relatedModules": ["comments"] },
      { "id": "system-feedback", "name": "系统反馈", "userGoal": "理解当前状态和下一步", "relatedModules": [] }
    ],
    "dimensions": [
      { "id": "content-creation.editor", "domain": "content-creation", "component": "editor", "name": "内容创作 · 编辑器", "role": "block 编辑器", "reviewFocus": "slash command / 粘贴处理 / 光标 / block 类型" },
      { "id": "content-creation.toolbar", "domain": "content-creation", "component": "toolbar", "name": "内容创作 · 工具栏", "role": "顶部 + inline 浮出", "reviewFocus": "动作可达性、分组、inline 召唤时机" },
      { "id": "info-management.list", "domain": "info-management", "component": "list", "name": "信息管理 · 列表", "role": "文档树 + 最近访问", "reviewFocus": "嵌套展开/收起、拖拽重排、收藏" },
      { "id": "collaboration.avatar-collab", "domain": "collaboration", "component": "avatar-collab", "name": "多人协作 · 协作痕迹", "role": "协作光标 + 头像栈", "reviewFocus": "实时度、身份识别、不干扰" },
      { "id": "system-feedback.empty-state", "domain": "system-feedback", "component": "empty-state", "name": "系统反馈 · 空状态", "role": "首次访问 / 搜索无结果", "reviewFocus": "情感化、next step 引导" }
    ]
  }
}
```

**关键字段**：
- `domains`：AI 在 Step 1.5 **现场推导**的 2-4 个功能域，**这个产品专属**，不要套模板
- `dimensions`：`<domain>.<component>` 组合，每个 dim 的 role 必须是"该产品里的具体实例"而不是组件通用描述

### competitors.json（新 schema）

```json
{
  "competitors": [
    {
      "id": "coda",
      "name": "Coda",
      "type": "product",
      "url": "https://coda.io/",
      "summary": "文档+数据库一体化竞品",
      "loginRequired": false,
      "moduleUrls": {
        "doc-editor": "https://coda.io/product",
        "database": "https://coda.io/product/tables",
        "sidebar": "https://coda.io/",
        "ai-assistant": "https://coda.io/product/ai",
        "comments": "https://coda.io/product"
      }
    },
    {
      "id": "google-docs",
      "name": "Google Docs",
      "type": "feature",
      "targetModules": ["doc-editor"],
      "url": "https://docs.google.com/document/u/0/",
      "summary": "长文档编辑的行业标杆（仅对比文档编辑模块）",
      "loginRequired": true,
      "moduleUrls": {
        "doc-editor": "https://docs.google.com/document/u/0/"
      }
    }
  ]
}
```

**关键字段**：
- `type`: `"product"` = 产品型（截所有模块）/ `"feature"` = 功能型（只截 targetModules 列出的模块）
- `targetModules`: 仅 `feature` 型需要，数组，内容必须是 product-profile.modules 里的 id

---

## 单独使用（脚本化）

除了端到端流程，每个脚本都可单独用：

**截图类**
- `scripts/capture.js` — 单 URL 截图
- `scripts/batch.js` — 批量 URL 截图（读 targets.json）
- `scripts/frame-extract.js` — 视频抽帧

**登录态**
- `scripts/login.js` — 手动保存 state
- `scripts/login-interactive.js` — AI 可调起的自动弹窗登录

**辅助**
- `scripts/verify-screenshots.js` — 截图质量检查
- `scripts/validate-data.js` — analysis-data.json schema 校验

### 单任务配方

```bash
# 纯批量截图
npm run batch -- --targets targets.json --out ./shots/

# 某站点要登录
npm run login -- --site xxx --url https://xxx.com/login --out ./.auth/

# 视频抽帧
npm run frames -- --in demo.mp4 --n 5 --out ./frames/

# 质量检查
npm run verify -- --dir ./shots/
```

---

## 文件结构

```
competitor-analysis-skill/
├── SKILL.md                          # 本文件（AI 主入口）
├── README.md
├── package.json
├── scripts/                          # 所有可执行脚本
│   ├── step1-analyze-product.js      # 产品画像（含系统内/外部双模式）
│   ├── step2-vet-competitors.js      # URL 预检
│   ├── step3-capture-all.js          # 双端批量截图（登录墙自动 + marketing 自愈 + explore + 视频 fallback）
│   ├── step3-explore.js              # Tier 1.5 主动探索：OpenClaw 模式找 Try/Open App 按钮
│   ├── step3-fallback-video.js       # Tier 2 视频抽帧 fallback
│   ├── step5-generate-site.js        # 生成独立站点
│   ├── capture.js / batch.js / clean-rules.js
│   ├── login.js / login-interactive.js
│   ├── frame-extract.js
│   ├── components-library.js         # v0.4：交互组件字典（12 个组件 + 推荐表）
│   └── verify-screenshots.js / validate-data.js
├── site-template/                    # 站点模板（支持产品型/功能型双展示）
├── templates/                        # Notion 示例
├── prompts/                          # AI 思考引导
│   └── gap-analysis.md
└── examples/                         # 参考项目（可选）
```

---

## 版本历史

- **v0.6.0**: 截图深度 + 兜底交互两个实战发现的补强
  - **多状态截图**：每个 module 默认产出 3 张（主屏 / 滚动 50% / 滚动 100%），解决"一张图看不到 fold 下内容"问题
  - **兜底方式 4 选 1**：`--fallback-mode=auto|manual|ask-first|skip`，优先让用户自贴截图（贴到指定 expectedFile 路径），视频抽帧降级为备选
  - **pending 机制**：manual/ask-first 模式会在 `fallback-pending/<compId>.json` 写待截图清单，用户贴完删 pending 继续
  - 向下兼容：不指定 --fallback-mode 即为 auto（和 v0.5 一样行为）
- **v0.5.3**: site-template 兼容 tier 分组（self/direct/inspiration），当数据没用 domestic/overseas 时自动 fallback
- **v0.5.2**: site-template 首屏支持目标导向视图（analysisGoals + keyInsightsByGoal）
- **v0.5.1**: 截图链路 2 个实战 bug 修复
  - `login-interactive.js` 登录检测过严 → 加 URL 稳定 10s 兜底
  - `step3-fallback-video.js` 内部 process.exit 杀主进程 → 改 throw 不中断批处理
- **v0.5.0**: 引入"目标导向"思辨——竞品分析不再是"看谁好"而是"为了解决我们的问题去借鉴谁"。新增 Step 0 分析目标设定（必做硬卡点 A0），用户先声明 1-3 个 goals（首屏留存/异步流失/学习成本/转化等）+ 假设性指标 + 预期收益；后续每一步都要引用 goal：domain 标 goalRelevance、competitor 标 targetGoals、Step 4 每个 cell 必填 `goalRelevance + expectedImpact + hypothesis`；新增 verdict `not-for-our-goal`（明确不借鉴）；分析报告加 `keyInsightsByGoal`（按目标分组的 top 3-5 借鉴）。彻底解决"AI 觉得竞品哪都好"的拍马屁倾向。
- **v0.4.1**: 功能域从"写死的 6 个"改为"每次由 AI 根据产品现场推导"
- **v0.4.0**: 分析视角从"商业维度"改为"交互组件"——用户是交互设计师，dimensions 不再是效率/灵活性这种 PM 视角，而是对话框/列表/工具栏/悬浮层等具体可对比的交互组件；新增 `scripts/components-library.js`；analysis-data 支持 `focusArea` + `componentTraits`
- **v0.3.3**: OpenClaw 式主动探索 — 新脚本 `step3-explore.js`，在营销页上自动找 Try/Open App 按钮递归点进真 UI，探索路径遇登录墙自动弹浏览器登录；verify 新增 landing-page-structure 检测（Pricing+CTA+Footer 三件套识别官网结构，识破 hero 里的 "假 UI 截图"）
- **v0.3.2**: 三级 Tier 架构 — 真 UI（登录截图）→ 视频抽帧 → 禁止营销页；verify 严格化让营销页必 fail；marketing 触发自动登录；新脚本 `step3-fallback-video.js` 自动抓官网 video 或 YouTube demo 抽帧
- **v0.3.1**: 反爬增强（Chrome args + stealth headers）；URL 修正（Notion 改版）；step5 截图重复 bug
- **v0.3.0**: 产品画像双模式（系统内自动/外部对话）+ 竞品双维度（产品型+功能型）+ 竞品数量 ≥5
- **v0.2.0**: 合并 competitor-capture；step3 自动登录；marketing 预检 + 自愈
- **v0.1.0**: 端到端 MVP
