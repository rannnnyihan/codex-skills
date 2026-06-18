#!/usr/bin/env node
/**
 * 批量截图：读取 targets.json，逐个执行
 *
 * 用法：
 *   node scripts/batch.js --targets ./targets.json --out ./out/
 *
 * targets.json 格式见 templates/targets.example.json
 */

const fs = require('fs');
const path = require('path');
const { capture } = require('./capture');

async function batch(targetsFile, outDir) {
  const targets = JSON.parse(fs.readFileSync(targetsFile, 'utf-8'));
  if (!Array.isArray(targets)) throw new Error('targets.json 必须是数组');

  fs.mkdirSync(outDir, { recursive: true });

  const baseDir = path.dirname(path.resolve(targetsFile));
  const results = [];

  console.log(`\n[batch] 共 ${targets.length} 个目标，输出到 ${outDir}\n`);

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const out = path.join(outDir, `${t.id}.png`);
    const tag = `[${i + 1}/${targets.length}] ${t.id}`;

    try {
      console.log(`${tag} → ${t.url}`);
      const res = await capture({
        ...t,
        out,
        // state 路径相对 targets 文件解析
        state: t.state ? path.resolve(baseDir, t.state) : undefined,
      });
      console.log(`  ✓ 完成 (清理 ${res.killed} 个浮层)`);
      results.push({ id: t.id, ok: true, path: out, killed: res.killed });
    } catch (err) {
      console.error(`  ✗ 失败: ${err.message}`);
      results.push({ id: t.id, ok: false, error: err.message });
    }
  }

  // 写入 manifest
  const manifest = {
    generatedAt: new Date().toISOString(),
    targetsFile,
    outDir,
    results,
  };
  const manifestPath = path.join(outDir, '_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const ok = results.filter(r => r.ok).length;
  const fail = results.length - ok;
  console.log(`\n[batch] 完成 ${ok}/${results.length}（失败 ${fail}）`);
  console.log(`[batch] 清单：${manifestPath}\n`);
}

// CLI
if (require.main === module) {
  const args = require('./capture').__parseArgs
    ? require('./capture').__parseArgs(process.argv.slice(2))
    : parseArgs(process.argv.slice(2));

  const targetsFile = args.targets || args.t;
  const outDir = args.out || args.o || './out/';

  if (!targetsFile) {
    console.error('用法: node batch.js --targets <file.json> --out <dir>');
    process.exit(1);
  }

  batch(targetsFile, outDir).catch(err => {
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

module.exports = { batch };
