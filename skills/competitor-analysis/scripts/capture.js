#!/usr/bin/env node
/**
 * 单页截图核心脚本
 *
 * 用法（CLI）:
 *   node scripts/capture.js \
 *     --url https://example.com \
 *     --out ./out.png \
 *     [--state ./.auth/xxx.json] \
 *     [--wait 3000] \
 *     [--viewport 1440x900] \
 *     [--full-page] \
 *     [--no-clean] \
 *     [--selector ".main-content"]
 *
 * 用法（API）:
 *   const { capture } = require('./capture');
 *   await capture({ url, out, ... });
 */

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { clean } = require('./clean-rules');

/**
 * 截一张图
 * @param {Object} opts
 * @param {string} opts.url
 * @param {string} opts.out               输出 png 路径
 * @param {string} [opts.state]           storage state 文件
 * @param {number} [opts.wait=3000]       渲染等待 ms
 * @param {[number,number]} [opts.viewport=[1440,900]]
 * @param {boolean} [opts.fullPage=false]
 * @param {boolean} [opts.preClean=true]
 * @param {string[]} [opts.preCleanExtra=[]]
 * @param {string} [opts.selector]        只截某元素
 * @param {Array} [opts.before]           截图前操作
 * @param {boolean} [opts.headless=true]
 * @returns {Promise<{ok:boolean, killed:number, path:string}>}
 */
async function capture(opts) {
  const {
    url,
    out,
    state,
    wait = 3000,
    viewport = [1440, 900],
    fullPage = false,
    preClean = true,
    preCleanExtra = [],
    selector,
    before = [],
    headless = true,
  } = opts;

  if (!url || !out) throw new Error('capture: url 和 out 必填');

  // 确保输出目录存在
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const browser = await chromium.launch({
    headless,
    args: [
      '--disable-blink-features=AutomationControlled',  // 关键：移除 chrome=automationControlled 标志
      '--no-sandbox',
    ],
  });
  const ctxOpts = {
    viewport: { width: viewport[0], height: viewport[1] },
    deviceScaleFactor: 2, // Retina 高清
    userAgent:
      opts.userAgent ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    locale: opts.locale || 'en-US',
    timezoneId: opts.timezoneId || 'America/New_York',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'sec-ch-ua': '"Google Chrome";v="130", "Chromium";v="130", "Not?A_Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
    },
  };
  if (state && fs.existsSync(state)) {
    ctxOpts.storageState = state;
  }
  const context = await browser.newContext(ctxOpts);

  // 反爬：完整版 stealth init（覆盖 Cloudflare / Datadome 常见检测点）
  await context.addInitScript(() => {
    // 1. 隐藏 webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // 2. 假装有插件
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin' },
        { name: 'Chrome PDF Viewer' },
        { name: 'Native Client' },
      ],
    });
    // 3. 假 chrome 对象
    window.chrome = window.chrome || {
      runtime: {},
      loadTimes: () => ({}),
      csi: () => ({}),
      app: {},
    };
    // 4. languages 数组（headless 默认 ['en-US']，真浏览器多个）
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    // 5. 修复 permissions API（headless 报告异常）
    const originalQuery = window.navigator.permissions && window.navigator.permissions.query;
    if (originalQuery) {
      window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);
    }
    // 6. 隐藏 navigator.deviceMemory 异常值
    if (!navigator.deviceMemory) {
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    }
    if (!navigator.hardwareConcurrency) {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    }
  });

  const page = await context.newPage();

  let killed = 0;
  try {
    // 处理 beforeunload 等弹窗
    page.on('dialog', d => d.dismiss().catch(() => {}));

    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (response && response.status() >= 400) {
      console.warn(`  ⚠ HTTP ${response.status()}（可能被反爬识别，建议改用录屏抽帧）`);
    }

    // 兜底等渲染
    await page.waitForTimeout(wait);

    // 执行 before 步骤
    for (const step of before) {
      await runStep(page, step);
    }

    // 清扫浮层
    if (preClean) {
      killed = await clean(page, preCleanExtra);
      // 清完再等一下让 DOM 稳定
      await page.waitForTimeout(500);
    }

    // 截图（主图：first viewport）
    if (selector) {
      const el = await page.locator(selector).first();
      await el.screenshot({ path: out, type: 'png' });
    } else {
      await page.screenshot({ path: out, fullPage, type: 'png' });
    }

    // v0.6.0: 多状态截图（可选）—— 在主图之外再滚动 1-N 次，捕捉页面中部/底部状态
    // scrollShots=true 时默认额外采集 scroll 50% 和 scroll 100% 两张
    // 传数组可自定义滚动位置百分比，例如 [25, 50, 75, 100]
    const extraShots = [];
    if (opts.scrollShots) {
      const positions = Array.isArray(opts.scrollShots)
        ? opts.scrollShots
        : [50, 100]; // 默认两个位置：页面中部 + 底部

      // 关掉任何 scroll 动画防止 playwright 截到动画中间态
      await page.addStyleTag({ content: '*, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0s !important; transition-duration: 0s !important; }' }).catch(() => {});

      const baseNoExt = out.replace(/\.png$/i, '');
      for (const pct of positions) {
        const suffix = pct === 100 ? 'bottom' : `scroll${pct}`;
        const extraPath = `${baseNoExt}-${suffix}.png`;
        try {
          await page.evaluate((p) => {
            const total = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight;
            window.scrollTo(0, Math.max(0, Math.round(total * p / 100)));
          }, pct);
          await page.waitForTimeout(600); // 等 lazy load 内容加载
          await page.screenshot({ path: extraPath, type: 'png' });
          extraShots.push({ path: extraPath, pct, label: suffix });
        } catch (err) {
          // 某些 SPA 不支持滚动（全屏画布），忽略即可
        }
      }
      // 恢复到顶部便于后续 DOM dump
      await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    }

    return { ok: true, killed, path: out, extraShots };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function runStep(page, step) {
  switch (step.action) {
    case 'click':
      await page.click(step.selector, { timeout: 5000 });
      break;
    case 'fill':
      await page.fill(step.selector, step.value);
      break;
    case 'press':
      await page.keyboard.press(step.key);
      break;
    case 'scroll':
      if (step.selector) {
        await page.locator(step.selector).first().scrollIntoViewIfNeeded();
      } else if (typeof step.y === 'number') {
        await page.evaluate(y => window.scrollTo(0, y), step.y);
      }
      break;
    case 'wait':
      await page.waitForTimeout(step.ms || 1000);
      break;
    default:
      console.warn('[capture] 未知 step:', step);
  }
}

// CLI 入口
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const opts = {
    url: args.url,
    out: args.out,
    state: args.state,
    wait: args.wait ? parseInt(args.wait, 10) : 3000,
    viewport: args.viewport
      ? args.viewport.split('x').map(n => parseInt(n, 10))
      : [1440, 900],
    fullPage: args['full-page'] || args.fullPage,
    preClean: !args['no-clean'],
    selector: args.selector,
  };

  capture(opts)
    .then(res => {
      console.log(`[ok] ${res.path}  (清理 ${res.killed} 个浮层)`);
      process.exit(0);
    })
    .catch(err => {
      console.error(`[fail] ${err.message}`);
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
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

module.exports = { capture };
