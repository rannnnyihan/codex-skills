# Step 4: 差距分析 prompt

> 这份文档是 AI 在 Step 4 看每一对截图时应该怎么思考。

## 🎯 v0.5 最重要：目标导向（在一切之前）

**先读 `product-profile.json` 里的 `analysisGoals`。每一条 cell 分析都必须回到这些目标。**

如果用户的 goals 是：
- P0: `onboarding-dropoff`（首屏留存）
- P1: `async-wait-churn`（异步等待流失）

那么分析竞品的 doc-editor 工具栏（和两个 goal 都不相关）时：
- ❌ **错误做法**：看到竞品工具栏做得漂亮就标 `borrow-strong`
- ✅ **正确做法**：标 `verdict: not-for-our-goal`，在 `compare` 里明说"和当前 goals 无关，不借鉴"

**借鉴是手段，目标是根本**。每一条标 `borrow` / `borrow-strong` 的 cell 都必须能回答：

> 借鉴这个设计 → 能解决哪个 goal？预计带来多大改善？这个假设可验证吗？

如果回答不上，降级成 `not-for-our-goal` 或 `already`。

## 🎯 v0.4.1 核心视角：「该产品专属功能域」×「通用交互组件」

**用户是交互设计师**，分析视角 **必须**同时具备两点，不可只取其一：

1. **该产品专属的功能域**（由 AI 在 Step 1.5 现场推导，**不套模板**）
2. **具体可对比的交互组件**（从 12 个原子组件池里挑）

每个 cell（module × dimension）的 dimension 现在是 `<功能域>.<组件>` 的组合。例如：

- `content-creation.editor`（内容创作 · 编辑器）→ 看"block 编辑器怎么实现 slash 命令、粘贴、快捷键"
- `content-creation.dropdown`（内容创作 · 块类型选择）→ 看"召唤方式、分组、搜索、预览"
- `info-management.list`（信息管理 · 页面列表）→ 看"文档树嵌套、最近访问、拖拽重排"
- `collaboration.avatar-collab`（多人协作 · 协作痕迹）→ 看"光标同步、头像栈、typing indicator"
- `system-feedback.empty-state`（系统反馈 · 空状态）→ 看"首次访问 / 搜索无结果的情感化和引导"

⚠️ **dimension 的 role 必须落地**：不能写"编辑器"，要写"block 编辑器 + slash command"；不能写"列表"，要写"文档树 + 最近访问"。

**每个 cell 描述**应该讲：
1. **该组件在该功能域的这个模块里怎么被触发**（什么操作召出它）
2. **视觉形态和布局**（尺寸、位置、层级）
3. **交互行为**（dismiss 方式、动画、快捷键）
4. **值得借鉴的设计决策**（为什么这么做）

**错误（商业视角，禁用）**：
> "Coda 在文档编辑的效率上比 Notion 更高，因为有 formula 功能..."

**错误（只有组件没功能域，禁用）**：
> "Coda 的 toolbar 比 Notion 的 toolbar 更丰富..." — 哪个 toolbar？干嘛用的？

**正确（功能域 × 组件 × 具体决策）**：
> "Coda 在`content-creation.toolbar`（内容创作 · 工具栏）里，选中单元格时 **顶部浮出公式栏**（而非 Notion 的 inline / 拖拽 property），触发更明确。公式栏右侧有 'X / count / avg' 等 preset 按钮，降低新用户上手门槛。"

## ⚠️ 关键原则

### 原则 1：空白的/简陋的截图也值得分析

用户产品某个模块截图看起来"空白"或"简陋"（比如 result 页只有一个提示或空状态），**这恰恰是分析最有价值的地方**：
- 它暴露了用户产品在这个模块的投入不足
- 对应竞品做了什么（即使只是一个丰富的卡片列表）都是宝贵的差距证据
- 不要跳过这种 pair，反而要优先写

**错误示例**：
> "用户产品的 result 页是空白，没什么可分析的。"

**正确示例**：
> "用户产品的 result 页目前只有基础文件列表，对比竞品的卡片矩阵（含缩略图 + 命名 + 悬浮预览），用户完成创作后的成就感和二次利用能力弱很多。"

### 原则 2：标注质量 > 标注数量

**不要为了填充每个 module 都强行标 5 个标注**。规则：
- **有值得指出的** → 标 2-4 个（最多 5 个）
- **没有明显看点** → 标 1 个主区域就行，甚至可以留空数组 `"annotations": []`
- 每个标注的 `note` 必须有 why（为什么值得指出），不是单纯的 what（是什么）

**错误示例**：
```json
{ "label": "按钮", "note": "一个蓝色按钮" }  // 没 why
```

**正确示例**：
```json
{ "label": "拖拽区", "note": "占据视觉中心 60%，placeholder 直接演示用法，降低首次使用门槛" }
```

### 原则 3：verdict 要有取舍（v0.5：加 `not-for-our-goal`）

默认别把所有竞品都打成 "borrow-strong"。用这个分布指导：

| verdict | 占比目标 | 使用场景 |
|---------|---------|---------|
| `borrow-strong` | ~10% | 竞品设计突出 + 实现成本低 + **直接击中某个 goal** |
| `borrow` | ~25% | 有可借鉴点 + **能打中 goal**（即使不紧迫） |
| `improve` | ~15% | 用户产品已有但做得不够 + 对 goal 有帮助 |
| `already` | ~15% | 用户产品这块已经比竞品好 |
| `not-for-our-goal` | ~25% | **竞品做得好但跟我们当前 goals 无关，明确不借鉴** ⭐ v0.5 新增 |
| `not-applicable` | ~10% | 场景不适合（和 goals 无关不要用这个，用 not-for-our-goal） |

**如果一份分析报告里 `not-for-our-goal` 比例 < 15%，说明你没在"筛选"在"拍马屁"。**

一个健康的分析：能大胆说"这个我们先不学，现阶段不解决我们的问题"。

---

## 输入

- `<screenshots>/user/<moduleId>.png` — 用户产品的某个模块截图（**主屏 above-the-fold**）
- `<screenshots>/user/<moduleId>-scroll50.png` — 滚动到页面中部（v0.6 新增）
- `<screenshots>/user/<moduleId>-bottom.png` — 滚动到页面底部（v0.6 新增）
- `<screenshots>/competitors/<compId>-<moduleId>.png` — 竞品主屏
- `<screenshots>/competitors/<compId>-<moduleId>-scroll50.png` — 竞品中部（v0.6）
- `<screenshots>/competitors/<compId>-<moduleId>-bottom.png` — 竞品底部（v0.6）
- `<screenshots>/competitors/<compId>-<moduleId>.dom.json` — 主屏 DOM 元素位置（百分比坐标）
- `<screenshots>/_verify-report.json` — 质量检查结果
- `<screenshots>/_capture-manifest.json` — 截图清单 + 每条 `extraShots` 字段指向滚动态
- `<screenshots>/fallback-pending/<compId>.json`（可能存在）— 用户手贴图待完成清单

**v0.6 分析提醒**：
1. **必看 3 张**（主屏 + scroll50 + bottom），**不要只看主屏就下判断**。很多关键信息（价格 / 功能列表 / FAQ）在 fold 下。
2. 如果没有 scroll/bottom 文件（全屏画布类产品），在 observation 里注明"仅主屏可见"，不要编造 fold 下的内容。
3. 如果发现 `fallback-pending` 目录还有文件，说明用户还没贴完图，在报告 meta 里标一行"⚠ 以下竞品截图依赖用户手贴，尚未就绪：[compId 列表]"。

## 思考框架（每一对都要走完）

### 1. 「竞品在做什么」（observation）

看竞品截图，**用交互设计师视角**回答：
- 它解决什么用户问题？
- 用什么交互形态？（按钮 / 拖拽 / 步骤引导 / 对话流 / 分栏 / ...）
- 这个形态有什么 affordance（可供性）暗示？
- 关键的视觉权重放在哪里？

写一段 2-4 句的 observation，**不要罗列功能**，要描述**交互逻辑**。

### 2. 「双方做法对比」（vsCompetitor + userProductDoing）

- `vsCompetitor`：一句话总结竞品的做法（≤30 字）
- `userProductDoing`：一句话总结用户产品的做法（≤30 字）
  （兼容老字段名 `vsTideo`，但新数据请用 `userProductDoing`）

例：
- vsCompetitor: "拖拽即上传，placeholder 直接演示用法"
- userProductDoing: "需先选'本地/链接/录屏'三选一，再显示输入框"

### 3. 「差距 + 启发」（compare）

回答 3 个问题：
- 竞品比用户产品**好在哪**？（具体的、可执行的，不要"更好用"这种废话）
- 用户产品**学得了**吗？（成本评估）
- 学的话**怎么改**？（具体到 UI 改动方向）

写一段 3-6 句的 compare，要有**判断**而不是只描述。

### 4. 「行动项」（actionItem）

把上面的"怎么改"压缩成一句**可执行的工程任务**：

例：
- "P1: 重构 InputArea 组件，把模式切换从主 CTA 降级为次级 tab"
- "P2: 给 Settings 加搜索框，参考 Descript 的 cmd+k 入口"
- "P3: 在 Header 加'最近用过'快捷面板，参考 Linear 的样式"

带优先级（P1=高 P2=中 P3=低）。

### 5. 「目标连接」（goalRelevance + expectedImpact + hypothesis） ⭐ v0.5 必填

**这是 v0.5 的核心**。不写这三个字段的 cell 不算合格的分析。

```json
{
  "goalRelevance": "onboarding-dropoff",
  "expectedImpact": {
    "metric": "首屏 30s 跳出率",
    "direction": "↓",
    "estimate": "预计 -5 到 -10pp",
    "confidence": "medium"
  },
  "hypothesis": "假设用户跳出是因为看不懂能干啥；竞品用 3 秒动效 demo 替代静态 hero，把'做什么'从文字说明变成视觉演示；借鉴后用户在第一屏就能理解主要能力，跳出率应显著下降"
}
```

字段说明：
- **`goalRelevance`**：这条借鉴**主要**解决 Step 0 里哪个 `goal.id`？一条只能选 1 个主 goal（可在 `secondaryGoals` 里加次要的）
- **`expectedImpact.metric`**：具体哪个数字会变（对应 goal.hypotheticalMetric）
- **`expectedImpact.direction`**：`↑` 或 `↓`
- **`expectedImpact.estimate`**：粗估量级（"+3-5pp"/"-10-20%"），不用太精确，**但不能空**
- **`expectedImpact.confidence`**：`high`/`medium`/`low` — 你对这个估计有多确定
- **`hypothesis`**：**一句因果链**：`因为[用户行为/心理] → 竞品[设计决策] → 借鉴后[预期行为] → 指标[怎么变]`
  - hypothesis 必须是**可被 A/B 或用户测试证伪的**
  - ❌ "借鉴后体验会更好" — 不可证伪
  - ✅ "借鉴后首次操作完成率应从 40% 升到 55%" — 可测

**如果 `verdict=not-for-our-goal`**：
- `goalRelevance` 填 `"none"`
- `expectedImpact` 填 `null`
- `hypothesis` 填 "和当前 goals 无关，不进入改进 backlog"

### 6. 「评估」（impact + effort + verdict）

- `impact` (1-5)：**对已声明 goal 的提升幅度**（v0.5 改了释义：不是"对产品的整体提升"而是"对该 goal 的贡献"）
- `effort` (1-5)：实现成本有多高（5=最高）
- `verdict`: `borrow-strong` / `borrow` / `improve` / `already` / `not-for-our-goal` / `not-applicable`

判断逻辑：
- `borrow-strong`: 直接击中 P0 goal + impact ≥4 + effort ≤3
- `borrow`: 击中任一 goal + impact ≥3 + effort ≤4
- `improve`: 用户产品已有但做得不够 + 对某 goal 有帮助
- `already`: 用户产品已经比竞品好
- `not-for-our-goal`: **竞品做得可能很好但跟我们当前 goals 无关**（v0.5 新增，用来避免"什么都觉得值得学"）
- `not-applicable`: 场景/技术约束上根本不适用

**v0.5 硬规则**：
- 所有 `borrow` / `borrow-strong` / `improve` 的 cell 都必须填 `goalRelevance`（非空）
- 不能填的 → 强制降级到 `not-for-our-goal`

### 7. 「焦点区域」（focusArea）

每个 cell 的 dimension 是**具体组件**（modal / list / toolbar 等），所以一张截图里**只有局部**是该组件的部分。`focusArea` 用百分比坐标圈出"该组件在截图里的位置"：

```json
{
  "focusArea": { "x": 30, "y": 18, "w": 40, "h": 50 },
  "_note": "新建文档 Modal 占居中区域，左侧模板 + 右侧预览"
}
```

站点会在截图上画红框突出这个区域，让 reviewer 一眼定位到组件位置。

### 7. 「组件特征」（componentTraits，v0.4 新增，可选但强烈建议）

按交互设计师视角，把组件的**关键设计决策**结构化抽取出来。**不同组件有不同的关注点**：

**modal（对话框）**：
```json
"componentTraits": {
  "trigger": "点击 sidebar + 按钮 / 快捷键 Cmd+N",
  "layout": "居中 720×600，左侧模板网格 + 右侧预览",
  "dismiss": "ESC / 点击遮罩 / 关闭按钮",
  "animation": "fade + scale 200ms"
}
```

**list（列表）**：
```json
"componentTraits": {
  "viewModes": "list / grid / kanban 三视图切换",
  "density": "默认 compact，每行 56px",
  "actions": "hover 显示行内 actions，右键 context menu",
  "empty": "空状态有插画 + 'Create your first page' CTA"
}
```

**toolbar（工具栏）**：
```json
"componentTraits": {
  "position": "顶部固定 + 选中文字时浮出 inline toolbar",
  "grouping": "Format / Insert / View 三组",
  "responsive": "宽度不足时折叠到 overflow menu",
  "shortcut": "工具栏按钮 hover 显示快捷键 tooltip"
}
```

**popover（悬浮层）**：
```json
"componentTraits": {
  "trigger": "hover 200ms / @ 提及输入",
  "position": "智能定位（避免出屏）",
  "content": "用户头像 + 名字 + 状态 + 上次活跃",
  "dismiss": "鼠标移开 + ESC + 滚动"
}
```

**没有合适字段就留空**。重点：每个键的内容都是设计师能直接拿去做对比的"决策点"。

### 8. 「标注」（annotations）

打开 `<screenshot>.dom.json`，里面有按面积排序的 80 个元素。**选 2-4 个对分析最关键的元素**打标：

```json
{
  "id": 1,
  "x": 30, "y": 25, "w": 40, "h": 35,
  "label": "拖拽区",
  "note": "占据视觉中心，placeholder 直接演示用法"
}
```

**坐标已经是百分比**，直接用 dom.json 里的 x/y/w/h。

**选择标注的原则**：
- 体现"竞品好在哪"的关键 UI 元素
- 不要标超过 5 个（截图会变花）
- label 简短（2-6 字），note 详细一点（说明 why）

### 9. 「标签」（tags）

可选，给每条 module 加 1-3 个 tag：

```json
"tags": [
  ["good", "拖拽优先"],
  ["pattern", "单步设计"],
  ["info", "降低决策成本"]
]
```

类型：`good` / `bad` / `pattern` / `info` / `warning`

## 输出格式

把所有 module records 拼成一个数组，连同 meta 一起写到 `analysis-data.json`：

```json
{
  "meta": {
    "userProduct": { "name": "...", "monogram": "...", "homeUrl": "...", "screenshotDir": "user" },
    "screenshotPathPrefix": "assets/screenshots/competitors/",
    "analysisGoals": [
      {
        "id": "onboarding-dropoff",
        "name": "首屏留存提升",
        "priority": "P0",
        "problem": "新用户首屏 30s 跳出率高",
        "hypotheticalMetric": "跳出率 > 60% → 目标 < 40%",
        "expectedLift": "weekly active +25%"
      }
    ],
    "dimensions": [...],
    "verdicts": [
      {"id": "borrow-strong", "label": "强烈建议借鉴", "color": "#15803d", "bg": "#bbf7d0", "priority": 5},
      {"id": "borrow", "label": "可借鉴", "color": "#15803d", "bg": "#dcfce7", "priority": 3},
      {"id": "improve", "label": "需改进", "color": "#991b1b", "bg": "#fee2e2", "priority": 4},
      {"id": "already", "label": "已超越", "color": "#92400e", "bg": "#fef3c7", "priority": 1},
      {"id": "not-for-our-goal", "label": "目标无关不借鉴", "color": "#475569", "bg": "#e2e8f0", "priority": 0},
      {"id": "not-applicable", "label": "不适用", "color": "#64748b", "bg": "#f1f5f9", "priority": 0}
    ]
  },
  "products": [...],
  "modules": [...],
  "keyInsightsByGoal": [
    {
      "goalId": "onboarding-dropoff",
      "goalName": "首屏留存提升",
      "topRecommendations": [
        {
          "title": "把首屏从'卡片选择'改成'动效演示+输入框'",
          "sourceCompetitor": "Runway",
          "sourceCellId": "home.skill-onboarding.list",
          "expectedImpact": { "metric": "首屏 30s 跳出率", "direction": "↓", "estimate": "-5 到 -10pp" },
          "hypothesis": "...",
          "priority": "P0",
          "effort": 3
        }
      ]
    }
  ]
}
```

**v0.5 关键**：`keyInsightsByGoal` 是 Step 5 站点的首屏核心展示，**每个 goal 下列 3-5 条最值得落地的借鉴**，按 priority × impact / effort 排序。

## 重要提醒

- **必须看图**，不要只读 DOM 文本
- **必须从交互设计角度**，不是商业 / 技术角度
- **每条 module 的 observation 不能跟 compare 重复**，前者描述，后者判断
- **不要给所有竞品都打 verdict=borrow-strong**，要有取舍
- **v0.5**：每条 borrow/improve 必有 goalRelevance + expectedImpact + hypothesis，缺任何一个都是不合格分析
- **v0.5**：not-for-our-goal 比例 < 15% = 你在拍马屁，重写
