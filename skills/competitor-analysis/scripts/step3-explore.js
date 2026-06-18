#!/usr/bin/env node
/**
 * Step 3 Explore：主动探索式截图（OpenClaw 模式）
 *
 * 当 step3 截到营销页时，启动这个脚本：
 * 像真人一样在页面上找 "Try / Open App / Live Demo" 等按钮
 * 点击进入下一级页面，递归直到截到真实 product UI（或失败）
 *
 * 三层决策：
 *   1. 规则候选：关键词字典 + 视觉位置 + URL pattern 打分（覆盖 80% 主流 SaaS）
 *   2. AI 兜底：规则全部失败时，写 explore-pending.json 让 AI 看 a11y tree 决策
 *   3. 登录墙处理：探索路径上撞墙 → 调 login-interactive 弹浏览器登录 → 复用 state 继续
 *
 * 用法：
 *   node scripts/step3-explore.js \
 *     --start https://coda.io/ \
 *     --label coda-doc-editor \
 *     --out ./screenshots/competitors/ \
 *     [--state ./.auth/coda-state.json] \
 *     [--max-depth 3] \
 *     [--site coda]   # 用于 state 文件命名
 *
 * 输出：
 *   <out>/<label>.png         成功后的截图
 *   <out>/<label>.dom.json    DOM 结构
 *   <out>/<label>-trail.json  探索路径（debug）
 *
 * 退出码：
 *   0 = 成功探到真 UI
 *   1 = 规则探完都失败
 *   2 = 需 AI 兜底（写了 explore-pending.json）
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const { capture } = require('./capture.js');
const { verifyOne } = require('./verify-screenshots.js');

// === 关键词字典（按可信度从高到低）===
// 文本匹配 + URL pattern 联合打分
const ACTION_PATTERNS = [
  // 极强：必然进入真 UI
  { weight: 100, text: /^(open|launch)\s+(app|editor|workspace|studio|the app)/i, label: 'open-app' },
  { weight: 95,  text: /go to (app|editor|workspace|dashboard)/i, label: 'open-app' },
  // 强：直接试用，无需注册即用（最佳）
  { weight: 90,  text: /^(try|try it)\s+(free|now|out)?$/i, label: 'try-free' },
  { weight: 85,  text: /\b(playground|sandbox|interactive demo|live demo|try it live)\b/i, label: 'live-demo' },
  { weight: 80,  text: /^(use|launch|start using)\b.*(without|no signup|no account|free)/i, label: 'no-signup' },
  // 中：可能直接进 demo，可能要注册
  { weight: 60,  text: /^(get started|start free|create.*free|sign up free)/i, label: 'get-started' },
  { weight: 55,  text: /^(view|see|watch|explore)\s+(demo|examples|gallery|templates)/i, label: 'view-demo' },
  { weight: 50,  text: /^(templates?|gallery|examples)$/i, label: 'gallery' },
  // 弱：可能是营销链接
  { weight: 30,  text: /^learn more|how it works|see how/i, label: 'learn-more' },
];

const URL_PATTERNS = [
  { weight: 100, re: /\/(app|editor|workspace|studio|workbench)(\/|$|\?|#)/i, label: 'app-url' },
  { weight: 95,  re: /^https?:\/\/app\./i, label: 'app-subdomain' },
  { weight: 90,  re: /\/(playground|sandbox|try|demo)(\/|$|\?|#)/i, label: 'playground-url' },
  { weight: 80,  re: /\/(gallery|templates|examples)(\/|$|\?|#)/i, label: 'gallery-url' },
  { weight: 70,  re: /\/(create|new)(\/|$|\?|#)/i, label: 'create-url' },
  { weight: -50, re: /\/(pricing|plans|enterprise|sales|contact|about|blog|careers|press|legal|terms|privacy)(\/|$|\?|#)/i, label: 'unwanted-url' },
  { weight: -30, re: /\/(login|signin|signup|register|auth)(\/|$|\?|#)/i, label: 'auth-url' }, // 暂时降权（登录墙后再处理）
];

// === 评分函数 ===
function scoreCandidate(text, href, rect) {
  let score = 0;
  const matches = [];

  // 1. 文本关键词
  for (const p of ACTION_PATTERNS) {
    if (p.text.test(text)) {
      score += p.weight;
      matches.push(`text:${p.label}(+${p.weight})`);
      break; // 一个文本只算一次
    }
  }

  // 2. URL pattern
  for (const p of URL_PATTERNS) {
    if (p.re.test(href)) {
      score += p.weight;
      matches.push(`url:${p.label}(${p.weight > 0 ? '+' : ''}${p.weight})`);
      break;
    }
  }

  // 3. 视觉权重：hero 区域（top 800px）的大按钮分高
  if (rect && rect.y < 800 && rect.width > 80 && rect.height > 30) {
    score += 15;
    matches.push('hero-region(+15)');
  }
  // 视觉权重：极小元素（<24px 高）扣分
  if (rect && rect.height < 24) {
    score -= 20;
    matches.push('tiny(-20)');
  }

  return { score, matches };
}

// === 浏览器 / 上下文创建 ===
async function makeContext(state) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });
  const ctxOpts = {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'sec-ch-ua': '"Google Chrome";v="130", "Chromium";v="130", "Not?A_Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
    },
  };
  if (state && fs.existsSync(state)) ctxOpts.storageState = state;
  const context = await browser.newContext(ctxOpts);
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [{ name: 'Chrome PDF Plugin' }, { name: 'Chrome PDF Viewer' }, { name: 'Native Client' }],
    });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    window.chrome = window.chrome || { runtime: {}, loadTimes: () => ({}), csi: () => ({}), app: {} };
    if (!navigator.deviceMemory) Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    if (!navigator.hardwareConcurrency) Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  });
  return { browser, context };
}

// === 抓页面所有可点击元素 + 评分 ===
async function findCandidates(page) {
  const raw = await page.evaluate(() => {
    const out = [];
    // 抓 button / a / [role=button] / 主要带文本的可点击元素
    const sel = 'button, a[href], [role="button"], [role="link"], [data-testid*="cta" i], [class*="cta" i]';
    document.querySelectorAll(sel).forEach((el, idx) => {
      const text = (el.innerText || el.textContent || '').trim().slice(0, 80);
      if (!text || text.length < 2) return;
      const href = el.getAttribute('href') || '';
      const r = el.getBoundingClientRect();
      // 过滤完全不可见的
      if (r.width < 1 || r.height < 1) return;
      out.push({
        idx,
        text,
        href: href.startsWith('http') ? href : (href ? new URL(href, location.origin).href : ''),
        rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
        tag: el.tagName.toLowerCase(),
      });
    });
    return out;
  });

  // 打分
  return raw
    .map(el => ({ ...el, ...scoreCandidate(el.text, el.href, el.rect) }))
    .filter(el => el.score > 0)
    .sort((a, b) => b.score - a.score);
}

// === verify 当前页是不是"真 UI"===
async function verifyCurrent(page, tmpPng) {
  // 截快照
  await page.screenshot({ path: tmpPng, fullPage: false });
  // 抓 DOM 样本
  const dom = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, a, h1, h2, h3, [role=button], label, input[placeholder]').forEach(el => {
      const t = (el.innerText || el.textContent || el.placeholder || '').trim().slice(0, 100);
      if (!t) return;
      const r = el.getBoundingClientRect();
      out.push({
        text: t,
        x: Math.round(r.x), y: Math.round(r.y),
        w: Math.round(r.width), h: Math.round(r.height),
      });
    });
    return out.slice(0, 200);
  });
  fs.writeFileSync(tmpPng.replace(/\.png$/, '.dom.json'), JSON.stringify(dom, null, 2));
  return verifyOne(tmpPng);
}

// === 核心：递归探索 ===
async function explore({
  startUrl,
  label,
  out,
  state,
  maxDepth = 3,
  site,
  authDir,
  visited = new Set(),
  trail = [],
  depth = 0,
}) {
  if (visited.has(startUrl)) {
    return { ok: false, reason: 'already-visited', trail };
  }
  visited.add(startUrl);

  console.log(`${'  '.repeat(depth)}[explore d=${depth}] → ${startUrl}`);

  const { browser, context } = await makeContext(state);
  const page = await context.newPage();

  try {
    // 1. 访问
    try {
      await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(3000);
      // 等 SPA 稳定
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    } catch (err) {
      console.log(`${'  '.repeat(depth)}  ✗ goto 失败: ${err.message}`);
      trail.push({ depth, url: startUrl, ok: false, error: err.message });
      return { ok: false, reason: 'goto-failed', trail };
    }

    const currentUrl = page.url();

    // 2. verify 当前页
    const tmpPng = path.join(out, `${label}-d${depth}.tmp.png`);
    fs.mkdirSync(out, { recursive: true });
    const quality = await verifyCurrent(page, tmpPng);

    const fn = quality.functionalScore || 0;
    const mkt = quality.marketingScore || 0;
    console.log(`${'  '.repeat(depth)}  verify: ${quality.ok ? '✓' : '✗'} ${quality.issue || 'ok'} (fn=${fn}, mkt=${mkt})`);
    trail.push({ depth, url: currentUrl, quality: { ok: quality.ok, issue: quality.issue, fn, mkt } });

    // 3. 已经是真 UI？→ 完工
    if (quality.ok && fn >= 5 && fn > mkt) {
      const finalPng = path.join(out, `${label}.png`);
      fs.renameSync(tmpPng, finalPng);
      // dom.json 也搬过去
      const tmpDom = tmpPng.replace(/\.png$/, '.dom.json');
      const finalDom = finalPng.replace(/\.png$/, '.dom.json');
      if (fs.existsSync(tmpDom)) fs.renameSync(tmpDom, finalDom);
      console.log(`${'  '.repeat(depth)}  🎯 找到真 UI！保存: ${finalPng}`);
      trail.push({ depth, url: currentUrl, success: true });
      return { ok: true, finalUrl: currentUrl, png: finalPng, trail };
    }

    // 清理临时
    try { fs.unlinkSync(tmpPng); } catch {}
    try { fs.unlinkSync(tmpPng.replace(/\.png$/, '.dom.json')); } catch {}

    // 4. 撞登录墙 → 弹浏览器登录 → 用 state 重试当前 URL
    if (quality.issue === 'login-wall' && site && authDir) {
      const statePath = path.join(authDir, `${site}-state.json`);
      if (!fs.existsSync(statePath)) {
        console.log(`${'  '.repeat(depth)}  🔐 撞登录墙 → 弹浏览器让用户登录...`);
        const { login } = require('./login-interactive.js');
        const loginResult = await login({
          site,
          url: currentUrl,
          out: authDir,
          timeout: 300,
        });
        if (loginResult.ok) {
          console.log(`${'  '.repeat(depth)}  ✓ 登录成功，用 state 重新 explore`);
          // 关闭当前 ctx
          await context.close();
          await browser.close();
          // 用 state 重 explore（visited 不重置，否则可能死循环）
          visited.delete(startUrl); // 但当前 URL 允许再访
          return await explore({
            startUrl, label, out, state: statePath, maxDepth, site, authDir,
            visited, trail, depth, // 同一深度，因为只是换了 state
          });
        } else {
          console.log(`${'  '.repeat(depth)}  ⚠ 登录失败/取消`);
          trail.push({ depth, url: currentUrl, login: 'failed' });
        }
      }
    }

    // 5. 深度未到上限 → 找候选按钮
    if (depth >= maxDepth) {
      console.log(`${'  '.repeat(depth)}  🛑 深度上限 ${maxDepth}，停止`);
      return { ok: false, reason: 'max-depth', trail };
    }

    const candidates = await findCandidates(page);
    const top = candidates.slice(0, 5);
    console.log(`${'  '.repeat(depth)}  候选 (top ${top.length}):`);
    top.forEach(c => {
      console.log(`${'  '.repeat(depth)}    [${c.score}] "${c.text.slice(0, 40)}" → ${c.href.slice(0, 60)}  ${c.matches.join(',')}`);
    });

    if (top.length === 0) {
      console.log(`${'  '.repeat(depth)}  ⚠ 无规则候选 → 写 pending 让 AI 决策`);
      // 写 pending（限低优先，先尝试普通 fallback；如果调用方传 enableAiFallback 才输出）
      return {
        ok: false,
        reason: 'no-candidate',
        trail,
        pending: { url: currentUrl, screenshot: tmpPng, allCandidates: candidates.slice(0, 30) },
      };
    }

    // 6. 关闭当前页（释放内存），按候选递归
    await context.close();
    await browser.close();

    for (const cand of top) {
      if (!cand.href) continue;
      const subResult = await explore({
        startUrl: cand.href,
        label, out, state, maxDepth, site, authDir,
        visited, trail: [...trail], depth: depth + 1,
      });
      if (subResult.ok) return subResult;
      // 把子树 trail 合并
      trail.push(...subResult.trail.slice(trail.length));
    }

    return { ok: false, reason: 'all-candidates-failed', trail };
  } finally {
    try { await context.close(); } catch {}
    try { await browser.close(); } catch {}
  }
}

// === 主入口 ===
async function exploreEntry(opts) {
  const { startUrl, label, out, state, maxDepth, site, authDir: optAuthDir } = opts;
  const authDir = optAuthDir || path.join(path.dirname(out), '.auth');

  // 第一遍：用传入的 state（或无）尝试
  let result = await explore({
    startUrl, label, out, state,
    maxDepth: maxDepth || 3,
    site, authDir,
  });

  // 第一遍失败兜底：如果有 site 信息且尚未用过登录态，触发登录后重试
  if (!result.ok && site && !state) {
    const statePath = path.join(authDir, `${site}-state.json`);
    // 如果没有已存的 state → 弹浏览器登录一次
    if (!fs.existsSync(statePath)) {
      console.log(`\n[explore] 第一遍探索失败，尝试登录 ${site} 后重试...`);
      try {
        const { login } = require('./login-interactive.js');
        const loginResult = await login({
          site,
          url: startUrl,
          out: authDir,
          timeout: 300,
        });
        if (loginResult.ok) {
          console.log(`[explore] ✓ 登录成功，用 state 重新 explore...\n`);
          result = await explore({
            startUrl, label, out, state: statePath,
            maxDepth: maxDepth || 3,
            site, authDir,
          });
        } else {
          console.log(`[explore] ⚠ 登录失败/取消`);
        }
      } catch (err) {
        console.log(`[explore] ⚠ 登录流程出错: ${err.message}`);
      }
    } else {
      // state 已存在但第一遍没用 → 用 state 再试一次
      console.log(`\n[explore] 第一遍失败，使用已有 state 重试...`);
      result = await explore({
        startUrl, label, out, state: statePath,
        maxDepth: maxDepth || 3,
        site, authDir,
      });
    }
  }

  // 写 trail（debug 用）
  const trailPath = path.join(out, `${label}-trail.json`);
  fs.writeFileSync(trailPath, JSON.stringify({
    label,
    startUrl,
    finalUrl: result.finalUrl || null,
    ok: result.ok,
    reason: result.reason,
    trail: result.trail,
    pendingForAi: result.pending || null,
  }, null, 2));

  if (result.ok) {
    console.log(`\n[explore] ✓ ${label} 找到真 UI: ${result.finalUrl}`);
  } else if (result.pending) {
    console.log(`\n[explore] ⚠ ${label} 规则失败，需 AI 决策`);
    console.log(`           pending: ${trailPath}`);
  } else {
    console.log(`\n[explore] ✗ ${label} 全部规则候选都失败 (${result.reason})`);
  }

  return result;
}

// === CLI ===
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.start || !args.label || !args.out) {
    console.error('用法:');
    console.error('  node step3-explore.js --start <url> --label <name> --out <dir> [--site <id>] [--state <auth.json>] [--max-depth 3]');
    process.exit(1);
  }
  exploreEntry({
    startUrl: args.start,
    label: args.label,
    out: path.resolve(args.out),
    state: args.state ? path.resolve(args.state) : undefined,
    maxDepth: args['max-depth'] ? parseInt(args['max-depth'], 10) : 3,
    site: args.site,
    authDir: args.authDir ? path.resolve(args.authDir) : undefined,
  })
    .then(r => process.exit(r.ok ? 0 : (r.pending ? 2 : 1)))
    .catch(err => {
      console.error('[explore] FAIL', err);
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

module.exports = { explore: exploreEntry, scoreCandidate, findCandidates };
