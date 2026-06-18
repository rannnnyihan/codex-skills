#!/usr/bin/env node
/**
 * Step 2.5 竞品 URL 预检（Vetting）
 *
 * 在 step3 正式大规模截图前，先对每个竞品的每个 moduleUrl 做"轻量预检"：
 *   1. 快速访问（低分辨率截图）
 *   2. verify-screenshots 规则判分（marketing / login-wall / error / empty / ok）
 *   3. 如果不是真功能页，挖同域名下的功能页链接，给出 top-3 替代 URL
 *
 * 目的：堵住 AI 基于常识填 URL 但填到营销页的漏洞。
 * AI 读 vet-report.json → 决策是否改 competitors.json → 再跑 step3。
 *
 * 用法：
 *   node scripts/step2-vet-competitors.js \
 *     --competitors <work/competitors.json> \
 *     --out <work/vet-report.json>
 *
 * 产物：
 *   vet-report.json       { generatedAt, checks: [ {competitor, module, url, quality, suggestions[]} ] }
 *   vet-screenshots/      低分辨率快照（500x900，用来核对）
 *   vet-screenshots/*.links.json  每个 URL 抓到的链接列表（debug 用）
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { verifyOne } = require('./verify-screenshots.js');

// === 功能页 URL 路径字典 ===
// key = 路径片段，value = 分数（越高越像真功能页）
const FUNCTIONAL_URL_PATTERNS = [
  [/\/(editor|studio|workspace|workbench)(\/|$|\?)/i, 10],
  [/\/(app|application)(\/|$|\?)/i, 8],
  [/\/(dashboard|home|console)(\/|$|\?)/i, 8],
  [/\/(playground|try|demo)(\/|$|\?)/i, 7],
  [/\/(create|new|generate)(\/|$|\?)/i, 7],
  [/\/(my|mine)[\w\-]*\/(library|projects|files|workspace)(\/|$|\?)/i, 9],
  [/\/projects?(\/|$|\?)/i, 6],
  [/\/canvas(\/|$|\?)/i, 6],
  [/\/design(\/|$|\?)/i, 5],
  [/\/tools?\/[\w\-]+/i, 5],
  [/\/product\/[\w\-]+/i, 4],
  [/\/features?\/[\w\-]+/i, 3],
  // 负信号（这些路径大概率是营销/文档页）
  [/\/(pricing|plan|billing|purchase)(\/|$|\?)/i, -5],
  [/\/(blog|news|press)(\/|$|\?)/i, -8],
  [/\/(about|company|team|contact|careers)(\/|$|\?)/i, -10],
  [/\/(help|support|docs?|documentation|guide|tutorial|learn)(\/|$|\?)/i, -6],
  [/\/(login|signin|signup|register|auth)(\/|$|\?)/i, -8],
  [/\/(terms|privacy|cookie|legal)(\/|$|\?)/i, -12],
  [/\/(partner|enterprise|education)(\/|$|\?)/i, -4],
  [/#/i, -3], // 锚点链接一般在同页
];

// 链接文字的功能关键词（文本 + URL 都打分）
const FUNCTIONAL_TEXT_KEYWORDS = [
  /editor/i, /studio/i, /workspace/i, /playground/i,
  /try it/i, /try now/i, /open (app|editor|studio)/i,
  /launch app/i, /get app/i, /start creating/i,
  /我的(作品|项目|素材)/, /工作台/, /编辑器/, /新建/,
];

function scoreUrl(url, text = '') {
  let score = 0;
  const urlPath = url.replace(/^https?:\/\/[^/]+/, ''); // 去 host 只看 path

  for (const [re, pts] of FUNCTIONAL_URL_PATTERNS) {
    if (re.test(urlPath)) score += pts;
  }
  for (const re of FUNCTIONAL_TEXT_KEYWORDS) {
    if (re.test(text)) score += 3;
  }
  return score;
}

function isSameOrigin(url, baseOrigin) {
  try {
    const u = new URL(url);
    return u.origin === baseOrigin;
  } catch {
    return false;
  }
}

/**
 * 打开页面，抓 verify 需要的 DOM 信息 + 同域所有链接
 */
async function inspect(page, url, state, stateFile) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(3000); // 等 SPA
  } catch (err) {
    return { ok: false, error: err.message };
  }

  const origin = new URL(url).origin;

  // 抓文本 + 基础 DOM 信息（模拟 verify 输入）
  const domInfo = await page.evaluate(() => {
    const texts = [];
    // 尽量模拟 capture.js 输出的 .dom.json 结构
    document.querySelectorAll('button, a, h1, h2, h3, [role=button], [role=heading], label, input[placeholder]').forEach(el => {
      const t = (el.innerText || el.textContent || el.placeholder || '').trim().slice(0, 100);
      if (t && t.length > 0) {
        const r = el.getBoundingClientRect();
        texts.push({
          text: t,
          x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        });
      }
    });
    return texts.slice(0, 200);
  });

  // 抓所有同域链接
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]')).map(a => ({
      href: a.href,
      text: (a.innerText || a.textContent || '').trim().slice(0, 80),
    })).filter(l => l.href && !l.href.startsWith('javascript:'));
  });

  const sameOriginLinks = links.filter(l => isSameOrigin(l.href, origin));

  return { ok: true, domInfo, links: sameOriginLinks, finalUrl: page.url() };
}

/**
 * 把 DOM 信息写成 .dom.json，然后调 verifyOne
 */
function verifyViaRules(pngPath, domInfo) {
  const domPath = pngPath.replace(/\.png$/, '.dom.json');
  fs.writeFileSync(domPath, JSON.stringify(domInfo, null, 2));
  return verifyOne(pngPath);
}

/**
 * 对一个 URL 的问题，挖 top-N 候选替代
 */
function suggestAlternatives(links, currentUrl) {
  const seen = new Set();
  const scored = [];
  for (const l of links) {
    // 去重 + 跳过当前 URL
    const normalized = l.href.replace(/#.*$/, '').replace(/\?.*$/, '');
    if (seen.has(normalized) || normalized === currentUrl) continue;
    seen.add(normalized);

    const s = scoreUrl(l.href, l.text);
    if (s > 0) scored.push({ url: l.href, text: l.text, score: s });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5);
}

async function vetAll({ competitorsPath, outReport, outDir }) {
  const data = JSON.parse(fs.readFileSync(competitorsPath, 'utf-8'));
  const competitors = data.competitors || [];

  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const report = {
    generatedAt: new Date().toISOString(),
    summary: { total: 0, ok: 0, needsFix: 0, byIssue: {} },
    checks: [],
  };

  console.log(`\n[step2-vet] 开始预检 ${competitors.length} 个竞品`);

  for (const c of competitors) {
    const compType = c.type || 'product';
    // 功能型竞品：只 vet targetModules 列出的
    let moduleUrls = c.moduleUrls || {};
    if (compType === 'feature' && Array.isArray(c.targetModules)) {
      moduleUrls = Object.fromEntries(
        Object.entries(moduleUrls).filter(([k]) => c.targetModules.includes(k))
      );
    }
    const entries = Object.entries(moduleUrls);
    const typeLabel = compType === 'feature' ? `[功能型 ${c.targetModules?.join(',') || ''}]` : '[产品型]';
    console.log(`\n--- ${c.name} ${typeLabel} (${entries.length} 个 URL) ---`);

    const stateFile = c.state ? path.resolve(path.dirname(competitorsPath), c.state) : null;
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }, // 低分辨率快照
      deviceScaleFactor: 1,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      storageState: stateFile && fs.existsSync(stateFile) ? stateFile : undefined,
    });
    const page = await context.newPage();

    for (const [moduleId, url] of entries) {
      process.stdout.write(`  · ${moduleId}: ${url.slice(0, 60)} ... `);
      const pngPath = path.join(outDir, `${c.id}-${moduleId}.png`);

      try {
        const result = await inspect(page, url, null, stateFile);
        if (!result.ok) {
          console.log(`✗ ${result.error}`);
          report.checks.push({
            competitor: c.name, competitorId: c.id, competitorType: compType, module: moduleId,
            url, ok: false, issue: 'unreachable', error: result.error,
            suggestions: [],
          });
          continue;
        }

        // 快照（低分辨率，够 verify 用）
        await page.screenshot({ path: pngPath, fullPage: false });
        const quality = verifyViaRules(pngPath, result.domInfo);

        // 写链接 debug
        fs.writeFileSync(
          pngPath.replace(/\.png$/, '.links.json'),
          JSON.stringify(result.links, null, 2)
        );

        const check = {
          competitor: c.name, competitorId: c.id,
          competitorType: compType,
          module: moduleId,
          url, finalUrl: result.finalUrl,
          ok: quality.ok,
          issue: quality.issue,
          confidence: quality.confidence,
          hints: quality.hints,
          marketingScore: quality.marketingScore || 0,
          functionalScore: quality.functionalScore || 0,
          domCount: quality.domCount,
          suggestions: [],
        };

        if (!quality.ok) {
          check.suggestions = suggestAlternatives(result.links, url);
          console.log(`⚠ ${quality.issue} (fn=${quality.functionalScore || 0}, mkt=${quality.marketingScore || 0}), 候选 ${check.suggestions.length}`);
        } else {
          // 软警告：规则虽然放过但 mkt 显著 > fn，AI 值得关注
          const mkt = quality.marketingScore || 0;
          const fn = quality.functionalScore || 0;
          if (mkt >= 5 && mkt > fn * 1.5) {
            check.softWarning = 'likely-marketing-but-passed';
            check.suggestions = suggestAlternatives(result.links, url);
            console.log(`⚠ SOFT (fn=${fn}, mkt=${mkt} 显著偏营销), 候选 ${check.suggestions.length}`);
          } else {
            console.log(`✓ (fn=${fn}, mkt=${mkt})`);
          }
        }
        report.checks.push(check);
      } catch (err) {
        console.log(`✗ ERROR: ${err.message}`);
        report.checks.push({
          competitor: c.name, competitorId: c.id, competitorType: compType, module: moduleId,
          url, ok: false, issue: 'error', error: err.message,
          suggestions: [],
        });
      }
    }

    await context.close();
  }

  await browser.close();

  // 统计
  report.summary.total = report.checks.length;
  report.summary.softWarnings = 0;
  for (const ch of report.checks) {
    if (ch.softWarning) report.summary.softWarnings++;
    if (ch.ok) report.summary.ok++;
    else {
      report.summary.needsFix++;
      report.summary.byIssue[ch.issue || 'unknown'] =
        (report.summary.byIssue[ch.issue || 'unknown'] || 0) + 1;
    }
  }

  fs.writeFileSync(outReport, JSON.stringify(report, null, 2));

  // 打印人类可读摘要
  console.log(`\n[step2-vet] === 预检报告 ===`);
  console.log(`总 URL: ${report.summary.total}, ✓ 通过: ${report.summary.ok}, ⚠ 需修: ${report.summary.needsFix}, ⚠ 软警告: ${report.summary.softWarnings}`);
  if (report.summary.needsFix > 0) {
    console.log(`\n问题分布:`);
    Object.entries(report.summary.byIssue).forEach(([k, v]) => console.log(`  - ${k}: ${v}`));

    console.log(`\n⚠ 需要 AI 检查的条目:`);
    for (const ch of report.checks.filter(c => !c.ok)) {
      console.log(`\n  ${ch.competitor} / ${ch.module}: ${ch.issue}`);
      console.log(`    当前 URL: ${ch.url}`);
      if (ch.suggestions && ch.suggestions.length > 0) {
        console.log(`    ↓ 推荐替代 URL（按打分排序）:`);
        ch.suggestions.slice(0, 3).forEach(s => {
          console.log(`      [${s.score}] ${s.url}  ${s.text ? `"${s.text.slice(0, 40)}"` : ''}`);
        });
      } else {
        console.log(`    （同域未挖到功能页候选，AI 需要用 WebSearch 找或换竞品）`);
      }
    }
  }

  const softs = report.checks.filter(c => c.softWarning);
  if (softs.length > 0) {
    console.log(`\n⚠ 软警告（URL 能打开，但营销意图明显强于功能）:`);
    for (const ch of softs) {
      console.log(`\n  ${ch.competitor} / ${ch.module}`);
      console.log(`    当前 URL: ${ch.url}`);
      console.log(`    分数: fn=${ch.functionalScore}, mkt=${ch.marketingScore}`);
      if (ch.suggestions && ch.suggestions.length > 0) {
        console.log(`    ↓ 更像功能页的候选:`);
        ch.suggestions.slice(0, 3).forEach(s => {
          console.log(`      [${s.score}] ${s.url}  ${s.text ? `"${s.text.slice(0, 40)}"` : ''}`);
        });
      }
    }
    console.log(`\n  → AI 决策：如果该模块在分析维度里重要，建议换成候选 URL；如果只是为了截个 hero 图，当前 URL 也可用。`);
  }
  console.log(`\n[step2-vet] 报告: ${outReport}`);
  console.log(`[step2-vet] 快照: ${outDir}/`);

  return report;
}

// CLI
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.competitors) {
    console.error('用法: node step2-vet-competitors.js --competitors <competitors.json> [--out <vet-report.json>] [--snapshots <dir>]');
    process.exit(1);
  }
  const competitorsPath = path.resolve(args.competitors);
  const outReport = path.resolve(args.out || path.join(path.dirname(competitorsPath), 'vet-report.json'));
  const outDir = path.resolve(args.snapshots || path.join(path.dirname(competitorsPath), 'vet-screenshots'));

  vetAll({ competitorsPath, outReport, outDir })
    .then(r => {
      process.exit(r.summary.needsFix > 0 ? 2 : 0); // 2 = 有条目需 AI 修
    })
    .catch(err => {
      console.error('[step2-vet] FAIL', err);
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

module.exports = { vetAll, scoreUrl, suggestAlternatives };
