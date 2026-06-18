#!/usr/bin/env node
/**
 * Step 1: 产品画像
 *
 * 两种模式：
 *   A. 有 URL（系统内产品 / 外部产品有公开 URL）
 *      → 截首页 + 抓 DOM + 写骨架
 *   B. 无 URL（--no-url，纯外部产品/只有文档）
 *      → 只写骨架，AI 通过对话填字段
 *
 * 用法:
 *   # 模式 A（有 URL）
 *   node scripts/step1-analyze-product.js \
 *     --url http://localhost:3000 --name MyProduct --out ./work/ \
 *     [--state ./.auth/xxx-state.json]
 *
 *   # 模式 B（无 URL）
 *   node scripts/step1-analyze-product.js \
 *     --no-url --name MyProduct --out ./work/
 *
 * 输出（模式 A）：
 *   <out>/user-product/home.png        首页截图
 *   <out>/user-product/home.dom.json   首页 DOM 结构
 *   <out>/user-product/discovery.json  可点击入口候选
 *   <out>/product-profile.json         骨架（AI 填 __AI_FILL__）
 *
 * 输出（模式 B）：
 *   <out>/product-profile.json         骨架（AI 通过对话填）
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const { capture } = require('./capture.js');
const { recommendComponents, toDimensionsFormat } = require('./components-library.js');

async function analyze({ url, name, out, state, noUrl = false }) {
  const userDir = path.join(out, 'user-product');
  fs.mkdirSync(userDir, { recursive: true });

  console.log(`\n[step1] 分析用户产品: ${name}`);
  console.log(`[step1] 模式: ${noUrl ? 'B 无 URL（对话式）' : 'A 有 URL（自动）'}`);
  if (!noUrl) console.log(`[step1] URL: ${url}`);
  console.log(`[step1] 输出: ${userDir}\n`);

  let homePath, domPath, discoveryPath;

  if (!noUrl) {
    // === 模式 A：有 URL，跑完整截图 + DOM 抓取 ===
    console.log('[step1] (1/3) 截首页...');
    homePath = path.join(userDir, 'home.png');
    const cap = await capture({
      url,
      out: homePath,
      state,
      wait: 5000,
      preClean: true,
      viewport: [1440, 900],
    });
    console.log(`  ✓ ${homePath} (清扫 ${cap.killed} 个浮层)`);

    console.log('[step1] (2/3) 抓 DOM 结构...');
    const browser = await chromium.launch({ headless: true });
    const ctxOpts = {
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    };
    if (state && fs.existsSync(state)) ctxOpts.storageState = state;
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();

    let domStructure;
    let discovery;
    try {
      page.on('dialog', d => d.dismiss().catch(() => {}));
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);

      domStructure = await page.evaluate(extractDomStructure);
      discovery = await page.evaluate(extractDiscovery);
    } finally {
      await ctx.close();
      await browser.close();
    }

    domPath = path.join(userDir, 'home.dom.json');
    fs.writeFileSync(domPath, JSON.stringify(domStructure, null, 2));
    console.log(`  ✓ ${domPath} (找到 ${domStructure.sections.length} 个 section)`);

    discoveryPath = path.join(userDir, 'discovery.json');
    fs.writeFileSync(discoveryPath, JSON.stringify(discovery, null, 2));
    console.log(`  ✓ ${discoveryPath} (${discovery.length} 个候选入口)`);
  } else {
    // === 模式 B：无 URL，跳过截图和 DOM 抓取 ===
    console.log('[step1] (1/1) 无 URL，跳过截图，直接写骨架...');
  }

  // === 写 product-profile.json 骨架（两种模式共用）===
  console.log('[step1] 写产品 profile 骨架...');
  const profileSkeleton = {
    userProduct: {
      id: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      name,
      monogram: name.charAt(0).toUpperCase(),
      url: url || '__AI_FILL__: 产品 URL（无 URL 时留 null）',
      homeUrl: url || '__AI_FILL__: 首页 URL（无 URL 时留 null）',
      type: '__AI_FILL__: 产品类型（一句话）— 例如: document / editor / canvas / video / admin / dashboard / saas',
      summary: '__AI_FILL__: 产品定位（一句话）',
      modules: '__AI_FILL__: 5 个核心功能模块（id/name/url），必须是用户会使用的真实功能区域',
      dimensions: '__AI_FILL__: 3-5 个交互组件维度（id/name/desc）—— 注意：v0.4 起 dimensions = 交互组件，不再是"效率/灵活性"这种商业维度',
      _hint: {
        modules:
          '每个模块对应产品的一个功能区域（例：文档编辑 / 数据库 / AI 助手 / 评论协作 / 左侧导航）。每个必须有 url 字段指向真实功能页。',
        dimensions: [
          '**重要变更（v0.4）**：dimensions 字段现在应填"交互组件"，例如：对话框/列表/导航/表单/悬浮层/工具栏/菜单/反馈/空状态',
          '不要再填"效率/灵活性/智能化/协作"这种商业分析维度（PM 视角，设计师用不上）',
          '推荐从 scripts/components-library.js 里挑 3-5 个（已提供推荐），或自定义',
          '目的：用户是交互设计师，需要按"具体组件的设计决策"做 design review，不是做商业对比',
        ],
        mode: noUrl
          ? 'B（无 URL）：AI 通过对话问用户补全 type/summary/modules/dimensions(组件)'
          : 'A（有 URL）：AI 结合 home.png + home.dom.json + discovery.json 自己推断',
        dimensionsRecommendation: '确定 userProduct.type 后，AI 可用 `node scripts/components-library.js <type>` 查询推荐组件',
      },
    },
  };
  const profilePath = path.join(out, 'product-profile.json');
  fs.writeFileSync(profilePath, JSON.stringify(profileSkeleton, null, 2));
  console.log(`  ✓ ${profilePath}`);

  console.log(`\n[step1] ✓ 完成。`);
  console.log(`\n下一步 AI 应该:`);
  if (!noUrl) {
    console.log(`  1. 查看 ${homePath} 截图`);
    console.log(`  2. 查看 ${domPath} DOM 结构`);
    console.log(`  3. 结合代码仓库（路由/README）推断 modules 和 dimensions`);
    console.log(`  4. 填充 ${profilePath} 中的 __AI_FILL__ 字段`);
    console.log(`  5. 给用户看 → Checkpoint A1 → 进 Step 2`);
  } else {
    console.log(`  1. 跟用户对话问产品定位和主要模块`);
    console.log(`  2. 边问边填 ${profilePath} 中的 __AI_FILL__ 字段`);
    console.log(`  3. 给用户看 → Checkpoint A1 → 进 Step 2`);
  }

  return { home: homePath, dom: domPath, profile: profilePath };
}

// === 在浏览器内运行的 DOM 提取函数 ===
// 注意：以下函数会被 page.evaluate 序列化，必须不依赖 Node 模块
function extractDomStructure() {
  const result = {
    title: document.title,
    url: location.href,
    nav: [],
    headings: [],
    buttons: [],
    sections: [],
    forms: [],
  };
  // nav 链接（限 20 个）
  document.querySelectorAll('nav a, [role=navigation] a, header a').forEach(a => {
    if (result.nav.length >= 20) return;
    const txt = (a.innerText || '').trim();
    if (!txt) return;
    result.nav.push({ text: txt, href: a.getAttribute('href') });
  });
  // 主标题（h1/h2，限 15 个）
  document.querySelectorAll('h1, h2').forEach(h => {
    if (result.headings.length >= 15) return;
    const t = (h.innerText || '').trim();
    if (t) result.headings.push({ tag: h.tagName.toLowerCase(), text: t });
  });
  // 主按钮（限 15）
  document.querySelectorAll('button, [role=button], a.btn, a.button').forEach(b => {
    if (result.buttons.length >= 15) return;
    const t = (b.innerText || '').trim();
    if (t && t.length < 40) result.buttons.push(t);
  });
  // 主 section（限 10）
  document.querySelectorAll('section, main > div, [class*=section], [class*=hero]').forEach(s => {
    if (result.sections.length >= 10) return;
    const r = s.getBoundingClientRect();
    if (r.width < 300 || r.height < 100) return;
    const text = (s.innerText || '').slice(0, 200).trim();
    if (text) {
      result.sections.push({
        text: text.replace(/\s+/g, ' '),
        size: [Math.round(r.width), Math.round(r.height)],
      });
    }
  });
  // 表单
  document.querySelectorAll('form, [role=form]').forEach(f => {
    const inputs = Array.from(f.querySelectorAll('input, textarea, select'))
      .map(i => i.name || i.placeholder || i.type)
      .filter(Boolean);
    result.forms.push({ inputs });
  });
  return result;
}

function extractDiscovery() {
  // 找出可点击的"入口型元素"，给 AI 决定要不要再截
  const candidates = [];
  const seen = new Set();
  document.querySelectorAll('a[href], button, [role=button]').forEach(el => {
    const href = el.getAttribute('href') || '';
    const txt = (el.innerText || '').trim();
    if (!txt || txt.length > 30) return;
    // 过滤明显不是入口的
    if (/^(login|sign in|sign up|登录|注册|关于|about|联系|contact)/i.test(txt)) return;
    // 内部链接优先
    const isInternal = href.startsWith('/') || href.startsWith('#') || href.startsWith(location.origin);
    const key = href + '|' + txt;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({
      text: txt,
      href: isInternal ? href : null,
      type: el.tagName.toLowerCase(),
    });
  });
  // 限 30 个
  return candidates.slice(0, 30);
}

// CLI
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const noUrl = !!args['no-url'] || !!args.noUrl;
  if (!args.name || !args.out) {
    console.error('用法:');
    console.error('  模式 A (有 URL): node step1-analyze-product.js --url <URL> --name <Name> --out <dir> [--state <auth.json>]');
    console.error('  模式 B (无 URL): node step1-analyze-product.js --no-url --name <Name> --out <dir>');
    process.exit(1);
  }
  if (!noUrl && !args.url) {
    console.error('错误：缺少 --url（或使用 --no-url 跳过截图）');
    process.exit(1);
  }
  analyze({
    url: args.url,
    name: args.name,
    out: path.resolve(args.out),
    state: args.state ? path.resolve(args.state) : undefined,
    noUrl,
  }).catch(err => {
    console.error('[step1] FAIL', err);
    process.exit(1);
  });
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

module.exports = { analyze };
