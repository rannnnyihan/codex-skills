# Notion 示例 Demo（参考）

这里演示"把 Notion 作为用户产品"做一次完整竞品分析的配置。

配置文件对应 skill `templates/` 目录下的 Notion 示例：
- `templates/product-profile.example.json`
- `templates/competitors.example.json`

## 快速体验

```bash
# 进到一个工作目录
mkdir -p ~/Desktop/notion-analysis && cd ~/Desktop/notion-analysis
mkdir -p work site

# 准备产品画像（从 templates 拷贝）
cp <skill>/templates/product-profile.example.json work/product-profile.json

# 准备竞品清单（从 templates 拷贝，8 个竞品：5 产品型 + 3 功能型）
cp <skill>/templates/competitors.example.json work/competitors.json

# URL 预检（会在 work/ 产出 vet-report.json 和 vet-screenshots/）
<skill>/scripts/step2-vet-competitors.js \
  --competitors work/competitors.json \
  --out work/vet-report.json

# 按预检结果调整 competitors.json 之后，跑批量截图
<skill>/scripts/step3-capture-all.js \
  --profile work/product-profile.json \
  --competitors work/competitors.json \
  --out site/assets/screenshots/

# （AI 用 prompts/gap-analysis.md 引导写 work/analysis-data.json）

# 生成独立站点
<skill>/scripts/step5-generate-site.js \
  --data work/analysis-data.json \
  --screenshots site/assets/screenshots/ \
  --out site/ \
  --serve
```

## 竞品配置说明（重要）

`templates/competitors.example.json` 里展示了**两种竞品类型**的写法：

### 产品型（`type: "product"`）

整体对标的同类产品，**截所有模块**。数量 ≥5。

```json
{
  "id": "coda",
  "name": "Coda",
  "type": "product",
  "moduleUrls": {
    "doc-editor": "https://coda.io/product",
    "database": "https://coda.io/product/tables",
    "sidebar": "https://coda.io/",
    "ai-assistant": "https://coda.io/product/ai",
    "comments": "https://coda.io/product"
  }
}
```

### 功能型（`type: "feature"`）

跨行业某个功能的最佳实践，**只截 `targetModules` 列出的模块**。数量 2-4 个。

```json
{
  "id": "google-docs",
  "name": "Google Docs",
  "type": "feature",
  "targetModules": ["doc-editor"],
  "moduleUrls": {
    "doc-editor": "https://docs.google.com/document/u/0/"
  }
}
```

功能型竞品在站点上会以 **橙色 tier pill "功能型竞品"** 标识，与产品型区分。
