/**
 * 浮层清扫规则库
 *
 * 在截图前注入到页面，干掉所有干扰元素：
 * - 营销弹窗、cookie 横幅、新手引导、tooltip
 * - 高 z-index 的可疑浮层
 *
 * 实测对 CapCut Web、Descript、Runway 都有效
 */

// 通用规则：常见浮层的 selector
const COMMON_KILL_SELECTORS = [
  // ARIA 角色
  '[role=alert]',
  '[role=dialog]',
  '[role=alertdialog]',
  '[role=tooltip]',
  // 类名包含关键词（不区分大小写）
  '[class*=overlay i]',
  '[class*=modal i]',
  '[class*=mask i]',
  '[class*=backdrop i]',
  '[class*=guide i]',
  '[class*=tutorial i]',
  '[class*=onboard i]',
  '[class*=hint i]',
  '[class*=banner i]',
  '[class*=promotion i]',
  '[class*=promo i]',
  '[class*=cookie i]',
  '[class*=consent i]',
  '[class*=announce i]',
  '[class*=notification i]',
  '[class*=popup i]',
  // ID 模式
  '[id*=cookie i]',
  '[id*=consent i]',
  '[id*=banner i]',
  // 常见广告位
  '[data-testid*=banner i]',
  '[data-testid*=announce i]',
];

// 不能误杀的"重要节点"白名单选择器
const PROTECTED_SELECTORS = [
  'menu',
  '[role=menu]',
  '[role=menubar]',
  'main',
  '[role=main]',
  '[role=navigation]',
  '[role=toolbar]',
  '[role=tablist]',
];

/**
 * 在浏览器页面上执行清扫，返回干掉了多少个元素
 *
 * @param {import('playwright').Page} page
 * @param {string[]} extraSelectors 站点特定补充规则
 * @returns {Promise<number>}
 */
async function clean(page, extraSelectors = []) {
  const allSelectors = [...COMMON_KILL_SELECTORS, ...extraSelectors];

  return await page.evaluate(({ selectors, protectedSels }) => {
    let killed = 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const viewportArea = vw * vh;

    function isProtected(el) {
      if (protectedSels.some(sel => el.closest(sel))) return true;
      // 占视口面积超过 50% 的肯定是主体内容，不是 modal
      const r = el.getBoundingClientRect();
      const area = r.width * r.height;
      if (area > viewportArea * 0.5) return true;
      // 包含 main / nav / 大量子元素的也保护
      if (el.querySelector('main, nav, [role=main], [role=navigation]')) return true;
      // 子节点超过 30 个的多半是布局容器
      if (el.children && el.children.length > 30) return true;
      return false;
    }

    // 第一轮：按 selector 干掉
    for (const sel of selectors) {
      try {
        document.querySelectorAll(sel).forEach(el => {
          if (isProtected(el)) return;
          el.remove();
          killed++;
        });
      } catch (e) {
        // selector 语法不支持就跳过
      }
    }

    // 第二轮：扫描所有高 z-index 的可疑大浮层
    const allEls = document.querySelectorAll('body *');
    for (const el of allEls) {
      try {
        const z = parseInt(window.getComputedStyle(el).zIndex, 10);
        if (
          z > 999 &&
          el.offsetWidth > 100 &&
          el.offsetHeight > 50 &&
          !isProtected(el)
        ) {
          el.style.display = 'none';
          killed++;
        }
      } catch (e) {}
    }

    // 第三轮：解锁 body 滚动（弹窗常会锁 overflow:hidden）
    try {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.pointerEvents = '';
    } catch (e) {}

    return killed;
  }, { selectors: allSelectors, protectedSels: PROTECTED_SELECTORS });
}

module.exports = { clean, COMMON_KILL_SELECTORS, PROTECTED_SELECTORS };
