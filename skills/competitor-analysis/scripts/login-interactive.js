#!/usr/bin/env node
/**
 * 交互式登录（AI 可调起）
 *
 * 与 login.js 的区别：
 * - login.js 需要用户按回车才保存 → 适合人类手动
 * - login-interactive.js 自动检测登录成功 → 适合 AI 在 skill 流程中调起
 *
 * 检测策略：
 *   - URL 离开 /login/ /signin/ /auth/ 路径
 *   - 出现 avatar / 用户头像 / "退出登录"/"logout" 等字样
 *   - 任一满足即视为登录成功
 *
 * 用法：
 *   node scripts/login-interactive.js \
 *     --site capcut \
 *     --url https://www.capcut.com/login \
 *     [--out ~/Desktop/xxx/.auth/] \
 *     [--timeout 300]   # 最多等 5 分钟
 *
 * 退出码:
 *   0 = 登录成功并保存 state
 *   1 = 用户手动关了浏览器 / 超时
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function login({ site, url, out = './.auth/', timeout = 300, viewport = [1440, 900] }) {
  if (!site || !url) throw new Error('site 和 url 必填');

  fs.mkdirSync(out, { recursive: true });
  const statePath = path.join(out, `${site}-state.json`);
  const profileDir = path.join(out, `.profile-${site}`);
  fs.mkdirSync(profileDir, { recursive: true });

  console.log(`\n🔐 请登录 ${site}`);
  console.log(`   登录页: ${url}`);
  console.log(`   检测到登录成功会自动保存并关闭浏览器（最多等 ${timeout}s）\n`);

  const browser = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: viewport[0], height: viewport[1] },
    deviceScaleFactor: 2,
  });

  const page = browser.pages()[0] || (await browser.newPage());
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});

  console.log(`👉 在弹出的 Chrome 窗口里完成登录（用 Google / 邮箱 / 扫码都行）\n`);

  const deadline = Date.now() + timeout * 1000;
  let successDetected = false;
  let pollCount = 0;
  let lastUrlShown = '';
  // v0.5.1: URL 稳定停留检测 —— 当 URL 离开 login 页且 >= 10s 没变化，判定为登录成功
  // （许多现代 SaaS 登录后进入的 dashboard 没有 logout/avatar 文字标识，单靠 DOM 信号检测不到）
  let urlStableFrom = 0;
  let lastStableUrl = '';
  const URL_STABLE_MS = 10_000; // URL 停留 10 秒不变视为稳定

  while (Date.now() < deadline) {
    try {
      if (browser.pages().length === 0) {
        console.log('\n   浏览器被手动关闭，未保存状态');
        break;
      }
      const currentPage = browser.pages()[0];
      const currentUrl = currentPage.url();

      // 每 5 次轮询显示一次当前 URL（帮用户确认浏览器状态）
      if (pollCount % 10 === 0 && currentUrl !== lastUrlShown) {
        process.stdout.write(`\r   当前页: ${currentUrl.slice(0, 80)}...   `);
        lastUrlShown = currentUrl;
      }
      pollCount++;

      // 检测 1: URL 离开 login 路径
      const urlLeft = /^https?:\/\/[^/]+\//.test(currentUrl) &&
        !/(login|signin|sign-in|sign-up|signup|auth\/|\/authenticate)/i.test(currentUrl);

      // 检测 2: 存在登录成功信号
      let hasLoginSignal = false;
      try {
        hasLoginSignal = await currentPage.evaluate(() => {
          const txt = (document.body.innerText || '').toLowerCase();
          // 登录成功信号
          if (/log ?out|sign ?out|退出登录|my account|个人中心/i.test(txt)) return true;
          // 存在头像元素（avatar / user profile）
          if (document.querySelector('img[alt*=avatar i], [class*=avatar i]:not([class*=placeholder]), [class*=user-profile i], [aria-label*=account i]')) return true;
          return false;
        });
      } catch {}

      // 快路径：urlLeft + loginSignal → 立即成功
      if (urlLeft && hasLoginSignal) {
        successDetected = true;
        break;
      }

      // v0.5.1 兜底路径：URL 离开 login 页且稳定停留 10s → 视为登录成功
      // （处理 ElevenLabs 这类登录后进入复杂 dashboard、无明显 avatar/logout 文字的情况）
      if (urlLeft) {
        if (currentUrl === lastStableUrl) {
          if (Date.now() - urlStableFrom >= URL_STABLE_MS) {
            process.stdout.write(`\n   ℹ URL 已在 ${currentUrl.slice(0, 60)} 稳定 ${Math.round((Date.now() - urlStableFrom)/1000)}s，判定登录成功\n`);
            successDetected = true;
            break;
          }
        } else {
          lastStableUrl = currentUrl;
          urlStableFrom = Date.now();
        }
      } else {
        // URL 还在 login 页 → 重置计时
        urlStableFrom = 0;
        lastStableUrl = '';
      }
    } catch (err) {
      // 页面导航中等瞬时错误忽略
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  process.stdout.write('\n');

  if (successDetected) {
    // 再等 2 秒让 cookies 稳定
    await new Promise(r => setTimeout(r, 2000));
    await browser.storageState({ path: statePath });
    const size = fs.statSync(statePath).size;
    console.log(`✅ 登录成功`);
    console.log(`   state 保存: ${statePath} (${Math.round(size / 1024)} KB)`);
    await browser.close();
    return { ok: true, statePath };
  } else {
    console.log(`⏱  超时或被取消，未保存 state`);
    try { await browser.close(); } catch {}
    return { ok: false };
  }
}

// CLI
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.site || !args.url) {
    console.error('用法: node login-interactive.js --site <name> --url <login-url> [--out ./.auth/] [--timeout 300]');
    process.exit(1);
  }
  login({
    site: args.site,
    url: args.url,
    out: args.out || './.auth/',
    timeout: args.timeout ? parseInt(args.timeout, 10) : 300,
  }).then(r => {
    process.exit(r.ok ? 0 : 1);
  }).catch(err => {
    console.error(err);
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

module.exports = { login };
