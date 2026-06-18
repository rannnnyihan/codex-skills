#!/usr/bin/env node
/**
 * analysis-data.json 校验器
 *
 * 在 step5-generate-site.js 跑之前校验数据，发现问题给出可操作的修复建议。
 *
 * 用法:
 *   node scripts/validate-data.js --data <path>
 *   或作为库调用: const { validate } = require('./validate-data'); validate(data);
 *
 * 退出码:
 *   0 = 全通过
 *   1 = 有 error（会让站点崩）
 *   2 = 只有 warning（不崩但不好看）
 */

const fs = require('fs');

// 合法的枚举值
const VALID_CATEGORIES = ['domestic', 'overseas', 'saas', 'mobile', 'desktop', 'other'];
const VALID_STATUSES = ['ready', 'pending', 'draft'];
const VALID_VERDICTS_DEFAULT = ['borrow-strong', 'borrow', 'improve', 'already', 'not-applicable'];
const VALID_TAG_COLORS = ['good', 'bad', 'pattern', 'info', 'warning'];

function validate(data) {
  const errors = [];
  const warnings = [];
  const push = (level, path, msg, fix) => {
    (level === 'error' ? errors : warnings).push({ path, msg, fix });
  };

  // === 顶层结构 ===
  if (!data || typeof data !== 'object') {
    errors.push({ path: '/', msg: 'data 必须是 object', fix: '检查 JSON 是否合法' });
    return { errors, warnings };
  }

  // meta
  if (!data.meta) {
    push('error', 'meta', '缺少 meta 字段', '添加 meta.userProduct + meta.dimensions + meta.verdicts');
  } else {
    validateMeta(data.meta, push);
  }

  // products
  if (!Array.isArray(data.products)) {
    push('error', 'products', 'products 必须是数组', '写成 "products": []');
  } else {
    data.products.forEach((p, i) => validateProduct(p, `products[${i}]`, push));
    // 检查 id 唯一
    const pids = data.products.map(p => p.id).filter(Boolean);
    const dupes = pids.filter((id, i) => pids.indexOf(id) !== i);
    if (dupes.length) push('error', 'products', `产品 id 重复: ${[...new Set(dupes)].join(', ')}`, '改成唯一 id');
  }

  // modules
  if (!Array.isArray(data.modules)) {
    push('error', 'modules', 'modules 必须是数组', '写成 "modules": []');
  } else if (data.modules.length === 0) {
    push('warning', 'modules', 'modules 为空，站点不会展示内容', '至少写几条 module');
  } else {
    data.modules.forEach((m, i) => validateModule(m, `modules[${i}]`, data, push));
    // 检查 id 唯一
    const mids = data.modules.map(m => m.id).filter(Boolean);
    const dupes = mids.filter((id, i) => mids.indexOf(id) !== i);
    if (dupes.length) push('error', 'modules', `module id 重复: ${[...new Set(dupes)].join(', ')}`, '改成唯一 id');
  }

  return { errors, warnings };
}

function validateMeta(meta, push) {
  // userProduct
  if (!meta.userProduct) {
    push('error', 'meta.userProduct', '缺少 userProduct 配置', '添加 { name, monogram, homeUrl, screenshotDir }');
  } else {
    ['name', 'monogram'].forEach(k => {
      if (!meta.userProduct[k]) push('error', `meta.userProduct.${k}`, `缺失`, `填入字符串`);
    });
    if (!meta.userProduct.screenshotDir) {
      push('warning', 'meta.userProduct.screenshotDir', '未指定，默认用 "user-screenshots"', '建议明确指定');
    }
  }

  // dimensions
  if (!Array.isArray(meta.dimensions) || meta.dimensions.length === 0) {
    push('error', 'meta.dimensions', '必须是非空数组', '添加至少 3-7 个维度');
  } else {
    meta.dimensions.forEach((d, i) => {
      if (!d.id) push('error', `meta.dimensions[${i}].id`, '缺失', '填入短 id 如 "efficiency"');
      if (!d.name) push('error', `meta.dimensions[${i}].name`, '缺失', '填入显示名');
    });
    const dids = meta.dimensions.map(d => d.id).filter(Boolean);
    const dupes = dids.filter((id, i) => dids.indexOf(id) !== i);
    if (dupes.length) push('error', 'meta.dimensions', `id 重复: ${[...new Set(dupes)].join(', ')}`, '改成唯一');
  }

  // verdicts
  if (!Array.isArray(meta.verdicts) || meta.verdicts.length === 0) {
    push('warning', 'meta.verdicts', '建议补充 verdict 字典', '参考 templates/analysis-data.example.json');
  }
}

function validateProduct(p, path, push) {
  if (!p || typeof p !== 'object') {
    push('error', path, '必须是 object', '');
    return;
  }
  ['id', 'name'].forEach(k => {
    if (!p[k]) push('error', `${path}.${k}`, '缺失', '填入字符串');
  });
  if (p.category && !VALID_CATEGORIES.includes(p.category)) {
    push('warning', `${path}.category`,
      `值 "${p.category}" 不在推荐枚举 [${VALID_CATEGORIES.join(', ')}]`,
      '改成 "domestic"/"overseas"/"saas" 等，否则首页分组会漏这个产品');
  }
  if (p.status && !VALID_STATUSES.includes(p.status)) {
    push('warning', `${path}.status`, `值 "${p.status}" 不在枚举`, `改成 "ready"/"pending"`);
  }
  if (!p.icon && !p.monogram) {
    push('warning', `${path}.icon`, '缺少单字 logo（icon 或 monogram）', `用 "${(p.name || '?').charAt(0).toUpperCase()}"`);
  }
}

function validateModule(m, path, data, push) {
  if (!m || typeof m !== 'object') {
    push('error', path, '必须是 object', '');
    return;
  }
  ['id', 'productId', 'dimensionId', 'title'].forEach(k => {
    if (!m[k]) push('error', `${path}.${k}`, '缺失', '必填字段');
  });

  // 检查 productId 指向真实存在的产品
  if (m.productId && Array.isArray(data.products)) {
    const exists = data.products.some(p => p.id === m.productId);
    if (!exists) {
      push('error', `${path}.productId`,
        `引用的 productId "${m.productId}" 在 products 数组中不存在`,
        `检查 products 里有没有这个 id，或者改正 module 的 productId`);
    }
  }

  // 检查 dimensionId 指向真实存在的维度
  if (m.dimensionId && data.meta && Array.isArray(data.meta.dimensions)) {
    const exists = data.meta.dimensions.some(d => d.id === m.dimensionId);
    if (!exists) {
      push('error', `${path}.dimensionId`,
        `引用的 dimensionId "${m.dimensionId}" 在 meta.dimensions 中不存在`,
        `检查维度 id 是否拼错`);
    }
  }

  // impact/effort 数字 1-5
  ['impact', 'effort'].forEach(k => {
    if (m[k] != null) {
      const n = Number(m[k]);
      if (!Number.isFinite(n)) {
        push('error', `${path}.${k}`, `必须是数字，当前 "${m[k]}"`, '改成 1-5 的数字');
      } else if (n < 1 || n > 5) {
        push('warning', `${path}.${k}`, `值 ${n} 超出 1-5`, '夹在 1-5 之间');
      }
    } else {
      push('warning', `${path}.${k}`, '缺失', '建议填 1-5 的评分');
    }
  });

  // verdict 合法性
  if (m.verdict && data.meta && Array.isArray(data.meta.verdicts)) {
    const valids = data.meta.verdicts.map(v => v.id);
    if (!valids.includes(m.verdict)) {
      push('warning', `${path}.verdict`,
        `值 "${m.verdict}" 不在 meta.verdicts 里，徽标会显示为"未知"`,
        `改成 [${valids.join('/')}] 之一`);
    }
  }

  // screenshot 字段存在即可（运行时再检查文件是否存在）
  if (!m.screenshot) {
    push('warning', `${path}.screenshot`, '未指定竞品截图', '补上竞品截图文件名');
  }

  // annotations 数组格式
  if (m.annotations) {
    if (!Array.isArray(m.annotations)) {
      push('error', `${path}.annotations`, '必须是数组', '写成 []');
    } else {
      m.annotations.forEach((a, i) => {
        if (!a || typeof a !== 'object') return;
        ['x', 'y', 'w', 'h'].forEach(k => {
          if (a[k] != null && !Number.isFinite(Number(a[k]))) {
            push('error', `${path}.annotations[${i}].${k}`, `必须是数字`, '改成百分比数字 0-100');
          }
        });
        if (a.x != null && (Number(a.x) < 0 || Number(a.x) > 100)) {
          push('warning', `${path}.annotations[${i}].x`, `值 ${a.x} 超出 0-100`, '百分比坐标');
        }
      });
      if (m.annotations.length > 8) {
        push('warning', `${path}.annotations`,
          `标注 ${m.annotations.length} 个太多，截图会很花`, '建议 ≤5 个');
      }
    }
  }

  // tags 格式
  if (m.tags && !Array.isArray(m.tags)) {
    push('error', `${path}.tags`, '必须是数组', '写成 [["good", "xxx"], ["info", "yyy"]]');
  }
}

/**
 * 额外检查：截图文件是否存在（单独提供，因为需要访问文件系统）
 */
function validateScreenshotsExist(data, screenshotsRoot) {
  const missing = [];
  const userDir = (data.meta && data.meta.userProduct && data.meta.userProduct.screenshotDir) || 'user-screenshots';
  const prefix = (data.meta && data.meta.screenshotPathPrefix) || 'assets/screenshots/v2/';

  (data.modules || []).forEach(m => {
    if (m.screenshot) {
      // 竞品截图：试试几种可能的相对路径
      const candidates = [
        `${screenshotsRoot}/${m.screenshot}`,
        `${screenshotsRoot}/competitors/${m.screenshot}`,
        `${screenshotsRoot}/screenshots/v2/${m.screenshot}`,
        `${screenshotsRoot}/${prefix.replace(/^assets\//, '').replace(/\/$/, '')}/${m.screenshot}`,
      ];
      if (!candidates.some(p => fs.existsSync(p))) {
        missing.push({ module: m.id, type: 'competitor', file: m.screenshot, searched: candidates });
      }
    }
    const upShot = m.userProductScreenshot || m.tideoScreenshot;
    if (upShot) {
      const candidates = [
        `${screenshotsRoot}/${upShot}`,
        `${screenshotsRoot}/user/${upShot}`,
        `${screenshotsRoot}/${userDir}/${upShot}`,
      ];
      if (!candidates.some(p => fs.existsSync(p))) {
        missing.push({ module: m.id, type: 'userProduct', file: upShot, searched: candidates });
      }
    }
  });

  return missing;
}

/**
 * 打印可读报告
 */
function printReport({ errors, warnings }, missing = []) {
  if (errors.length === 0 && warnings.length === 0 && missing.length === 0) {
    console.log('\n✅ 数据校验通过，所有字段结构和引用都正确。\n');
    return;
  }

  if (errors.length) {
    console.log(`\n❌ ${errors.length} 个 Error（这些会让站点崩或显示错误）：`);
    errors.forEach(e => {
      console.log(`  • ${e.path}`);
      console.log(`    ${e.msg}`);
      if (e.fix) console.log(`    → 修复: ${e.fix}`);
    });
  }

  if (warnings.length) {
    console.log(`\n⚠️  ${warnings.length} 个 Warning（不崩但不完美）：`);
    warnings.slice(0, 20).forEach(w => {
      console.log(`  • ${w.path}: ${w.msg}`);
      if (w.fix) console.log(`    → ${w.fix}`);
    });
    if (warnings.length > 20) console.log(`  ... 另有 ${warnings.length - 20} 个 warning 省略`);
  }

  if (missing.length) {
    console.log(`\n📷 ${missing.length} 个截图文件缺失：`);
    missing.slice(0, 10).forEach(mi => {
      console.log(`  • module ${mi.module} (${mi.type}): ${mi.file}`);
      console.log(`    搜索过: ${mi.searched.map(p => p.replace(/^.*\//, '...')).slice(0, 2).join(', ')}`);
    });
    if (missing.length > 10) console.log(`  ... 另有 ${missing.length - 10} 个缺失`);
  }

  console.log('');
}

// CLI
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.data) {
    console.error('用法: node validate-data.js --data <analysis-data.json> [--screenshots <dir>]');
    process.exit(1);
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(args.data, 'utf-8'));
  } catch (err) {
    console.error(`❌ 无法解析 JSON: ${err.message}`);
    process.exit(1);
  }

  const report = validate(data);
  let missing = [];
  if (args.screenshots) {
    missing = validateScreenshotsExist(data, args.screenshots);
  }

  printReport(report, missing);

  if (report.errors.length > 0 || missing.length > 0) {
    process.exit(1);
  } else if (report.warnings.length > 0) {
    process.exit(2);
  }
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

module.exports = { validate, validateScreenshotsExist, printReport };
