#!/usr/bin/env node
/**
 * 登录态保存器
 *
 * 用法：
 *   node scripts/login.js --site capcut --url https://www.capcut.com/login [--out ./.auth/]
 *
 * 流程：
 *   1. 弹出有头浏览器，导航到 --url
 *   2. 终端等待用户按回车（用户在浏览器里完成登录）
 *   3. 调 storageState 保存到 .auth/<site>-state.json
 *   4. 关闭浏览器
 *
 * 之后任何 capture 调用 state: ".auth/capcut-state.json" 即可复用登录态。
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { chromium } = require('playwright');

async function login({ site, url, out = './.auth/', viewport = [1440, 900] }) {
  if (!site || !url) throw new Error('login: site 和 url 必填');

  fs.mkdirSync(out, { recursive: true });
  const statePath = path.join(out, `${site}-state.json`);

  console.log(`\n[login] 站点: ${site}`);
  console.log(`[login] 登录页: ${url}`);
  console.log(`[login] state 将保存到: ${statePath}\n`);

  // 用持久化 profile，避免每次都被识别为新机器
  const profileDir = path.join(out, `.profile-${site}`);
  fs.mkdirSync(profileDir, { recursive: true });

  const browser = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: viewport[0], height: viewport[1] },
    deviceScaleFactor: 2,
  });

  const page = browser.pages()[0] || (await browser.newPage());
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👉 请在弹出的浏览器里完成登录');
  console.log('   登录成功后回到终端，按【回车】保存状态');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await waitForEnter();

  await browser.storageState({ path: statePath });

  // 也打印一下当前 URL 帮用户确认
  const currentUrl = page.url();
  console.log(`\n[login] ✓ 当前 URL: ${currentUrl}`);
  console.log(`[login] ✓ 已保存 state: ${statePath}`);
  console.log(`[login] ✓ profile 目录: ${profileDir}（下次同一个 site 自动复用）\n`);

  await browser.close();
}

function waitForEnter() {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });
}

// CLI
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.site || !args.url) {
    console.error('用法: node login.js --site <name> --url <login-url> [--out ./.auth/]');
    process.exit(1);
  }
  login({
    site: args.site,
    url: args.url,
    out: args.out || './.auth/',
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

module.exports = { login };
