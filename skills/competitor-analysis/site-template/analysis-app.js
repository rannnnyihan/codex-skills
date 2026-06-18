/* ════════════════════════════════════════
   竞品分析平台 · 多页路由架构（template version）
   - hash router: #/ , #/product/:id , #/dimension/:id , #/insights
   - 顶部 sticky 导航 + breadcrumb + 产品快速切换
   - 首屏极简：hero + 产品矩阵 + 维度入口
   - 每个产品有独立详情页

   产品名通过 DATA.meta.userProduct.name 注入，可适配任意产品
   ════════════════════════════════════════ */

let DATA = null;
const STORAGE_KEY = 'competitor-analysis-notes-v1';

/* ── 用户产品（自家产品）相关 helpers ── */
function up() {
  // 用户产品配置 fallback
  return (DATA && DATA.meta && DATA.meta.userProduct) || {
    name: 'Our Product',
    monogram: 'O',
    screenshotDir: 'user-screenshots',
    homeUrl: '#'
  };
}
function upName() { return up().name; }
function upMonogram() { return up().monogram; }
function upScreenshotDir() { return up().screenshotDir; }
function upHomeUrl() { return up().homeUrl; }

/* ── Icon helper ── */
function icon(id, cls = 'icon') {
  return `<svg class="${cls}"><use href="#i-${id}"/></svg>`;
}

/* ── Storage Helpers ── */
function loadNotes() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function saveNotes(notes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}
function getModuleNote(moduleId) {
  return loadNotes()[moduleId] || '';
}
function setModuleNote(moduleId, text) {
  const notes = loadNotes();
  if (text.trim()) notes[moduleId] = text;
  else delete notes[moduleId];
  saveNotes(notes);
}

/* ── Data accessors（带 fallback，数据异常时返回占位对象而不是 undefined）── */
const PLACEHOLDER_PRODUCT = { id: '__missing__', name: '(未知产品)', icon: '?', color: '#94a3b8', tags: [], category: 'other', tier: 'unknown', tierLabel: '未分类', desc: '', status: 'pending' };
const PLACEHOLDER_DIMENSION = { id: '__missing__', name: '(未知维度)', desc: '', iconId: 'alert-circle' };
const PLACEHOLDER_VERDICT = { id: '__missing__', label: '未分类', color: '#94a3b8', bg: '#f1f5f9', priority: 0 };

function getProduct(id) {
  if (!id || !DATA || !DATA.products) return PLACEHOLDER_PRODUCT;
  return DATA.products.find(p => p.id === id) || { ...PLACEHOLDER_PRODUCT, id, name: `(缺失产品: ${id})` };
}
function getDimension(id) {
  if (!id || !DATA || !DATA.meta || !DATA.meta.dimensions) return PLACEHOLDER_DIMENSION;
  return DATA.meta.dimensions.find(d => d.id === id) || { ...PLACEHOLDER_DIMENSION, id, name: `(缺失维度: ${id})` };
}
function getVerdict(id) {
  if (!id || !DATA || !DATA.meta || !DATA.meta.verdicts) return PLACEHOLDER_VERDICT;
  return DATA.meta.verdicts.find(v => v.id === id) || { ...PLACEHOLDER_VERDICT, id };
}
function getModulesByProduct(pid) { return (DATA && DATA.modules) ? DATA.modules.filter(m => m.productId === pid) : []; }
function getModulesByDimension(did) { return (DATA && DATA.modules) ? DATA.modules.filter(m => m.dimensionId === did) : []; }
function getScreenshotUrl(filename) {
  const prefix = (DATA && DATA.meta && DATA.meta.screenshotPathPrefix) || 'assets/screenshots/v2/';
  return prefix + (filename || '');
}

/* ── Brand Logo (monogram, 后续可替换为真实 SVG logo) ── */
function brandLogo(p, size = 44) {
  const isLight = ['#fbbf24', '#f59e0b'].includes(p.color);
  const color = isLight ? '#0a0a0b' : '#fff';
  const fontSize = Math.round(size * 0.46);
  const radius = Math.round(size * 0.22);
  return `<div class="brand-logo" style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${p.color};color:${color};font-size:${fontSize}px">${p.icon}</div>`;
}

/* ════════════════════════════════════════
   ROUTER
   ════════════════════════════════════════ */

const ROUTES = [
  { pattern: /^#\/$|^$/, view: 'home' },
  { pattern: /^#\/products$/, view: 'products' },
  { pattern: /^#\/product\/(.+)$/, view: 'product' },
  { pattern: /^#\/dimensions$/, view: 'dimensions' },
  { pattern: /^#\/dimension\/(.+)$/, view: 'dimension' },
  { pattern: /^#\/insights$/, view: 'insights' }
];

function parseRoute() {
  const hash = location.hash || '#/';
  for (const r of ROUTES) {
    const m = hash.match(r.pattern);
    if (m) return { view: r.view, param: m[1] || null };
  }
  return { view: 'home', param: null };
}

function navigate(hash) {
  if (location.hash === hash) {
    handleRoute();
  } else {
    location.hash = hash;
  }
}

function handleRoute() {
  const route = parseRoute();
  window.scrollTo(0, 0);

  // breadcrumbs
  renderCrumbs(route);
  // product quick-jump 仅在 product 页显示
  document.getElementById('topnav-jump-wrap').hidden = route.view !== 'product';
  // 顶部导航 active 状态
  document.querySelectorAll('.topnav-link').forEach(l => {
    const isMatch = ((route.view === 'products' || route.view === 'product') && l.dataset.route === '#/products')
                 || ((route.view === 'dimensions' || route.view === 'dimension') && l.dataset.route === '#/dimensions')
                 || (route.view === 'insights' && l.dataset.route === '#/insights');
    l.classList.toggle('active', isMatch);
  });

  switch (route.view) {
    case 'home': renderHome(); break;
    case 'products': renderProductsIndex(); break;
    case 'product': renderProduct(route.param); break;
    case 'dimensions': renderDimensionsIndex(); break;
    case 'dimension': renderDimension(route.param); break;
    case 'insights': renderInsights(); break;
    default: renderHome();
  }
}

/* ── Top Nav: Breadcrumbs ── */
function renderCrumbs(route) {
  const el = document.getElementById('topnav-crumbs');
  if (route.view === 'home') {
    el.innerHTML = '';
    return;
  }
  const crumbs = [{ label: '首页', href: '#/' }];
  if (route.view === 'products') {
    crumbs.push({ label: '全部产品', href: null });
  } else if (route.view === 'product') {
    const p = getProduct(route.param);
    if (p) crumbs.push({ label: '产品', href: '#/products' }, { label: p.name, href: null });
  } else if (route.view === 'dimensions') {
    crumbs.push({ label: '全部维度', href: null });
  } else if (route.view === 'dimension') {
    const d = getDimension(route.param);
    if (d) crumbs.push({ label: '维度', href: '#/dimensions' }, { label: d.name, href: null });
  } else if (route.view === 'insights') {
    crumbs.push({ label: '洞察', href: null });
  }
  el.innerHTML = crumbs.map((c, i) => {
    const sep = i > 0 ? `<span class="crumb-sep">${icon('chevron-right', 'icon icon-sm')}</span>` : '';
    if (c.href) return `${sep}<a class="crumb crumb-link" href="${c.href}">${c.label}</a>`;
    return `${sep}<span class="crumb crumb-current">${c.label}</span>`;
  }).join('');
}

/* ── Top Nav: Product Quick-Jump ── */
function renderJumpMenu(currentId) {
  const menu = document.getElementById('topnav-jump-menu');
  const domestic = DATA.products.filter(p => p.category === 'domestic');
  const overseas = DATA.products.filter(p => p.category === 'overseas');
  const directs = DATA.products.filter(p => p.tier === 'direct');
  const inspirations = DATA.products.filter(p => p.tier === 'inspiration');
  const useTierGroup = (domestic.length + overseas.length === 0) && (directs.length + inspirations.length > 0);
  const renderItem = (p) => {
    const isCurrent = p.id === currentId;
    const isPending = p.status === 'pending';
    return `
      <a class="jump-item ${isCurrent ? 'current' : ''} ${isPending ? 'pending' : ''}" href="#/product/${p.id}">
        ${brandLogo(p, 24)}
        <span class="jump-name">${p.name}</span>
        ${isPending ? '<span class="jump-tag">待补充</span>' : ''}
        ${isCurrent ? `<span class="jump-check">${icon('check', 'icon icon-sm')}</span>` : ''}
      </a>
    `;
  };
  menu.innerHTML = useTierGroup ? `
    <div class="jump-group-label">直接对手</div>
    ${directs.map(renderItem).join('')}
    <div class="jump-group-label">单点标杆</div>
    ${inspirations.map(renderItem).join('')}
  ` : `
    <div class="jump-group-label">国产</div>
    ${domestic.map(renderItem).join('')}
    <div class="jump-group-label">海外</div>
    ${overseas.map(renderItem).join('')}
  `;
}

function bindJumpMenu() {
  const btn = document.getElementById('topnav-jump-btn');
  const menu = document.getElementById('topnav-jump-menu');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && e.target !== btn) menu.hidden = true;
  });
}

/* ════════════════════════════════════════
   PAGE: HOME
   极简 hero + 产品矩阵 + 维度入口
   ════════════════════════════════════════ */
function renderHome() {
  const page = document.getElementById('page');
  const ready = DATA.products.filter(p => p.status === 'ready');
  const totalModules = DATA.modules.length;

  const renderProdCard = (p) => {
    const isPending = p.status === 'pending';
    const ms = getModulesByProduct(p.id);
    const borrow = ms.filter(m => m.verdict === 'borrow' || m.verdict === 'borrow-strong').length;
    const improve = ms.filter(m => m.verdict === 'improve').length;
    return `
      <a class="prod-card-compact ${isPending ? 'is-pending' : ''}" href="#/product/${p.id}">
        ${brandLogo(p, 36)}
        <div class="pcc-body">
          <div class="pcc-name">${p.name}</div>
          <div class="pcc-meta">
            <span class="tier-pill tier-${p.tier}">${p.tierLabel}</span>
            ${isPending
              ? '<span class="pcc-pending">截图待补充</span>'
              : `<span class="pcc-stat">${ms.length} 模块</span>
                 ${borrow > 0 ? `<span class="pcc-stat pcc-stat-pos">${borrow} 可借鉴</span>` : ''}
                 ${improve > 0 ? `<span class="pcc-stat pcc-stat-neg">${improve} 需改进</span>` : ''}`}
          </div>
        </div>
        <span class="pcc-arrow">${icon('chevron-right', 'icon icon-sm')}</span>
      </a>
    `;
  };

  const renderDimRow = (d, i) => {
    const ms = getModulesByDimension(d.id);
    const productCount = new Set(ms.map(m => m.productId)).size;
    return `
      <a class="dim-row-clean" href="#/dimension/${d.id}">
        <span class="drcl-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="drcl-name">${d.name}</span>
        <span class="drcl-bar"><span class="drcl-bar-fill" style="width:${(ms.length / 13) * 100}%"></span></span>
        <span class="drcl-count"><strong>${ms.length}</strong> 模块</span>
      </a>
    `;
  };

  const domestic = DATA.products.filter(p => p.category === 'domestic');
  const overseas = DATA.products.filter(p => p.category === 'overseas');

  // v0.5.3: tier 分组（self/direct/inspiration），用作"按产品看"的优先分组方案
  // 当老的 domestic/overseas 全为空时（新版 schema），自动 fallback 到 tier 分组
  const directs = DATA.products.filter(p => p.tier === 'direct');
  const inspirations = DATA.products.filter(p => p.tier === 'inspiration');
  const useTierGroup = (domestic.length + overseas.length === 0) && (directs.length + inspirations.length > 0);

  // v0.5: 目标导向首屏 —— 如果有 analysisGoals 和 keyInsightsByGoal，首屏突出展示
  const goals = (DATA.meta && DATA.meta.analysisGoals) || [];
  const insightsByGoal = DATA.keyInsightsByGoal || [];
  const hasGoalView = goals.length > 0 && insightsByGoal.length > 0;

  const renderGoalCard = (goal) => {
    const group = insightsByGoal.find(g => g.goalId === goal.id);
    const recs = (group && group.topRecommendations) || [];
    const recCount = recs.length;
    const color = goal.color || '#6366f1';
    const priorityColor = goal.priority === 'P0' ? '#dc2626' : goal.priority === 'P1' ? '#d97706' : '#2563eb';

    const renderRec = (r) => {
      const effortBar = '●'.repeat(r.effort || 0) + '○'.repeat(5 - (r.effort || 0));
      return `
        <a class="goal-rec" href="#/dimension/${getRecDimensionId(r)}">
          <div class="goal-rec-rank">${r.rank || ''}</div>
          <div class="goal-rec-body">
            <div class="goal-rec-title">${escapeHtml(r.title || '')}</div>
            <div class="goal-rec-meta">
              <span class="goal-rec-source">来自 <strong>${escapeHtml(r.sourceCompetitor || '')}</strong></span>
              <span class="goal-rec-sep">·</span>
              <span class="goal-rec-priority" style="color:${r.priority === 'P0' ? '#dc2626' : r.priority === 'P1' ? '#d97706' : '#2563eb'}">${r.priority || ''}</span>
              <span class="goal-rec-sep">·</span>
              <span class="goal-rec-effort" title="实现成本 ${r.effort}/5">工作量 ${effortBar}</span>
            </div>
            ${r.expectedImpact ? `
              <div class="goal-rec-impact">
                预计 <strong>${escapeHtml(r.expectedImpact.metric || '')}</strong>
                <span class="goal-rec-direction">${r.expectedImpact.direction || ''}</span>
                <strong class="goal-rec-estimate">${escapeHtml(r.expectedImpact.estimate || '')}</strong>
              </div>
            ` : ''}
            ${r.why ? `<div class="goal-rec-why">${escapeHtml(r.why)}</div>` : ''}
          </div>
          <div class="goal-rec-arrow">${icon('chevron-right', 'icon icon-sm')}</div>
        </a>
      `;
    };

    return `
      <article class="goal-card" style="--goal-color:${color}">
        <header class="goal-card-head">
          <div class="goal-card-priority" style="background:${priorityColor}">${goal.priority || ''}</div>
          <div class="goal-card-head-body">
            <h3 class="goal-card-title">${escapeHtml(goal.name || '')}</h3>
            <p class="goal-card-problem">${escapeHtml(goal.problem || '')}</p>
          </div>
        </header>
        <div class="goal-card-metrics">
          <div class="goal-metric">
            <div class="goal-metric-label">假设指标</div>
            <div class="goal-metric-value">${escapeHtml(goal.hypotheticalMetric || '—')}</div>
          </div>
          <div class="goal-metric">
            <div class="goal-metric-label">预期收益</div>
            <div class="goal-metric-value goal-metric-lift">${escapeHtml(goal.expectedLift || '—')}</div>
          </div>
        </div>
        ${group && group.summary ? `<p class="goal-card-summary">${escapeHtml(group.summary)}</p>` : ''}
        <div class="goal-card-recs">
          <div class="goal-card-recs-head">
            <span>Top ${recCount} 借鉴</span>
          </div>
          ${recs.map(renderRec).join('')}
        </div>
      </article>
    `;
  };

  const goalsSection = hasGoalView ? `
    <section class="goals-section">
      <div class="goals-eyebrow">
        <span class="goals-eyebrow-dot"></span>
        分析目标 · ${goals.length} 个 · ${DATA.meta.userProduct.launchStage === 'pre-launch' ? '首次上线前' : '阶段性'}分析
      </div>
      <h2 class="goals-title">为了解决这些问题，我们从竞品里借鉴什么？</h2>
      <p class="goals-desc">每条借鉴都标注了预计的指标变化和实现成本。下方按目标分组排列，按 impact/effort 排序。</p>
      <div class="goals-grid">
        ${goals.map(renderGoalCard).join('')}
      </div>
    </section>
  ` : '';

  page.innerHTML = `
    <section class="home-hero">
      <div class="home-hero-inner">
        <div class="home-eyebrow">竞品分析 · ${ready.length}/${DATA.products.length} 产品 · ${totalModules} 模块</div>
        <h1 class="home-title">${hasGoalView
          ? `为 ${DATA.meta.userProduct.name} 首次上线，<br>从 ${ready.length} 个竞品里找到了 ${insightsByGoal.reduce((s, g) => s + (g.topRecommendations || []).length, 0)} 条可落地借鉴。`
          : `从交互设计视角，<br>看清 ${ready.length} 款产品的差异。`}</h1>
        <p class="home-desc">${hasGoalView
          ? '每条借鉴都绑定具体目标 + 预期指标变化，不是"值得学一下"的空话。'
          : '挑一个产品深入研究，或挑一个维度横向对比。两条路径，同一份数据。'}</p>
      </div>
    </section>

    ${goalsSection}

    <section class="home-twocol">
      <!-- LEFT: 按产品 -->
      <div class="home-col">
        <div class="home-col-head">
          <div class="home-col-eyebrow">入口 · 1</div>
          <div class="home-col-title">按产品看</div>
          <div class="home-col-desc">挑一个产品 → 进入它的独立详情页</div>
        </div>
        ${useTierGroup ? `
          <div class="home-col-sub">直接对手 · ${directs.filter(p => p.status === 'ready').length}/${directs.length}</div>
          <div class="prod-list">${directs.map(renderProdCard).join('')}</div>
          <div class="home-col-sub">单点标杆 · ${inspirations.filter(p => p.status === 'ready').length}/${inspirations.length}</div>
          <div class="prod-list">${inspirations.map(renderProdCard).join('')}</div>
        ` : `
          <div class="home-col-sub">国产 · ${domestic.filter(p => p.status === 'ready').length}/${domestic.length}</div>
          <div class="prod-list">${domestic.map(renderProdCard).join('')}</div>
          <div class="home-col-sub">海外 · ${overseas.filter(p => p.status === 'ready').length}/${overseas.length}</div>
          <div class="prod-list">${overseas.map(renderProdCard).join('')}</div>
        `}
      </div>

      <!-- RIGHT: 按维度 -->
      <div class="home-col">
        <div class="home-col-head">
          <div class="home-col-eyebrow">入口 · 2</div>
          <div class="home-col-title">按维度看</div>
          <div class="home-col-desc">挑一个维度 → 跨产品横向对比</div>
        </div>
        <div class="home-col-sub">${DATA.meta.dimensions.length} 个交互维度</div>
        <div class="dim-list-clean">${DATA.meta.dimensions.map((d, i) => renderDimRow(d, i)).join('')}</div>

        <a class="insights-cta" href="#/insights">
          <div class="insights-cta-body">
            <div class="insights-cta-eyebrow">综合洞察</div>
            <div class="insights-cta-title">影响-成本矩阵 + Roadmap</div>
            <div class="insights-cta-desc">${totalModules} 模块自动生成的优先级清单</div>
          </div>
          <div class="insights-cta-arrow">${icon('arrow-right', 'icon icon-md')}</div>
        </a>
      </div>
    </section>
  `;
}

// v0.5 辅助：从 recommendation 里反查对应 dimension id
function getRecDimensionId(rec) {
  if (!rec || !rec.sourceCellId) return '';
  const m = (DATA.modules || []).find(x => x.id === rec.sourceCellId);
  return m ? m.dimensionId : '';
}

// v0.5 辅助：HTML 转义（防 XSS，尤其分析文本里用户可能写括号尖括号等）
function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ════════════════════════════════════════
   PAGE: PRODUCT DETAIL
   ════════════════════════════════════════ */
/* ════════════════════════════════════════
   PAGE: PRODUCTS INDEX
   全部产品列表（与 #/dimensions 对称）
   ════════════════════════════════════════ */
function renderProductsIndex() {
  const page = document.getElementById('page');
  const total = DATA.products.length;
  const ready = DATA.products.filter(p => p.status === 'ready').length;
  const totalModules = DATA.modules.length;

  const renderCard = (p) => {
    const isPending = p.status === 'pending';
    const ms = getModulesByProduct(p.id);
    const borrow = ms.filter(m => m.verdict === 'borrow' || m.verdict === 'borrow-strong').length;
    const improve = ms.filter(m => m.verdict === 'improve').length;
    return `
      <a class="prod-index-card ${isPending ? 'is-pending' : ''}" href="#/product/${p.id}">
        ${brandLogo(p, 48)}
        <div class="pic-body">
          <div class="pic-top">
            <span class="pic-name">${p.name}</span>
            <span class="tier-pill tier-${p.tier}">${p.tierLabel}</span>
            ${(p.category === 'domestic' || p.category === 'overseas') ? `<span class="tier-region">${p.category === 'domestic' ? '国产' : '海外'}</span>` : ''}
          </div>
          <div class="pic-tags">${(p.tags || []).slice(0, 4).map(t => `<span class="prod-card-tag">${t}</span>`).join('')}</div>
          ${isPending
            ? '<div class="pic-pending">截图待补充</div>'
            : `<div class="pic-stats">
                 <span><strong>${ms.length}</strong> 模块</span>
                 <span class="dot-sep">·</span>
                 <span class="pcc-stat-pos"><strong>${borrow}</strong> 可借鉴</span>
                 <span class="dot-sep">·</span>
                 <span class="pcc-stat-neg"><strong>${improve}</strong> 需改进</span>
               </div>`}
        </div>
        <span class="pic-arrow">${icon('chevron-right', 'icon icon-sm')}</span>
      </a>
    `;
  };

  const domestic = DATA.products.filter(p => p.category === 'domestic');
  const overseas = DATA.products.filter(p => p.category === 'overseas');
  const directs = DATA.products.filter(p => p.tier === 'direct');
  const inspirations = DATA.products.filter(p => p.tier === 'inspiration');
  const useTierGroup = (domestic.length + overseas.length === 0) && (directs.length + inspirations.length > 0);

  page.innerHTML = `
    <section class="page-hero">
      <div class="page-hero-inner">
        <div class="home-eyebrow">${ready}/${total} 产品 · ${totalModules} 模块</div>
        <h1 class="page-hero-title">全部产品</h1>
        <p class="page-hero-desc">挑一个产品进入它的独立详情页：能力对照 + 模块下钻分析。</p>
      </div>
    </section>

    <section class="prod-index">
      ${useTierGroup ? `
        <div class="prod-index-sub">直接对手 · ${directs.filter(p => p.status === 'ready').length}/${directs.length}</div>
        <div class="prod-index-list">${directs.map(renderCard).join('')}</div>
        <div class="prod-index-sub">单点标杆 · ${inspirations.filter(p => p.status === 'ready').length}/${inspirations.length}</div>
        <div class="prod-index-list">${inspirations.map(renderCard).join('')}</div>
      ` : `
        <div class="prod-index-sub">国产 · ${domestic.filter(p => p.status === 'ready').length}/${domestic.length}</div>
        <div class="prod-index-list">${domestic.map(renderCard).join('')}</div>
        <div class="prod-index-sub">海外 · ${overseas.filter(p => p.status === 'ready').length}/${overseas.length}</div>
        <div class="prod-index-list">${overseas.map(renderCard).join('')}</div>
      `}
    </section>
  `;
}

/* ════════════════════════════════════════
   PAGE: PRODUCT DETAIL
   ════════════════════════════════════════ */
function renderProduct(productId) {
  const page = document.getElementById('page');
  const product = getProduct(productId);
  if (!product) {
    page.innerHTML = `<div class="page-empty">找不到产品 "${productId}" · <a href="#/">返回首页</a></div>`;
    return;
  }
  renderJumpMenu(productId);

  const modules = getModulesByProduct(productId);
  const isPending = product.status === 'pending';

  // 顶部产品 tabs 切换栏
  const productTabsBar = `
    <nav class="prod-tabs-bar">
      ${DATA.products.map(p => {
        const ms = getModulesByProduct(p.id);
        const isActive = p.id === productId;
        const isPend = p.status === 'pending';
        return `
          <a class="prod-tab-link ${isActive ? 'active' : ''} ${isPend ? 'is-pending' : ''}" href="#/product/${p.id}">
            ${brandLogo(p, 18)}
            <span>${p.name}</span>
            ${isPend ? '<span class="prod-tab-tag">待补充</span>' : `<span class="prod-tab-count">${ms.length}</span>`}
          </a>
        `;
      }).join('')}
    </nav>
  `;

  // 上/下产品
  const allReady = DATA.products;
  const idx = allReady.findIndex(p => p.id === productId);
  const prev = idx > 0 ? allReady[idx - 1] : null;
  const next = idx < allReady.length - 1 ? allReady[idx + 1] : null;

  if (isPending) {
    page.innerHTML = `
      <div class="prod-page">
        ${productTabsBar}
        ${renderProductHero(product, modules)}
        <div class="prod-pending">
          ${icon('alert-circle', 'icon icon-lg')}
          <div class="prod-pending-title">${product.name} 截图待补充</div>
          <div class="prod-pending-desc">请提供该产品的工作台 / 创作页 / 配置面板截图</div>
        </div>
        ${renderProductFooterNav(prev, next)}
      </div>
    `;
    return;
  }

  // 按维度分组
  const byDim = {};
  modules.forEach(m => {
    if (!byDim[m.dimensionId]) byDim[m.dimensionId] = [];
    byDim[m.dimensionId].push(m);
  });
  const dimensionsWithModules = DATA.meta.dimensions.filter(d => byDim[d.id]);

  // 维度筛选器（chips）
  const dimChipsHTML = `
    <div class="prod-dim-chips" id="prod-dim-chips">
      <button class="prod-dim-chip active" data-dim="all">全部 <span class="chip-count">${modules.length}</span></button>
      ${dimensionsWithModules.map(d => `
        <button class="prod-dim-chip" data-dim="${d.id}">
          ${icon(d.iconId, 'icon icon-sm')}
          ${d.name}
          <span class="chip-count">${byDim[d.id].length}</span>
        </button>
      `).join('')}
    </div>
  `;

  // 模块行（对比+下钻形态，跟维度页同款）
  const renderProdModuleRow = (m) => {
    const dim = getDimension(m.dimensionId);
    const v = getVerdict(m.verdict);
    const score = m.impact - m.effort;
    return `
      <div class="dcp-row" id="module-${m.id}" data-module-id="${m.id}" data-dim="${m.dimensionId}">
        <button class="dcp-summary dcp-summary-prod" data-toggle-dcp>
          <span class="dcp-dim-tag">
            ${icon(dim.iconId, 'icon icon-sm')}
            <span>${dim.name}</span>
          </span>
          <div class="dcp-cell">
            <div class="dcp-cell-label">模块</div>
            <div class="dcp-cell-value"><strong>${m.title}</strong></div>
          </div>
          <div class="dcp-cell">
            <div class="dcp-cell-label">${product.name} 的做法</div>
            <div class="dcp-cell-value">${m.vsCompetitor}</div>
          </div>
          <div class="dcp-cell">
            <div class="dcp-cell-label">vs ${upName()} 当前</div>
            <div class="dcp-cell-value">${m.userProductDoing || m.vsTideo}</div>
          </div>
          <span class="verdict-badge verdict-${m.verdict}">${v.label}</span>
          <span class="dcp-score" title="影响 ${m.impact} − 成本 ${m.effort}">
            <span class="dcp-score-num">${score > 0 ? '+' : ''}${score}</span>
          </span>
          <span class="dcp-chevron">${icon('chevron-right', 'icon icon-sm')}</span>
        </button>
        <div class="dcp-detail" hidden>
          ${renderModuleDetailBody(m)}
        </div>
      </div>
    `;
  };

  // 按结论排序，可借鉴在前
  const verdictOrder = ['borrow-strong', 'borrow', 'improve', 'already', 'not-applicable'];
  const sortedModules = [...modules].sort((a, b) => verdictOrder.indexOf(a.verdict) - verdictOrder.indexOf(b.verdict));

  page.innerHTML = `
    <div class="prod-page">
      ${productTabsBar}
      ${renderProductHero(product, modules)}

      <section class="dcp-section">
        <div class="dcp-section-head">
          <div class="dcp-section-title">${icon('trending-up', 'icon icon-sm')} ${product.name} vs ${upName()} · 模块对比</div>
          <div class="dcp-section-actions">
            <button class="dcp-action-btn" id="dcp-expand-all">${icon('eye', 'icon icon-sm')} 全部展开</button>
            <button class="dcp-action-btn" id="dcp-collapse-all">${icon('eye-off', 'icon icon-sm')} 全部折叠</button>
          </div>
        </div>
        <div class="dcp-section-hint">每行 = 一个分析模块。按结论排序（可借鉴 → 已超越）。点击行展开看截图标注、详细分析与 Action Item。</div>
        ${dimChipsHTML}
        <div class="dcp-list" id="prod-dcp-list">${sortedModules.map(renderProdModuleRow).join('')}</div>
      </section>

      ${renderProductFooterNav(prev, next)}
    </div>
  `;

  // 维度 chips 筛选
  document.querySelectorAll('.prod-dim-chip').forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('.prod-dim-chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      const dim = c.dataset.dim;
      document.querySelectorAll('#prod-dcp-list .dcp-row').forEach(row => {
        const rowDim = row.dataset.dim;
        row.style.display = (dim === 'all' || rowDim === dim) ? '' : 'none';
      });
    });
  });

  bindModuleEvents();
}

function renderProductHero(product, modules) {
  const ready = product.status === 'ready';
  const borrow = ready ? modules.filter(m => m.verdict === 'borrow' || m.verdict === 'borrow-strong').length : 0;
  const improve = ready ? modules.filter(m => m.verdict === 'improve').length : 0;
  const already = ready ? modules.filter(m => m.verdict === 'already').length : 0;

  return `
    <section class="prod-hero">
      <div class="prod-hero-top">
        ${brandLogo(product, 64)}
        <div class="prod-hero-info">
          <div class="prod-hero-name">
            ${product.name}
            <span class="tier-pill tier-${product.tier}">${product.tierLabel}</span>
            ${(product.category === 'domestic' || product.category === 'overseas') ? `<span class="tier-region">${product.category === 'domestic' ? '国产' : '海外'}</span>` : ''}
          </div>
          <div class="prod-hero-tags">${(product.tags || []).map(t => `<span class="prod-card-tag">${t}</span>`).join('')}</div>
        </div>
        <a class="prod-hero-link" href="${product.url}" target="_blank" rel="noopener">
          ${icon('external-link', 'icon icon-sm')}
          访问官网
        </a>
      </div>
      <div class="prod-hero-desc">${product.desc}</div>
      ${ready ? `
        <div class="prod-hero-stats">
          <div class="hero-stat"><span class="num">${modules.length}</span><span class="lbl">分析模块</span></div>
          <div class="hero-stat"><span class="num">${borrow}</span><span class="lbl">可借鉴</span></div>
          <div class="hero-stat"><span class="num">${improve}</span><span class="lbl">需改进</span></div>
          <div class="hero-stat"><span class="num">${already}</span><span class="lbl">已超越</span></div>
        </div>
      ` : ''}
    </section>
  `;
}

function renderProductFooterNav(prev, next) {
  return `
    <nav class="prod-footer-nav">
      ${prev ? `
        <a class="prod-foot-link prev" href="#/product/${prev.id}">
          ${icon('arrow-left', 'icon icon-sm')}
          <div>
            <div class="lbl">上一个产品</div>
            <div class="name">${prev.name}</div>
          </div>
        </a>
      ` : '<div></div>'}
      <a class="prod-foot-home" href="#/products">${icon('layout-grid', 'icon icon-sm')} 全部产品</a>
      ${next ? `
        <a class="prod-foot-link next" href="#/product/${next.id}">
          <div>
            <div class="lbl">下一个产品</div>
            <div class="name">${next.name}</div>
          </div>
          ${icon('arrow-right', 'icon icon-sm')}
        </a>
      ` : '<div></div>'}
    </nav>
  `;
}

/* ════════════════════════════════════════
   PAGE: DIMENSIONS INDEX
   ════════════════════════════════════════ */
function renderDimensionsIndex() {
  const page = document.getElementById('page');
  page.innerHTML = `
    <section class="page-hero">
      <div class="page-hero-inner">
        <div class="home-eyebrow">7 个交互维度</div>
        <h1 class="page-hero-title">按维度横向对比</h1>
        <p class="page-hero-desc">每个维度下，所有竞品的做法、与 ${upName()} 的差距、可借鉴的点。</p>
      </div>
    </section>
    <section class="dim-index">
      ${DATA.meta.dimensions.map(d => {
        const ms = getModulesByDimension(d.id);
        const productCount = new Set(ms.map(m => m.productId)).size;
        return `
          <a class="dim-index-card" href="#/dimension/${d.id}">
            <div class="dim-index-icon">${icon(d.iconId, 'icon icon-lg')}</div>
            <div class="dim-index-body">
              <div class="dim-index-name">${d.name}</div>
              <div class="dim-index-desc">${d.desc}</div>
              <div class="dim-index-meta">
                <span><strong>${productCount}</strong> 个产品</span>
                <span class="dot-sep">·</span>
                <span><strong>${ms.length}</strong> 个模块</span>
              </div>
            </div>
            <div class="dim-index-arrow">${icon('chevron-right', 'icon icon-sm')}</div>
          </a>
        `;
      }).join('')}
    </section>
  `;
}

/* ════════════════════════════════════════
   PAGE: DIMENSION DETAIL
   ════════════════════════════════════════ */
function renderDimension(dimId) {
  const page = document.getElementById('page');
  const dim = getDimension(dimId);
  if (!dim) {
    page.innerHTML = `<div class="page-empty">找不到维度 "${dimId}" · <a href="#/">返回首页</a></div>`;
    return;
  }

  const modules = getModulesByDimension(dimId);
  const products = [...new Set(modules.map(m => m.productId))]
    .map(pid => getProduct(pid))
    .filter(Boolean);

  // 合并对比 + 详情：每行可下钻展开
  const compareRows = modules.map(m => {
    const p = getProduct(m.productId);
    const v = getVerdict(m.verdict);
    const score = m.impact - m.effort;
    return `
      <div class="dcp-row" id="module-${m.id}" data-module-id="${m.id}">
        <button class="dcp-summary" data-toggle-dcp>
          <span class="dcp-prod">
            ${brandLogo(p, 28)}
            <span class="dcp-prod-name">${p.name}</span>
          </span>
          <div class="dcp-cell">
            <div class="dcp-cell-label">该产品的做法</div>
            <div class="dcp-cell-value"><strong>${m.vsCompetitor}</strong></div>
          </div>
          <div class="dcp-cell">
            <div class="dcp-cell-label">vs ${upName()} 当前</div>
            <div class="dcp-cell-value">${m.userProductDoing || m.vsTideo}</div>
          </div>
          <span class="verdict-badge verdict-${m.verdict}">${v.label}</span>
          <span class="dcp-score" title="影响 ${m.impact} − 成本 ${m.effort}">
            <span class="dcp-score-num">${score > 0 ? '+' : ''}${score}</span>
          </span>
          <span class="dcp-chevron">${icon('chevron-right', 'icon icon-sm')}</span>
        </button>
        <div class="dcp-detail" hidden>
          ${renderModuleDetailBody(m)}
        </div>
      </div>
    `;
  }).join('');

  // 上/下维度
  const dimIdx = DATA.meta.dimensions.findIndex(d => d.id === dimId);
  const prevDim = dimIdx > 0 ? DATA.meta.dimensions[dimIdx - 1] : null;
  const nextDim = dimIdx < DATA.meta.dimensions.length - 1 ? DATA.meta.dimensions[dimIdx + 1] : null;

  page.innerHTML = `
    <div class="dim-page">
      <nav class="dim-tabs-bar">
        ${DATA.meta.dimensions.map(d => {
          const ms = getModulesByDimension(d.id);
          const isActive = d.id === dimId;
          return `
            <a class="dim-tab ${isActive ? 'active' : ''}" href="#/dimension/${d.id}">
              ${icon(d.iconId, 'icon icon-sm')}
              <span>${d.name}</span>
              <span class="dim-tab-count">${ms.length}</span>
            </a>
          `;
        }).join('')}
      </nav>

      <section class="dim-baseline">
        <div class="dim-baseline-head">
          <div class="dim-baseline-icon">${icon(dim.iconId, 'icon icon-md')}</div>
          <div>
            <h1 class="dim-baseline-title">${dim.name}</h1>
            <div class="dim-baseline-desc">${dim.desc}</div>
          </div>
        </div>
        <div class="dim-baseline-grid">
          <div class="dim-baseline-card dim-baseline-now">
            <div class="dim-baseline-label">
              <span class="dim-baseline-userprod-dot">${upMonogram()}</span>
              ${upName()} 当前
            </div>
            <div class="dim-baseline-text">${(dim.userProductBaseline || dim.tideoBaseline) || '（待补充）'}</div>
          </div>
          <div class="dim-baseline-card dim-baseline-gap">
            <div class="dim-baseline-label">
              ${icon('alert-circle', 'icon icon-sm')}
              主要差距
            </div>
            <div class="dim-baseline-text">${(dim.userProductGap || dim.tideoGap) || '（待补充）'}</div>
          </div>
        </div>
      </section>

      <section class="dcp-section">
        <div class="dcp-section-head">
          <div class="dcp-section-title">${icon('layers', 'icon icon-sm')} 竞品在该维度的做法</div>
          <div class="dcp-section-actions">
            <button class="dcp-action-btn" id="dcp-expand-all">${icon('eye', 'icon icon-sm')} 全部展开</button>
            <button class="dcp-action-btn" id="dcp-collapse-all">${icon('eye-off', 'icon icon-sm')} 全部折叠</button>
          </div>
        </div>
        <div class="dcp-section-hint">${products.length} 个竞品在「${dim.name}」维度的做法 vs ${upName()}。点击行展开看截图标注、详细分析与 Action Item。</div>
        <div class="dcp-list">${compareRows}</div>
      </section>

      <nav class="prod-footer-nav">
        ${prevDim ? `
          <a class="prod-foot-link prev" href="#/dimension/${prevDim.id}">
            ${icon('arrow-left', 'icon icon-sm')}
            <div>
              <div class="lbl">上一个维度</div>
              <div class="name">${prevDim.name}</div>
            </div>
          </a>
        ` : '<div></div>'}
        <a class="prod-foot-home" href="#/dimensions">${icon('layout-grid', 'icon icon-sm')} 全部维度</a>
        ${nextDim ? `
          <a class="prod-foot-link next" href="#/dimension/${nextDim.id}">
            <div>
              <div class="lbl">下一个维度</div>
              <div class="name">${nextDim.name}</div>
            </div>
            ${icon('arrow-right', 'icon icon-sm')}
          </a>
        ` : '<div></div>'}
      </nav>
    </div>
  `;

  bindModuleEvents();
}

/* ════════════════════════════════════════
   PAGE: INSIGHTS
   ════════════════════════════════════════ */
function renderInsights() {
  const page = document.getElementById('page');
  const all = DATA.modules;
  const ranked = [...all]
    .filter(m => m.verdict === 'borrow' || m.verdict === 'borrow-strong' || m.verdict === 'improve')
    .sort((a, b) => (b.impact - b.effort) - (a.impact - a.effort));

  const matrixDots = ranked.map(m => {
    const p = getProduct(m.productId);
    const x = (m.effort / 5) * 100;
    const y = 100 - (m.impact / 5) * 100;
    return `<div class="matrix-dot" style="left:${x}%;top:${y}%;background:${p.color}" data-label="${p.name} · ${m.title}" data-jump-module="${m.id}"></div>`;
  }).join('');

  const summary = {
    total: all.length,
    borrowStrong: all.filter(m => m.verdict === 'borrow-strong').length,
    borrow: all.filter(m => m.verdict === 'borrow').length,
    improve: all.filter(m => m.verdict === 'improve').length,
    already: all.filter(m => m.verdict === 'already').length,
  };

  const roadmapItems = ranked.slice(0, 20).map((m, i) => {
    const p = getProduct(m.productId);
    const score = m.impact - m.effort;
    return `
      <a class="roadmap-item" href="#/product/${m.productId}" data-module-id="${m.id}">
        <div class="roadmap-rank ${i < 3 ? 'top' : ''}">${String(i + 1).padStart(2, '0')}</div>
        <div class="roadmap-content">
          <h4>${m.title}</h4>
          <p>${m.actionItem || ''}</p>
        </div>
        <div class="roadmap-prod">
          ${brandLogo(p, 22)}
          <span>${p.name}</span>
        </div>
        <div class="roadmap-score">影响 ${m.impact} − 成本 ${m.effort} = <strong>${score > 0 ? '+' : ''}${score}</strong></div>
      </a>
    `;
  }).join('');

  page.innerHTML = `
    <div class="insights-page">
      <section class="page-hero">
        <div class="page-hero-inner">
          <div class="home-eyebrow">综合洞察</div>
          <h1 class="page-hero-title">影响-成本矩阵 + 改进 Roadmap</h1>
          <p class="page-hero-desc">基于 ${summary.total} 个分析模块自动生成。优先级 = 影响度 − 实现成本（分数越高越值得做）。</p>
        </div>
      </section>

      <section class="insights-summary-row">
        <div class="summary-card"><div class="num">${summary.borrowStrong}</div><div class="lbl">强烈建议借鉴</div></div>
        <div class="summary-card"><div class="num">${summary.borrow}</div><div class="lbl">可借鉴</div></div>
        <div class="summary-card"><div class="num">${summary.improve}</div><div class="lbl">需改进</div></div>
        <div class="summary-card"><div class="num">${summary.already}</div><div class="lbl">已超越</div></div>
      </section>

      <section class="insights-matrix-section">
        <div class="cap-section-title">影响-成本矩阵 <span class="muted">右上 = 高影响低成本（速胜区）· hover 查看模块</span></div>
        <div class="matrix-grid">
          <span class="matrix-axis-y">影响度 高 →</span>
          <span class="matrix-axis-x">实现成本 低 → 高</span>
          <span class="matrix-quadrant-label" style="top:6px;left:6px">速胜区</span>
          <span class="matrix-quadrant-label" style="top:6px;right:6px">大项目</span>
          <span class="matrix-quadrant-label" style="bottom:6px;left:6px">填充区</span>
          <span class="matrix-quadrant-label" style="bottom:6px;right:6px">避免</span>
          ${matrixDots}
        </div>
      </section>

      <section class="insights-roadmap-section">
        <div class="cap-section-title">${icon('list', 'icon icon-sm')} Top 20 优先级清单</div>
        <div class="roadmap-list">
          ${roadmapItems || '<div class="page-empty">暂无可改进项</div>'}
        </div>
      </section>
    </div>
  `;
}

/* ════════════════════════════════════════
   MODULE CARD (复用)
   ════════════════════════════════════════ */
/* 共享：模块详情 body（截图标注 + 分析卡 + Action Item + 笔记）
   被 module-card 和 dcp-row 共用 */
function renderModuleDetailBody(m) {
  const product = getProduct(m.productId);
  const verdict = getVerdict(m.verdict);
  const userNote = getModuleNote(m.id);

  const annotationsHTML = (m.annotations || []).map(a => `
    <div class="annotation-box" style="left:${a.x}%;top:${a.y}%;width:${a.w}%;height:${a.h}%" title="${a.label}: ${a.note}">
      <span class="annotation-marker">${a.id}</span>
    </div>
  `).join('');

  // v0.4 新增：focusArea 红框（标记该组件在截图里的位置）
  const focusAreaHTML = m.focusArea
    ? `<div class="focus-area" style="left:${m.focusArea.x}%;top:${m.focusArea.y}%;width:${m.focusArea.w}%;height:${m.focusArea.h}%" title="组件焦点区"></div>`
    : '';

  // v0.4 新增：componentTraits 渲染（结构化组件特征）
  const componentTraitsHTML = m.componentTraits
    ? `<div class="component-traits">
        <div class="component-traits-head">
          ${icon('layers', 'icon icon-sm')}
          <span>组件特征</span>
        </div>
        <dl class="component-traits-list">
          ${Object.entries(m.componentTraits).map(([k, v]) => `
            <dt>${k}</dt>
            <dd>${v}</dd>
          `).join('')}
        </dl>
      </div>`
    : '';

  const annotationListHTML = (m.annotations || []).map(a => `
    <div class="annotation-item">
      <span class="num">${a.id}</span>
      <div class="text"><strong>${a.label}</strong><span class="note">${a.note}</span></div>
    </div>
  `).join('');

  const tagsHTML = (m.tags || []).map(([c, t]) => `<span class="tag tag-${c}">${t}</span>`).join('');

  const impactStars = Array.from({length: 5}, (_, i) => `<div class="priority-star ${i < m.impact ? 'filled' : ''}"></div>`).join('');
  const effortStars = Array.from({length: 5}, (_, i) => `<div class="priority-star ${i < m.effort ? 'filled' : ''}"></div>`).join('');

  return `
    <div class="module-actions-bar">
      <div class="module-title-inline">${m.title}</div>
      <div class="module-actions">
        <button class="action-btn" data-copy-link="${m.id}">${icon('link', 'icon icon-sm')} 链接</button>
        <button class="action-btn" data-export-md="${m.id}">${icon('copy', 'icon icon-sm')} 导出 MD</button>
      </div>
    </div>
    <div class="module-body">
      <div class="cards-grid">
        <!-- 卡 1：竞品截图 -->
        <div class="info-card info-card-screenshot">
          <div class="info-card-head">
            ${brandLogo(product, 20)}
            <div class="info-card-title">${product.name}</div>
            <button class="annotation-toggle" data-toggle-anno>${icon('eye', 'icon icon-sm')} <span>隐藏标注</span></button>
          </div>
          <div class="screenshot-container">
            <div class="screenshot-frame" data-screenshot="${m.screenshot}">
              <img src="${getScreenshotUrl(m.screenshot)}" alt="${m.title}" loading="lazy">
              ${focusAreaHTML}
              ${annotationsHTML}
            </div>
          </div>
          <div class="info-card-foot">
            <div class="info-card-label">${product.name} 的做法</div>
            <div class="info-card-text">${m.vsCompetitor}</div>
          </div>
        </div>

        <!-- 卡 2：用户产品截图 -->
        <div class="info-card info-card-screenshot info-card-userprod">
          <div class="info-card-head">
            <span class="userprod-mark">T</span>
            <div class="info-card-title">${upName()} 当前</div>
            <a class="info-card-link" href="../${upHomeUrl()}" target="_blank" rel="noopener">${icon('external-link', 'icon icon-sm')} 打开</a>
          </div>
          <div class="screenshot-container">
            ${(() => {
              const upShot = m.userProductScreenshot || m.tideoScreenshot;
              const dir = upScreenshotDir();
              return `
                <div class="screenshot-frame screenshot-frame-userprod" ${upShot ? `data-screenshot-userprod="${upShot}"` : ''}>
                  ${upShot
                    ? `<img src="assets/${dir}/${upShot}" alt="${upName()} - ${m.title}" loading="lazy" onerror="this.parentElement.classList.add('userprod-img-missing')">
                       <div class="userprod-img-fallback">${icon('alert-circle', 'icon icon-md')}<div>${upName()} 截图待补充<br><code>${upShot}</code></div></div>`
                    : `<div class="userprod-img-fallback">${icon('alert-circle', 'icon icon-md')}<div>该模块未配置 ${upName()} 截图</div></div>`}
                </div>
              `;
            })()}
          </div>
          <div class="info-card-foot">
            <div class="info-card-label">${upName()} 当前做法</div>
            <div class="info-card-text">${m.userProductDoing || m.vsTideo}</div>
          </div>
        </div>

        <!-- 卡 3：交互观察 + 标注 -->
        <div class="info-card info-card-observation">
          <div class="info-card-head info-card-head-simple">
            ${icon('book-open', 'icon icon-sm')}
            <div class="info-card-title">交互观察</div>
          </div>
          <div class="info-card-body">
            <div class="info-card-prose">${m.observation}</div>
            ${componentTraitsHTML}
            ${tagsHTML ? `<div class="tag-row">${tagsHTML}</div>` : ''}
            ${m.annotations && m.annotations.length > 0 ? `
              <div class="annotation-list-inline">
                <div class="info-card-sub-label">标注详解（${m.annotations.length}）</div>
                ${annotationListHTML}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- 卡 4：对 ${upName()} 启发 + 优先级 + Action -->
        <div class="info-card info-card-insight">
          <div class="info-card-head info-card-head-simple">
            ${icon('sparkles', 'icon icon-sm')}
            <div class="info-card-title">对 ${upName()} 启发</div>
          </div>
          <div class="info-card-body">
            <div class="info-card-prose">${m.compare}</div>
            <div class="priority-row">
              <div class="priority-cell">
                <div class="priority-cell-label">影响度 ${m.impact}/5</div>
                <div class="priority-stars">${impactStars}</div>
              </div>
              <div class="priority-cell">
                <div class="priority-cell-label">实现成本 ${m.effort}/5</div>
                <div class="priority-stars">${effortStars}</div>
              </div>
            </div>
            ${m.actionItem ? `
              <div class="action-item">
                <span class="label">Action Item</span>
                ${m.actionItem}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- 卡 5：笔记 - 全宽独立 -->
        <div class="info-card info-card-notes">
          <div class="info-card-head info-card-head-simple">
            ${icon('edit-3', 'icon icon-sm')}
            <div class="info-card-title">我的笔记</div>
          </div>
          <div class="info-card-body">
            <textarea data-note-id="${m.id}" placeholder="添加你的笔记 / 疑问 / 讨论...">${userNote}</textarea>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderModuleCard(m, showProduct = false) {
  const product = getProduct(m.productId);
  const dimension = getDimension(m.dimensionId);
  const verdict = getVerdict(m.verdict);
  const userNote = getModuleNote(m.id);
  const score = m.impact - m.effort;

  return `
    <div class="module-card" id="module-${m.id}" data-module-id="${m.id}" data-dim="${m.dimensionId}">
      <button class="module-summary" data-toggle-module>
        <img class="module-thumb" src="${getScreenshotUrl(m.screenshot)}" alt="" loading="lazy">
        <div class="module-summary-text">
          <div class="module-summary-title">
            ${showProduct ? `<span class="module-prod-tag">${brandLogo(product, 18)} ${product.name}</span>` : ''}
            <span class="module-summary-name">${m.title}</span>
          </div>
          <div class="module-summary-meta">
            <span class="dimension-badge">${icon(dimension.iconId, 'icon icon-sm')} ${dimension.name}</span>
            <span class="module-num">${m.id}</span>
            ${userNote ? `<span class="note-indicator" title="有笔记">${icon('pencil', 'icon icon-sm')}</span>` : ''}
          </div>
        </div>
        <span class="verdict-badge verdict-${m.verdict}">${verdict.label}</span>
        <span class="module-score" title="影响 ${m.impact} − 成本 ${m.effort}">
          <span class="score-num">${score > 0 ? '+' : ''}${score}</span>
        </span>
        <span class="module-chevron">${icon('chevron-right', 'icon icon-sm')}</span>
      </button>
      <div class="module-detail" hidden>
        ${renderModuleDetailBody(m)}
      </div>
    </div>
  `;
}

/* ── Bind Module Events ── */
function bindModuleEvents() {
  document.querySelectorAll('[data-toggle-module]').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.module-card');
      const detail = card.querySelector('.module-detail');
      const isOpen = !detail.hidden;
      detail.hidden = isOpen;
      card.classList.toggle('open', !isOpen);
    });
  });

  // 维度页 · 对比+下钻行 toggle
  document.querySelectorAll('[data-toggle-dcp]').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.dcp-row');
      const detail = row.querySelector('.dcp-detail');
      const isOpen = !detail.hidden;
      detail.hidden = isOpen;
      row.classList.toggle('open', !isOpen);
    });
  });

  // 维度页 · 全部展开/折叠
  const expandAll = document.getElementById('dcp-expand-all');
  const collapseAll = document.getElementById('dcp-collapse-all');
  if (expandAll) {
    expandAll.addEventListener('click', () => {
      document.querySelectorAll('.dcp-row').forEach(row => {
        row.querySelector('.dcp-detail').hidden = false;
        row.classList.add('open');
      });
    });
  }
  if (collapseAll) {
    collapseAll.addEventListener('click', () => {
      document.querySelectorAll('.dcp-row').forEach(row => {
        row.querySelector('.dcp-detail').hidden = true;
        row.classList.remove('open');
      });
    });
  }

  document.querySelectorAll('[data-screenshot]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.annotation-box')) return;
      const file = el.dataset.screenshot;
      document.getElementById('lightbox-img').src = getScreenshotUrl(file);
      document.getElementById('lightbox').classList.add('open');
    });
  });

  // 用户产品截图也支持 lightbox
  document.querySelectorAll('[data-screenshot-userprod]').forEach(el => {
    el.addEventListener('click', () => {
      const file = el.dataset.screenshotUserprod;
      document.getElementById('lightbox-img').src = 'assets/' + upScreenshotDir() + '/' + file;
      document.getElementById('lightbox').classList.add('open');
    });
  });

  document.querySelectorAll('[data-toggle-anno]').forEach(btn => {
    btn.addEventListener('click', () => {
      // 找到当前截图卡（按钮在 head 里，截图也在同一个 info-card 内）
      const side = btn.closest('.info-card');
      if (!side) return;
      const frame = side.querySelector('.screenshot-frame');
      if (!frame) return;
      const isHidden = frame.classList.toggle('annotations-hidden');
      const span = btn.querySelector('span');
      const useEl = btn.querySelector('use');
      if (span) span.textContent = isHidden ? '显示标注' : '隐藏标注';
      if (useEl) useEl.setAttribute('href', isHidden ? '#i-eye-off' : '#i-eye');
    });
  });

  document.querySelectorAll('[data-note-id]').forEach(ta => {
    let timer;
    ta.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setModuleNote(ta.dataset.noteId, ta.value);
      }, 400);
    });
  });

  document.querySelectorAll('[data-copy-link]').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = `${location.origin}${location.pathname}#module-${btn.dataset.copyLink}`;
      navigator.clipboard.writeText(url);
      const orig = btn.innerHTML;
      btn.innerHTML = `${icon('check', 'icon icon-sm')} 已复制`;
      setTimeout(() => { btn.innerHTML = orig; }, 1500);
    });
  });

  document.querySelectorAll('[data-export-md]').forEach(btn => {
    btn.addEventListener('click', () => {
      const moduleId = btn.dataset.exportMd;
      const m = DATA.modules.find(x => x.id === moduleId);
      if (!m) return;
      const product = getProduct(m.productId);
      const dim = getDimension(m.dimensionId);
      const verdict = getVerdict(m.verdict);
      const md = `## ${product.name} · ${m.title}

**维度**: ${dim.name}
**结论**: ${verdict.label}
**影响度**: ${'■'.repeat(m.impact)}${'□'.repeat(5-m.impact)} (${m.impact}/5)
**实现成本**: ${'■'.repeat(m.effort)}${'□'.repeat(5-m.effort)} (${m.effort}/5)
**性价比**: ${m.impact - m.effort > 0 ? '+' : ''}${m.impact - m.effort}

### 交互观察
${m.observation.replace(/<[^>]+>/g, '')}

### vs ${upName()}
- ${product.name}: ${m.vsCompetitor}
- ${upName()}: ${m.userProductDoing || m.vsTideo}

### Action Item
\`\`\`
${m.actionItem || '(无)'}
\`\`\`
`;
      navigator.clipboard.writeText(md);
      const orig = btn.innerHTML;
      btn.innerHTML = `${icon('check', 'icon icon-sm')} 已复制 MD`;
      setTimeout(() => { btn.innerHTML = orig; }, 1500);
    });
  });

  // 表格行 / 矩阵点 / roadmap 点击 → 跳到产品页 + 展开模块
  document.querySelectorAll('[data-jump-module]').forEach(el => {
    el.addEventListener('click', (e) => {
      const moduleId = el.dataset.jumpModule;
      const inPageTarget = document.getElementById('module-' + moduleId);
      if (inPageTarget) {
        e.preventDefault();
        // module-card 形态
        const summary = inPageTarget.querySelector('[data-toggle-module]');
        if (summary && inPageTarget.querySelector('.module-detail').hidden) summary.click();
        // dcp-row 形态
        const dcpSummary = inPageTarget.querySelector('[data-toggle-dcp]');
        if (dcpSummary && inPageTarget.querySelector('.dcp-detail').hidden) dcpSummary.click();
        inPageTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      // 否则跳到对应产品页
      const m = DATA.modules.find(x => x.id === moduleId);
      if (m) {
        e.preventDefault();
        location.hash = `#/product/${m.productId}`;
        setTimeout(() => {
          const target = document.getElementById('module-' + moduleId);
          if (target) {
            const s = target.querySelector('[data-toggle-module]');
            if (s) s.click();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 300);
      }
    });
  });
}

/* ════════════════════════════════════════
   INIT
   ════════════════════════════════════════ */
async function init() {
  // Sprite: 已内联在 HTML 中就跳过 fetch
  const hasInlineSprite = document.querySelector('svg symbol#i-search, svg symbol[id^=i-]');
  if (!hasInlineSprite) {
    try {
      const spriteResp = await fetch('assets/icons/sprite.svg');
      const spriteText = await spriteResp.text();
      const div = document.createElement('div');
      div.innerHTML = spriteText;
      div.style.display = 'none';
      document.body.insertBefore(div, document.body.firstChild);
    } catch (err) {
      console.warn('Sprite load failed:', err);
    }
  }

  // Data: 优先读注入的 window.__ANALYSIS_DATA__（支持 file:// 直接打开）
  // fallback 到 fetch（开发模式）
  try {
    if (window.__ANALYSIS_DATA__) {
      DATA = window.__ANALYSIS_DATA__;
    } else {
      const resp = await fetch('analysis-data.json');
      DATA = await resp.json();
    }
  } catch (err) {
    document.getElementById('page').innerHTML = `<div class="page-empty">数据加载失败：${err.message}</div>`;
    return;
  }

  // 数据规范化（补全缺失字段、清洗非法值，避免运行时崩溃）
  const warnings = normalizeData(DATA);
  if (warnings.length > 0) {
    console.warn('[analysis] 数据规范化警告（已自动修复）:');
    warnings.forEach(w => console.warn('  •', w));
  }

  // Bind global UI
  bindJumpMenu();

  // Lightbox
  document.getElementById('lightbox').addEventListener('click', () => {
    document.getElementById('lightbox').classList.remove('open');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.getElementById('lightbox').classList.remove('open');
  });

  // Router（带错误边界：单页渲染崩溃不拖垮全站）
  const safeRoute = () => {
    try {
      handleRoute();
    } catch (err) {
      console.error('[analysis] 页面渲染出错:', err);
      document.getElementById('page').innerHTML = `
        <div class="page-empty">
          <h3 style="margin-bottom:12px">⚠️ 页面渲染出错</h3>
          <p style="color:var(--text-muted);font-size:13px;line-height:1.6;margin-bottom:16px">
            当前路由：<code>${location.hash || '#/'}</code><br>
            错误：<code>${err.message}</code>
          </p>
          <p style="color:var(--text-muted);font-size:12px">
            通常原因：analysis-data.json 里某个 module 的 productId / dimensionId 引用了不存在的 id。<br>
            请检查浏览器 Console 看详细栈，或在生成站点前跑 <code>node scripts/validate-data.js</code>。
          </p>
          <a href="#/" style="display:inline-block;margin-top:16px;color:var(--accent)">返回首页</a>
        </div>
      `;
    }
  };
  window.addEventListener('hashchange', safeRoute);
  safeRoute();
}

/**
 * 数据规范化：在 DATA 上就地修改，补全缺失字段、清洗非法值
 * 返回警告列表（告诉用户自动修了哪些）
 */
function normalizeData(d) {
  const warnings = [];
  if (!d.meta) d.meta = {};
  if (!d.meta.userProduct) {
    d.meta.userProduct = { name: 'Our Product', monogram: 'O', homeUrl: '#', screenshotDir: 'user-screenshots' };
    warnings.push('meta.userProduct 缺失，用默认值');
  } else {
    const up = d.meta.userProduct;
    if (!up.name) { up.name = 'Our Product'; warnings.push('meta.userProduct.name 缺失'); }
    if (!up.monogram) up.monogram = up.name.charAt(0).toUpperCase();
    if (!up.screenshotDir) up.screenshotDir = 'user-screenshots';
    if (!up.homeUrl) up.homeUrl = '#';
  }
  if (!Array.isArray(d.meta.dimensions)) { d.meta.dimensions = []; warnings.push('meta.dimensions 非数组，置空'); }
  if (!Array.isArray(d.meta.verdicts)) {
    d.meta.verdicts = [
      { id: 'borrow-strong', label: '强烈建议借鉴', color: '#15803d', bg: '#bbf7d0', priority: 5 },
      { id: 'borrow', label: '可借鉴', color: '#15803d', bg: '#dcfce7', priority: 3 },
      { id: 'improve', label: '需改进', color: '#991b1b', bg: '#fee2e2', priority: 4 },
      { id: 'already', label: '已超越', color: '#92400e', bg: '#fef3c7', priority: 1 },
      { id: 'not-applicable', label: '不适用', color: '#64748b', bg: '#f1f5f9', priority: 0 },
    ];
    warnings.push('meta.verdicts 缺失，用默认 5 个');
  }

  // products 规范化
  if (!Array.isArray(d.products)) d.products = [];
  d.products.forEach((p, i) => {
    if (!p.id) { p.id = `product-${i}`; warnings.push(`products[${i}].id 缺失，生成临时 id`); }
    if (!p.name) p.name = p.id;
    if (!p.icon) p.icon = (p.monogram || p.name.charAt(0)).toUpperCase();
    if (!p.color) p.color = '#6366f1';
    if (!p.category) p.category = 'other';
    if (!p.status) p.status = 'ready';
    if (!Array.isArray(p.tags)) p.tags = [];
    // v0.3：根据 competitorType 自动推导 tier
    // competitorType: 'product' → 产品型竞品 / 'feature' → 功能型竞品 / undefined → 看 tier 原有值
    if (p.competitorType === 'feature') {
      if (!p.tier) p.tier = 'feature-competitor';
      if (!p.tierLabel) p.tierLabel = '功能型竞品';
    } else if (p.competitorType === 'product') {
      if (!p.tier) p.tier = 'competitor';
      if (!p.tierLabel) p.tierLabel = '产品型竞品';
    }
    if (!p.tier) p.tier = 'competitor';
    if (!p.tierLabel) p.tierLabel = '竞品';
    if (!p.desc) p.desc = '';
    if (!Array.isArray(p.targetModules)) p.targetModules = [];
  });

  // modules 规范化
  if (!Array.isArray(d.modules)) d.modules = [];
  const validProductIds = new Set(d.products.map(p => p.id));
  const validDimIds = new Set(d.meta.dimensions.map(dim => dim.id));
  d.modules.forEach((m, i) => {
    if (!m.id) { m.id = `module-${i}`; warnings.push(`modules[${i}].id 缺失`); }
    if (!m.title) m.title = m.id;
    if (!Array.isArray(m.annotations)) m.annotations = [];
    if (!Array.isArray(m.tags)) m.tags = [];
    // impact/effort 规范化为 1-5 的数字
    m.impact = clampInt(m.impact, 1, 5, 3);
    m.effort = clampInt(m.effort, 1, 5, 3);
    // 引用校验（有问题就打标）
    if (m.productId && !validProductIds.has(m.productId)) {
      warnings.push(`modules[${i}] (${m.id}) 引用了不存在的 productId "${m.productId}"`);
    }
    if (m.dimensionId && !validDimIds.has(m.dimensionId)) {
      warnings.push(`modules[${i}] (${m.id}) 引用了不存在的 dimensionId "${m.dimensionId}"`);
    }
    // 兼容字段：从老 schema 补到新 schema（反向也兼容）
    if (m.userProductDoing && !m.vsTideo) m.vsTideo = m.userProductDoing;
    if (m.userProductScreenshot && !m.tideoScreenshot) m.tideoScreenshot = m.userProductScreenshot;
  });

  return warnings;
}

function clampInt(v, min, max, dflt) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, Math.round(n)));
}

init();
