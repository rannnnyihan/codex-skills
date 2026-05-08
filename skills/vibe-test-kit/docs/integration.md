# 接入指南

## 前提

- 你的项目是一个 Web 应用（React / Vue / 原生 HTML 都可以）
- 能在 `<head>` 或 `<body>` 末尾插入 `<script>` 标签
- （可选）有一个能接收 POST JSON 的后端 endpoint 来收集事件

## 最小接入（3 分钟）

### Step 1：拷贝 `src/` 到你的项目

```bash
cp -r vibe-test-kit/src your-project/public/vibe-test-kit/
```

### Step 2：在 HTML 里引入

在所有需要被采集的页面的底部，加上：

```html
<script src="/vibe-test-kit/survey.config.js"></script>
<script src="/vibe-test-kit/tracker.js"
        data-endpoint="https://your-server/api/track"></script>
<script src="/vibe-test-kit/survey.js"></script>
```

**注意**：

- `tracker.js` 必须在 `survey.js` 之前（survey 依赖 tracker）
- `data-endpoint` 可选。不填则只落 `localStorage`（开发调试用）
- `survey.config.js` 可选。不引用则 survey 引擎静默（因为没有 checkpoints 配置）

### Step 3：在业务代码里打点

在你的业务代码的关键节点调用：

```javascript
// 任务开始（比如用户点击"开始使用"按钮）
VibeTracker.milestone('task_started');

// 某个耗时阶段开始（比如"等待 AI 生成"）— 问卷引擎会在 30s 后弹 SAM 量表
VibeTracker.phaseStart('processing');

// 结果呈现（比如"显示生成的内容"）— 问卷引擎会弹 result_sam 量表
VibeTracker.milestone('view_result');

// 用户主动编辑 / 调整
VibeTracker.milestone('task_edit');

// 任务彻底完成（对应配置里 tasks 的 detect）
VibeTracker.taskComplete('T1', '完成首个任务');
```

## 配置问卷内容

默认配置在 `src/survey.config.js`，是纯占位通用版。你通常需要替换为自己业务的用语：

```javascript
window.VIBE_SURVEY_CONFIG = {
    exitSurvey: {
        productName: 'YourProduct',   // SUS/EV 里的 {product} 会替换成这个
        // ...
    },
    tasks: {
        internal: [
            { id: 'T1', label: '搜索一本你想读的书', detect: 'task_1_done' },
            { id: 'T2', label: '添加一本书到想读列表', detect: 'task_2_done' },
            { id: 'T3', label: '完成一次阅读打卡', detect: 'task_3_done' }
        ]
    },
    checkpoints: {
        internal: [
            {
                id: 'search_ease',
                trigger: 'search_done',          // 等 VibeTracker.milestone('search_done') 触发
                delay: 1500,
                type: 'rating',
                question: '刚才搜索顺利吗？',
                scale: 5,
                labels: ['很困难', '有点绕', '还行', '比较顺', '一下就找到了'],
                allowComment: true,
                commentPH: '在哪卡住过？'
            }
        ]
    }
};
```

**trigger 匹配规则**（survey.js 内部）：

- 任何 `VibeTracker.record(type, detail)` 调用都会触发 `triggerCheckpoint(type)`
- `VibeTracker.milestone(name)` 会触发 `triggerCheckpoint(name)`
- `click` 事件如果有 `detail.action`，也会以 `action` 作为 trigger

所以你在 config 里写 `trigger: 'search_done'`，在业务代码里 `VibeTracker.milestone('search_done')` 就能触发。

## 后端接收事件

`tracker.js` 以 POST JSON 形式发送：

```json
POST /api/track
{
  "events": [
    {
      "seq": 1,
      "uid": "tester_01",
      "test": "round1",
      "session": "...",
      "page": "home.html",
      "type": "click",
      "ts": "2026-04-23T10:00:00Z",
      "elapsed": 8,
      "d": { "target": "#btn", "x": 45, "y": 60, "action": "start" }
    }
  ]
}
```

后端需要：

1. 接收并存储（数据库 / 文件 / 对象存储都行）
2. 提供一个查询 endpoint 返回：
   ```json
   { "ok": true, "data": { "events": [...] } }
   ```
   供 dashboard 拉取

最简单的实现：一个腾讯云 SCF + COS 即可支撑。

## 分发测试链接

打开 `dashboard/index.html`：

1. 填入"目标 URL"（你产品的入口页）
2. 填轮次名、用户数
3. 勾选想启用的情境问卷节点
4. 点"生成链接" → 复制分发给受测者

受测者点开链接，会自动跳到你的产品页，并激活欢迎页 → 任务气泡 → 问卷。

## 查看数据

dashboard 的 Step 2：

- **模拟数据**：看演示效果
- **本地 localStorage**：查看当前浏览器里 tracker 落的事件
- **真实 API**：填你的查询 endpoint

## 常见问题

**Q: 不想用问卷，只想埋点？**
A: 不引用 `survey.config.js` 和 `survey.js` 即可，只保留 `tracker.js`。

**Q: 我的项目是 SPA，路由变化不重新加载页面**
A: tracker 以页面为单位建立 session。SPA 路由切换时，手动调用：
   ```javascript
   VibeTracker.record('enter', { url: location.href });
   ```

**Q: 想禁用本地 localStorage 备份？**
A: 找 `tracker.js` 里 `localStorage.setItem` 那段，删掉即可。

**Q: 如何重置状态？**
A: `localStorage.removeItem('vibe_track_all')` 清空事件，`sessionStorage.clear()` 清空问卷状态。
