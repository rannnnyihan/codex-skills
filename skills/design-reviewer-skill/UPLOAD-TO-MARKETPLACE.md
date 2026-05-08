# 📤 投稿到 CodeBuddy Skills Marketplace

## 目标仓库

**腾讯内部 Git**: https://cnb.woa.com/genie/skill-marketplace

投稿成功后，所有 CodeBuddy 内部用户都能在技能市场看到并一键安装 **design-reviewer**。

---

## 📦 投稿包位置

```
/tmp/design-reviewer-submission/
└── design-reviewer/
    ├── SKILL.md
    └── assets/react-tool/
        ├── README.md
        ├── INTEGRATION.md
        └── src/  (React 源码)
```

同时本地 skill 目录也是完整的（可以直接用）：
```
~/.codebuddy/skills/design-review/
```

---

## 🚀 投稿步骤

### 1. Clone 官方仓库

```bash
cd ~/Desktop  # 或任意工作目录
git clone https://cnb.woa.com/genie/skill-marketplace.git
cd skill-marketplace
```

### 2. 切到日间分支（白天投稿必须用 daywork 分支）

```bash
# 白天（早 9 点~晚 9 点）
DATE=$(date +%Y-%m-%d)
git checkout -b daywork/$DATE origin/main || git checkout daywork/$DATE

# 晚上 9 点后可以直接基于 main
git checkout main && git pull
```

### 3. 复制投稿包到仓库

```bash
cp -r /tmp/design-reviewer-submission/design-reviewer  skills/
```

### 4. 更新 marketplace.json

编辑 `.codebuddy-skill/marketplace.json`，在 `"skills"` 数组里**按字母顺序**插入：

```json
{
  "name": "design-reviewer",
  "description": "Embed a complete design review tool (page annotations + snapshot annotations + JSON export) into any React project. Use when user says 导入评审工具, 集成 design review, 评审工具, 给页面加标注, 添加评论功能, 做设计评审, design reviewer, review tool, annotation tool.",
  "description_zh": "给 React 项目嵌入设计评审工具，支持页面与快照标注",
  "description_en": "Embed a design review tool into React apps with page & snapshot annotations",
  "source": "design-reviewer"
}
```

建议插入位置：在 `design-` 开头的 skill 之间（按字母排序）。

### 5. 验证 JSON 有效性

```bash
jq . .codebuddy-skill/marketplace.json > /dev/null && echo "JSON OK" || echo "JSON ERROR"
```

### 6. Commit & Push

```bash
git add skills/design-reviewer .codebuddy-skill/marketplace.json
git commit -m "feat(design-reviewer): add React design review tool skill

- 嵌入式 React 设计评审组件
- 支持页面标注（CSS selector）+ 快照标注（坐标）
- 双空间隔离，零后端依赖
- 本地 localStorage 持久化 + JSON 导出"

git push origin daywork/$DATE   # 或 main（如果晚上 9 点后）
```

### 7. 创建 Merge Request

在浏览器打开：
```
https://cnb.woa.com/genie/skill-marketplace/-/merge_requests/new
```

- **源分支**: `daywork/<YYYY-MM-DD>`
- **目标分支**: `main`
- **标题**: `feat: add design-reviewer skill`
- **描述**: 简述 skill 的核心功能 + 使用场景 + 截图（如有）

### 8. 等待审核

- skill 会经过 **朱雀实验室安全扫描** + **云鼎实验室合规审计**
- 一般 1-3 个工作日内审核完毕
- 审核通过后自动同步到所有 CodeBuddy 用户的 skills-marketplace

---

## ✅ 投稿后效果

合入后，所有 CodeBuddy 用户在任何项目里说：
- "给我的项目加评审工具"
- "导入 design reviewer"
- "做设计评审"

AI 会**自动识别并调用这个 skill**，按 SKILL.md 里的流程把源码集成到用户项目。

---

## 🔄 未来更新

修复 bug / 加新功能后：
1. 更新 `~/.codebuddy/skills/design-review/` 下的源码
2. 更新 `SKILL.md` frontmatter 里的 `version` 号（如 `1.0.0` → `1.1.0`）
3. 同样流程 push + MR

---

## ❓ 遇到问题

| 问题 | 解决 |
|---|---|
| 推不上去（权限） | 申请 `cnb.woa.com/genie/skill-marketplace` 的 Developer 权限 |
| JSON 格式错误 | `jq . marketplace.json` 验证 |
| 白天能推 main 吗 | **不能**，规范强制要求走 daywork 分支 |
| 怎么测试 skill 是否生效 | 本地复制到 `~/.codebuddy/skills/` 下重启 CodeBuddy 即可 |
| 和现有的 `design-review` 重名 | 我们改名为 `design-reviewer`（er 结尾）以示区分 |

---

## 🎁 附加：如果不想走官方流程

也可以走**非官方分享**的三条路径：

1. **团队内部 CNB 仓库**：把 `design-reviewer` 单独建一个内部 Git 仓库，同事 clone 到本地 `~/.codebuddy/skills/`
2. **直接发 .zip**：`~/.codebuddy/skills/design-review.zip` 发微信/邮件，同事解压到 skills 目录
3. **云盘共享**：腾讯文档/企业微信共享 zip 文件，团队成员自行下载

都是立即可用，只是不能出现在官方市场列表里。
