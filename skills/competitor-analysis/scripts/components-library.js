/**
 * 交互组件字典（v0.4.1：组件 + 动态功能域）
 *
 * 【设计理念】
 * 用户是交互设计师，分析视角不能是：
 *   ❌ 商业 PM 视角："效率 / 灵活性 / 智能化"
 *   ❌ 孤立原子组件："dropdown / modal" （脱离语境没法比）
 *
 * 正确视角：
 *   ✅ 组件在具体功能场景里的角色
 *
 * 【关键：功能域不要写死】
 * 不同产品的功能域天差地别：
 *   - Notion 的功能域: 内容创作 / 内容管理 / 协作
 *   - Figma 的功能域: 画布操作 / 组件库 / 原型跳转 / 协同设计
 *   - Linear 的功能域: Issue 管理 / 流转 / 报表
 *   - Descript 的功能域: 录制 / 剪辑 / 转写 / 导出
 *
 * 因此：
 *   - 本字典**只**提供 12 个通用原子组件
 *   - 功能域由 AI 每次分析时根据产品特点**临时推导**
 *   - AI 用 promptForDomainInference() 拿到推导模板
 *
 * 使用姿势：
 *   const { COMPONENTS, promptForDomainInference } = require('./components-library.js');
 *
 *   // Step 1 阶段：让 AI 先推导功能域
 *   const prompt = promptForDomainInference(userProduct);
 *   // → 把 prompt 喂给 AI → AI 产出 2-4 个当前产品特有的功能域
 *
 *   // 然后 AI 自己组合：功能域 × 组件 = 分析 dimension
 */

// ============================================================
// 组件原子池（跨产品通用，稳定不变）
// ============================================================
const COMPONENTS = [
  // === 结构类 ===
  {
    id: 'nav',
    name: '导航',
    cat: 'structure',
    desc: '侧边栏 / 标签页 / 面包屑 / 顶部导航',
    examples: ['sidebar tree', 'tab bar', 'breadcrumb', 'app switcher'],
    generalReviewFocus: '信息架构层级、当前位置感、跳转成本',
  },
  {
    id: 'list',
    name: '列表',
    cat: 'structure',
    desc: '列表 / 表格 / 网格 / 卡片 / 看板',
    examples: ['data table', 'file grid', 'card list', 'kanban'],
    generalReviewFocus: '信息密度、排序筛选、选择操作、空状态',
  },
  {
    id: 'toolbar',
    name: '工具栏',
    cat: 'structure',
    desc: '顶部固定栏 / 浮动工具栏 / Context Bar',
    examples: ['editor toolbar', 'floating toolbar', 'context toolbar'],
    generalReviewFocus: '常用动作可达性、分组逻辑、状态反馈',
  },

  // === 浮层类 ===
  {
    id: 'modal',
    name: '对话框',
    cat: 'overlay',
    desc: 'Modal / Dialog / Drawer（阻塞式浮层）',
    examples: ['create new', 'share dialog', 'settings modal', 'confirm dialog'],
    generalReviewFocus: '触发路径、尺寸与布局、关闭方式、动画',
  },
  {
    id: 'popover',
    name: '悬浮层',
    cat: 'overlay',
    desc: 'Tooltip / Popover / Hover Card（非阻塞）',
    examples: ['mention preview', 'user profile card', 'link preview', 'formula helper'],
    generalReviewFocus: '触发时机、内容密度、定位算法、dismiss',
  },
  {
    id: 'dropdown',
    name: '菜单',
    cat: 'overlay',
    desc: '下拉菜单 / 右键菜单 / 选择器',
    examples: ['context menu', 'block type selector', 'filter dropdown', 'command palette'],
    generalReviewFocus: '层级、搜索能力、快捷键提示、icon 辨识',
  },

  // === 输入类 ===
  {
    id: 'form',
    name: '表单',
    cat: 'input',
    desc: '文本框 / 选择器 / 校验反馈',
    examples: ['signup form', 'property editor', 'search input', 'settings form'],
    generalReviewFocus: '填写节奏、校验时机、错误提示、成功反馈',
  },
  {
    id: 'editor',
    name: '编辑器',
    cat: 'input',
    desc: '富文本 / 代码 / Block 编辑器',
    examples: ['rich text', 'block editor', 'markdown', 'code editor'],
    generalReviewFocus: '光标行为、粘贴处理、快捷操作、block 类型丰富度',
  },
  {
    id: 'canvas',
    name: '画布',
    cat: 'input',
    desc: '2D/3D 画布 / 时间线 / 图形编辑',
    examples: ['figma canvas', 'video timeline', 'diagram canvas', 'whiteboard'],
    generalReviewFocus: '缩放平移、选择多选、对齐辅助、性能',
  },

  // === 反馈类 ===
  {
    id: 'feedback',
    name: '反馈',
    cat: 'feedback',
    desc: 'Toast / Notification / Banner / Inline Alert',
    examples: ['save success', 'error toast', 'usage limit banner', 'undo snackbar'],
    generalReviewFocus: '出现时机、可操作性、层级优先级、dismiss',
  },
  {
    id: 'empty-state',
    name: '空状态',
    cat: 'feedback',
    desc: 'Empty / Loading / Skeleton / Error Page',
    examples: ['no projects yet', 'first-time empty', 'search no result', '404'],
    generalReviewFocus: '情感化、引导 next step、视觉层次',
  },
  {
    id: 'onboarding',
    name: '引导',
    cat: 'feedback',
    desc: 'Tour / Tooltip Coachmark / Walkthrough / Checklist',
    examples: ['first-time tour', 'feature tip', 'getting started checklist'],
    generalReviewFocus: '侵入性、完成率、可跳过性、进度感',
  },
  {
    id: 'avatar-collab',
    name: '协作痕迹',
    cat: 'feedback',
    desc: 'Avatar / Cursor / Presence / Live Indicator',
    examples: ['cursor with name', 'avatar stack', 'typing indicator', 'selection sync'],
    generalReviewFocus: '实时感、不干扰感、身份识别、选择冲突',
  },
];

// ============================================================
// 给 AI 的"分析目标设定"引导（v0.5 新增，最先用）
// 让 AI 在做任何分析前，先和用户对齐"为什么要做这次分析"
// ============================================================

/**
 * 返回一段 prompt，让 AI 引导用户设定 1-3 个分析目标
 * 没有目标 → 后续分析会变成"竞品都很厉害"的拍马屁报告
 */
function promptForGoalSetting(userProductHint = {}) {
  const productName = userProductHint.name || '当前产品';

  return `## 分析目标设定（Step 0，最先做）

你正在为 **${productName}** 做竞品分析。
**第一件事不是扫产品代码、不是找竞品，而是问用户为什么要做这次分析。**

### 为什么必须先问目标？

没有目标的竞品分析 = 拍马屁：
- 看到竞品哪都好，全标 "borrow-strong"
- 最终洞察是"侧边栏好看、对话框动画不错"这种碎片
- 用户拿到报告不知道下一步做什么

### 你应该这么问用户

给用户 5-7 个常见目标做选项，让 ta 多选 / 补充 / 自定义：

📉 首屏留存低（用户进来一屏就跳走）
🚪 核心功能完成率低（启动了任务但没完成）
⏳ 异步等待流失（AI 任务等待期间用户跑了）
🎯 学习成本高（功能多但发现不到）
🔁 单次使用（用户用一次就不回来）
💰 转化差（免费到付费 / 看到 paywall 就走）
🤔 自定义（请描述你的问题）

### 拿到用户回答后，你要做三件事

1. **转译为可衡量指标**："留存不好" → "首屏 30s 跳出率 > 60%"（假设性也行）
2. **合并近义目标**：用户列了 5 条但其实是 2 类，帮忙收敛
3. **排优先级**：1 个 P0 必填，可选 P1 / P2，**总数 ≤ 3**

### 输出格式（写入 product-profile.json 的 analysisGoals 字段）

\`\`\`json
{
  "analysisGoals": [
    {
      "id": "onboarding-dropoff",
      "name": "首屏留存提升",
      "priority": "P0",
      "problem": "新用户进首页 30 秒内跳出率高，怀疑不理解产品能干啥",
      "hypotheticalMetric": "首屏 30s 跳出率 > 60% → 目标 < 40%",
      "expectedLift": "weekly active +25%"
    }
  ]
}
\`\`\`

### 给用户看的确认话术（A0 Checkpoint）

"我把你的问题整理成 N 个分析目标：
  - P0 · {name} ：{problem} → 假设指标 {metric} → 预期 {lift}
  - ...
这些抓准了吗？要增/删/改优先级请直说。"

### 关键提醒

- 即使用户说"直接开始就行"，也要追问一句"那你最想改进什么指标/体验？"
- **没有 goals 不要进 Step 1**。这是硬规则。
- goals 数量 1-3 个最佳，超过 3 个等于没目标
- 后续每一步都要引用 goal id（domain 标 goalRelevance、competitor 标 targetGoals、cell 标 goalRelevance + expectedImpact + hypothesis）
`;
}

// ============================================================
// 给 AI 的"功能域推导"引导
// 不预设域，让 AI 看着具体产品现场生成
// ============================================================

/**
 * 返回一段 prompt，让 AI 根据当前产品临时推导 2-4 个功能域
 * 每个功能域就是"用户在这个产品里的一类核心目标"
 *
 * AI 应该把这段 prompt 当思考清单用，而不是当模板套
 */
function promptForDomainInference(userProduct = {}) {
  const productName = userProduct.name || '当前产品';
  const productType = userProduct.type || '未指定';
  const summary = userProduct.summary || '';
  const modulesList = (userProduct.modules || []).map(m => `${m.id}(${m.name})`).join(', ') || '未指定';

  return `## 功能域推导（Step 1.5）

你现在要给 **${productName}**（类型: ${productType}）推导 2-4 个**专属功能域**。

产品信息：
  - 定位: ${summary}
  - 主要模块: ${modulesList}

**什么是功能域？**
功能域 = 用户在这个产品里想完成的一类核心目标 = 一组相关模块背后共享的用户意图。

**原则**：
1. **不要套模板**。不要用"内容创作 / 管理 / 协作"这种放之四海皆准的分法，除非这个产品真的长这样。
2. **要贴产品**。Figma 的功能域应该是"画布操作 / 组件复用 / 原型跳转 / 协同设计"，不是"内容创作"。
3. **2-4 个**。太多会稀释焦点，太少体现不出差异。
4. **从模块反推**。看用户列出的模块，它们服务于什么共同目标，这就是域。
5. **用户视角**。域名必须是"用户想干嘛"，不是"产品有什么功能"。

**输出格式**：
\`\`\`json
{
  "domains": [
    {
      "id": "canvas-operation",
      "name": "画布操作",
      "userGoal": "在画布上高效创建、定位、组织视觉元素",
      "relatedModules": ["canvas", "layers"],
      "whyThisDomain": "这是该产品最核心、最高频的用户活动，直接决定产品上手门槛和熟练后效率"
    },
    ...
  ]
}
\`\`\`

**反例**（❌ 不要这么写）：
\`\`\`json
{ "id": "content-creation", "name": "内容创作" }  // 太笼统，哪个产品都能套
\`\`\`

**正例**（✅ 贴产品）：
\`\`\`json
{ "id": "timeline-editing", "name": "时间线剪辑", "userGoal": "在时间轴上精准切分、移动、对齐素材片段" }
// 这是视频剪辑产品特有的域，不是通用的"内容创作"
\`\`\`
`;
}

/**
 * 给 AI 的"组件组合"引导
 * 推导完功能域后，AI 要把每个功能域配 1-2 个最核心的组件
 */
function promptForComponentBinding(domains = []) {
  const componentList = COMPONENTS.map(c => `  - \`${c.id}\` ${c.name}: ${c.desc}`).join('\n');
  const domainList = domains.map(d => `  - ${d.name}（${d.userGoal || ''}）`).join('\n');

  return `## 组件绑定（Step 1.5 续）

你刚推导出的功能域：
${domainList}

可选的原子组件池（12 个，稳定不变）：
${componentList}

**任务**：给每个功能域挑 **1-2 个最核心的组件**，组成最终分析的 dimension。

**输出格式**：
\`\`\`json
{
  "dimensions": [
    {
      "id": "timeline-editing.canvas",
      "domain": "timeline-editing",
      "domainName": "时间线剪辑",
      "component": "canvas",
      "componentName": "画布",
      "role": "时间线画布",
      "reviewFocus": "片段拖拽、多轨对齐、缩放、选择多选",
      "whyThisCombo": "时间线本质就是一种特化的画布，所有剪辑操作都在这上面发生"
    },
    ...
  ]
}
\`\`\`

**推荐规则**：
1. 每个 dimension = "<功能域>.<组件>"，id 用英文短横线
2. **role** 字段要把"抽象组件"落地成"这个产品里的具体实例"：
   - component=canvas + 域=timeline-editing → role="时间线画布"
   - component=dropdown + 域=content-creation → role="块类型 slash command"
   - component=list + 域=asset-management → role="素材库瀑布流"
3. **reviewFocus** 在"组件通用 reviewFocus"基础上加上"这个域的特殊关注点"
4. 总 dimension 数量控制在 4-6 个，太多没法细看

**反例**（❌）：
\`\`\`json
{ "role": "列表", "reviewFocus": "排序、筛选" }  // 只讲组件通用属性，没落地到产品
\`\`\`

**正例**（✅）：
\`\`\`json
{
  "role": "文档树 + 最近访问",
  "reviewFocus": "嵌套展开/收起、拖拽重排、收藏、权限标识、多账号切换"
}
\`\`\`
`;
}

// ============================================================
// 工具函数
// ============================================================

function getComponent(id) {
  return COMPONENTS.find(c => c.id === id);
}

function getComponents(ids) {
  return ids.map(id => COMPONENTS.find(c => c.id === id)).filter(Boolean);
}

module.exports = {
  COMPONENTS,
  getComponent,
  getComponents,
  promptForGoalSetting,
  promptForDomainInference,
  promptForComponentBinding,
};

// CLI
if (require.main === module) {
  const arg = process.argv[2];
  if (!arg || arg === '--help' || arg === '-h') {
    console.log('用法:');
    console.log('  node components-library.js --list           # 列出 12 个组件');
    console.log('  node components-library.js --prompt-goal    # ⭐ 打印"分析目标设定" prompt（v0.5，最先用）');
    console.log('  node components-library.js --prompt-domain  # 打印"功能域推导" prompt 模板');
    console.log('  node components-library.js --prompt-bind    # 打印"组件绑定" prompt 模板');
    process.exit(0);
  }
  if (arg === '--list' || arg === '--all') {
    console.log(JSON.stringify(COMPONENTS, null, 2));
  } else if (arg === '--prompt-goal') {
    console.log(promptForGoalSetting({ name: '<产品名>' }));
  } else if (arg === '--prompt-domain') {
    console.log(promptForDomainInference({ name: '<产品名>', type: '<产品类型>', summary: '<一句话定位>', modules: [{ id: 'm1', name: '模块1' }] }));
  } else if (arg === '--prompt-bind') {
    console.log(promptForComponentBinding([{ name: '<功能域示例>', userGoal: '<用户目标>' }]));
  } else {
    console.log(`未知参数: ${arg}，用 --help 查看用法`);
    process.exit(1);
  }
}
