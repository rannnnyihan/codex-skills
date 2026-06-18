#!/usr/bin/env node
/**
 * 截图质量检查器
 *
 * 扫描 step3 产出的截图 + .dom.json + 页面 meta，识别 4 种坏截图：
 *
 *   1. login-wall    截到了登录墙（不是功能页）
 *   2. error-page    截到了 404/500/"page not found"
 *   3. empty         DOM 元素过少（< 3），加载失败或空白页
 *   4. marketing     截到了官网营销页（典型特征：只有 Pricing/Get Started/Book Demo 按钮）
 *
 * 用法：
 *   node scripts/verify-screenshots.js --dir <screenshots-dir>
 *
 * 产物：
 *   <dir>/_verify-report.json
 *
 * 退出码：
 *   0 = 全部通过 / 1 = 有 issue
 */

const fs = require('fs');
const path = require('path');

// === 规则特征库 ===

const LOGIN_WALL_SIGNALS = [
  /sign in with/i, /continue with google/i, /continue with facebook/i,
  /continue with tiktok/i, /continue with apple/i, /continue with discord/i,
  /welcome to/i, /sign in to use/i, /log in to continue/i,
  /创建账户/, /立即登录/, /扫码登录/,
];
const LOGIN_WALL_COMBO = [
  /enter email/i, /password/i, /sign up/i,
];

const ERROR_PAGE_SIGNALS = [
  /^404$/i, /^404!/i, /page not found/i, /page doesn['’]t exist/i,
  /you must be lost/i, /^500/i, /internal server error/i,
  /not found/i, /something went wrong/i,
  /^页面不存在/, /找不到/,
];

const MARKETING_SIGNALS = [
  // 行动号召（营销页高频）
  /get started/i, /get started free/i, /start (free|for free)/i,
  /book a demo/i, /request a demo/i, /contact sales/i, /talk to sales/i,
  /start free trial/i, /try (it )?free/i, /try for free/i,
  /join the waitlist/i, /join waitlist/i, /sign up free/i,
  /watch (the )?(demo|video)/i, /see it in action/i,
  // 定价/品牌信任
  /pricing/i, /simple pricing/i, /transparent pricing/i,
  /trusted by/i, /loved by/i, /used by \d/i, /million users/i,
  /customer stories/i, /testimonials/i, /case studies/i,
  // 中文营销词
  /免费试用/, /立即开始/, /预约演示/, /联系销售/, /加入候补/,
  /观看演示/, /了解更多/, /立即体验/,
];

// 识别功能页的正向信号（出现说明不是营销页）
const FUNCTIONAL_SIGNALS = [
  // 核心动作动词
  /upload/i, /drag.+drop/i, /拖拽/, /拖.+上传/,
  /generate/i, /render/i, /export/i, /download/i,
  /save/i, /publish/i, /preview/i, /play/i, /pause/i,
  /新建/, /保存/, /导出/, /生成中/, /渲染/,
  // 工作区/编辑器
  /canvas/i, /timeline/i, /editor/i, /workspace/i, /dashboard/i,
  /my (project|library|work|file)/i, /untitled/i, /my projects/i,
  /recent (project|file)/i, /new (project|file)/i,
  // 参数/配置类（功能页常见）
  /参数/, /模型/, /设置/, /配置/, /项目/, /素材/,
  /settings/i, /preferences/i, /parameters/i,
  // 进度/状态
  /\d+%/, /processing/i, /generating/i, /uploading/i, /rendering/i,
  // 常见功能控件
  /prompt/i, /enter your/i, /type (here|a|your)/i,
  /select (a |an |the )?(model|option|style|voice|language)/i,
];

/**
 * 验证单张截图
 * @param {string} pngPath
 * @returns {Object} { ok, issue, confidence, hints }
 */
function verifyOne(pngPath) {
  const result = {
    file: path.basename(pngPath),
    ok: true,
    issue: null,            // null / 'login-wall' / 'error-page' / 'empty' / 'marketing' / 'missing'
    confidence: 1.0,
    hints: [],
    size: 0,
    domCount: 0,
  };

  if (!fs.existsSync(pngPath)) {
    result.ok = false; result.issue = 'missing';
    result.hints.push('截图文件不存在');
    return result;
  }

  const stat = fs.statSync(pngPath);
  result.size = stat.size;

  // 尺寸异常（<10KB 基本是空白或错误页）
  if (stat.size < 10 * 1024) {
    result.ok = false; result.issue = 'empty';
    result.confidence = 0.9;
    result.hints.push(`截图只有 ${Math.round(stat.size / 1024)}KB（一般功能页 >100KB），可能加载失败`);
    return result;
  }

  // 读 DOM
  const domPath = pngPath.replace(/\.png$/, '.dom.json');
  if (!fs.existsSync(domPath)) {
    result.hints.push('无 .dom.json，无法深度分析');
    return result;
  }
  const dom = JSON.parse(fs.readFileSync(domPath, 'utf-8'));
  result.domCount = Array.isArray(dom) ? dom.length : 0;

  // 把所有元素的文本拼成一个 blob，用于规则匹配
  const texts = (Array.isArray(dom) ? dom : []).map(el => el.text || '').filter(Boolean);
  const blob = texts.join(' | ');

  // DOM 元素过少
  if (result.domCount < 3) {
    result.ok = false; result.issue = 'empty';
    result.confidence = 0.85;
    result.hints.push(`DOM 元素只有 ${result.domCount} 个（正常功能页应 >10 个），可能加载未完成`);
    return result;
  }

  // === 识别 error 页（优先级最高）===
  for (const re of ERROR_PAGE_SIGNALS) {
    if (re.test(blob)) {
      result.ok = false; result.issue = 'error-page';
      result.confidence = 0.95;
      result.hints.push(`检测到错误页特征文字: "${blob.match(re)[0]}"`);
      return result;
    }
  }

  // === 识别登录墙 ===
  // 策略 A：数出现次数（多个 "Sign in with X" 按钮 = 强信号）
  let loginScore = 0;
  const signInWithMatches = (blob.match(/sign in with/gi) || []).length +
    (blob.match(/continue with/gi) || []).length +
    (blob.match(/log in with/gi) || []).length;
  if (signInWithMatches >= 2) {
    // 2+ 个第三方登录按钮 = 登录墙几乎确定
    result.ok = false; result.issue = 'login-wall';
    result.confidence = 0.95;
    result.hints.push(`检测到 ${signInWithMatches} 个第三方登录按钮（Sign in with / Continue with / Log in with），几乎确定是登录墙`);
    result.hints.push('建议：step3 会自动弹浏览器让你登录并重截');
    return result;
  }

  // 策略 B：规则累加 score
  for (const re of LOGIN_WALL_SIGNALS) {
    if (re.test(blob)) loginScore += 2;
  }
  for (const re of LOGIN_WALL_COMBO) {
    if (re.test(blob)) loginScore += 1;
  }
  // 有非常强的功能页信号能抵消登录墙分数
  // 注意：功能词用出现次数算分（同一个词出现多次 = 更强信号）
  let functionalScore = 0;
  const functionalMatched = [];
  for (const re of FUNCTIONAL_SIGNALS) {
    const hits = (blob.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) || []).length;
    if (hits > 0) {
      functionalScore += hits;
      functionalMatched.push(re.source);
    }
  }

  if (loginScore >= 3 && functionalScore < 2) {
    result.ok = false; result.issue = 'login-wall';
    result.confidence = Math.min(0.5 + loginScore * 0.1, 0.95);
    result.hints.push(`登录墙特征强（score=${loginScore}, 功能信号弱 score=${functionalScore}）`);
    result.hints.push('建议：step3 会自动弹浏览器让你登录并重截');
    return result;
  }

  // === 识别营销页 ===
  // 营销词也用出现次数算分（Pricing 菜单+Pricing 按钮+"our pricing"一起出现是强信号）
  let marketingScore = 0;
  const marketingMatched = [];
  for (const re of MARKETING_SIGNALS) {
    const hits = (blob.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) || []).length;
    if (hits > 0) {
      marketingScore += hits;
      marketingMatched.push(re.source);
    }
  }

  // 判定：营销词显著多于功能词
  // v0.3.1 严格化：营销页必须明确 fail，让 step3 触发 fallback（视频抽帧 / help 中心截图）
  // 规则 1: 营销信号 >= 3 且功能信号 < 2 → 几乎确定是营销 hero
  // 规则 2: 营销信号 >= 5 且营销 > 功能 * 1.5 → 营销密度过高（即使有几个功能词也判失败）
  //         典型场景：Notion / Craft 的 /product/xxx 页面，"Get Started"出现 3-4 次但也写了"editor / canvas"等词
  // 规则 3（v0.3.2 新增）: landing page 结构（有 Pricing 菜单 + Get Started CTA + Footer About/Terms）
  //         这是为了识别"官网里 hero 区有 product screenshot"的情况 —
  //         截图里看起来有很多 UI 元素（工具栏/项目名/sidebar）让 functionalScore 高，
  //         但实际是官网营销结构，不是真 product UI
  const ruleStrong = marketingScore >= 3 && functionalScore < 2;
  const ruleDense = marketingScore >= 5 && marketingScore > functionalScore * 1.5;
  // Landing page 结构特征：Pricing + (Get Started / Contact Sales) + (Terms / About)
  const hasPricingNav = /\bpricing\b/i.test(blob);
  const hasCta = /\b(get started|start free|contact sales|book a demo|try free|request a demo)\b/i.test(blob);
  const hasFooterLinks = /\b(about|privacy|terms|careers|blog|contact us)\b/i.test(blob);
  const ruleLandingStructure = hasPricingNav && hasCta && hasFooterLinks && marketingScore >= 3;

  if (ruleStrong || ruleDense || ruleLandingStructure) {
    result.ok = false; result.issue = 'marketing';
    const triggered = ruleLandingStructure ? 'landing-结构' : (ruleDense ? 'mkt-密度' : 'mkt-强');
    result.confidence = ruleLandingStructure
      ? 0.85
      : (ruleStrong
        ? Math.min(0.7 + (marketingScore - functionalScore) * 0.05, 0.95)
        : Math.min(0.6 + marketingScore * 0.03, 0.85));
    result.hints.push(`官网营销页（${triggered}：营销 ${marketingScore}${marketingMatched.length > 0 ? ` [${marketingMatched.slice(0, 3).join(', ')}...]` : ''}，功能 ${functionalScore}${ruleLandingStructure ? '，含 Pricing+CTA+Footer 三件套' : ''}）`);
    result.hints.push('建议：step3 应触发 explore（寻找 Try/Open App 按钮）或 fallback（视频抽帧），不要把营销截图作为分析数据');
    result.marketingScore = marketingScore;
    result.functionalScore = functionalScore;
    result.landingPageStructure = ruleLandingStructure;
    return result;
  }

  // 附带功能/营销分数（即使通过也带上，方便 step3 做更细决策）
  result.marketingScore = marketingScore;
  result.functionalScore = functionalScore;

  return result;
}

/**
 * 扫描整个截图目录
 */
function verifyDir(dir) {
  const report = {
    generatedAt: new Date().toISOString(),
    dir,
    total: 0, ok: 0, issues: 0,
    byIssue: { 'login-wall': 0, 'error-page': 0, 'empty': 0, 'marketing': 0, 'missing': 0 },
    results: [],
  };

  // 递归找所有 .png（含子目录 user/ competitors/）
  function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name.endsWith('.png')) report.results.push({ path: full, ...verifyOne(full) });
    }
  }
  walk(dir);

  report.total = report.results.length;
  report.results.forEach(r => {
    if (r.ok) report.ok++;
    else {
      report.issues++;
      if (r.issue) report.byIssue[r.issue] = (report.byIssue[r.issue] || 0) + 1;
    }
  });

  // 写 report
  fs.writeFileSync(path.join(dir, '_verify-report.json'), JSON.stringify(report, null, 2));
  return report;
}

function printReport(report) {
  console.log(`\n[verify] 扫描 ${report.total} 张截图`);
  console.log(`[verify] ✓ 通过 ${report.ok} / ⚠ 问题 ${report.issues}`);

  if (report.issues > 0) {
    console.log(`[verify] 问题分布:`);
    Object.entries(report.byIssue).forEach(([k, v]) => {
      if (v > 0) console.log(`  - ${k}: ${v}`);
    });
    console.log(`\n[verify] 问题详情:`);
    report.results.filter(r => !r.ok).forEach(r => {
      console.log(`  ✗ ${r.file}  [${r.issue}, 置信度 ${r.confidence.toFixed(2)}]`);
      r.hints.forEach(h => console.log(`    · ${h}`));
    });
  }
  console.log('');
}

// CLI
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dir) {
    console.error('用法: node verify-screenshots.js --dir <screenshots-dir>');
    process.exit(1);
  }
  const report = verifyDir(path.resolve(args.dir));
  printReport(report);
  process.exit(report.issues > 0 ? 1 : 0);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) args[key] = true;
      else { args[key] = next; i++; }
    }
  }
  return args;
}

module.exports = { verifyOne, verifyDir, printReport };
