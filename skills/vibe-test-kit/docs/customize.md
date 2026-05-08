# 自定义任务与问卷

所有问卷 / 任务 / SUS 题都在 `src/survey.config.js` 里集中管理。

## 完整配置结构

```javascript
window.VIBE_SURVEY_CONFIG = {
    welcome: {
        internal: { title, subtitle, note, estimatedTime,
                    resourceLabel, resourceHref, resourceFilename },
        user: { ... 同上 ... }
    },
    tasks: {
        internal: [ { id, label, hint, detect }, ... ],
        user: [ ... ]
    },
    checkpoints: {
        internal: [ { id, trigger, delay, type, question, ... }, ... ],
        user: [ ... ]
    },
    exitSurvey: {
        productName: 'YourProduct',
        sus: [ 'SUS 题 1', ..., 'SUS 题 10' ],
        ev:  [ 'EV 题 1', ..., 'EV 题 9' ],
        npsEnabled: true,
        openQuestions: [ { id, type, label, ph }, ... ]
    }
}
```

## 自定义任务

任务会以"右下角气泡 + 完成打勾"形式呈现。

```javascript
tasks: {
    internal: [
        {
            id: 'T1',                    // 唯一 id
            label: '你可见的任务描述',
            hint: '（可选）补充提示',
            detect: 'task_1_done'        // 等哪个事件视为完成
        }
    ]
}
```

**`detect` 匹配规则**：

收到任意以下之一，即视为完成：
- `VibeTracker.milestone('task_1_done')`
- `VibeTracker.record('task_1_done', ...)`
- 任何 click 事件里 `detail.action === 'task_1_done'`

所以业务代码里：

```javascript
document.getElementById('btnExport').addEventListener('click', () => {
    // ... 业务逻辑
    VibeTracker.milestone('task_1_done');  // 标记任务完成
});
```

## 自定义情境问卷

### Rating 类型（5 点量表）

```javascript
{
    id: 'search_ease',
    trigger: 'search_done',          // milestone 名
    delay: 1500,                     // 触发后延迟 1.5s 弹出
    type: 'rating',
    question: '刚才搜索顺利吗？',
    scale: 5,
    labels: ['很困难', '有点绕', '还行', '比较顺', '一下就找到了'],
    allowComment: true,
    commentPH: '在哪卡住过？（可选）'
}
```

### SAM 类型（情绪量表，多维度）

```javascript
{
    id: 'wait_sam',
    trigger: 'processing_wait_30s',  // 这是 phase_start 后 30s 的内置触发器
    delay: 500,
    type: 'sam',
    question: '等待处理的这段时间感觉怎样？',
    dims: [
        { id: 'arousal', label: '紧张程度', l: '很放松',   r: '很焦虑' },
        { id: 'valence', label: '心情',     l: '不太好',   r: '挺好的' }
    ]
}
```

SAM 每个维度是 0-9 的滑块，收集到 `survey_answer.d.sam` 对象里。

## 自定义 SUS / EV 题

直接改数组即可，`{product}` 会被替换为 `exitSurvey.productName`：

```javascript
exitSurvey: {
    productName: 'BookReader',
    sus: [
        '我认为我会经常使用 {product}',
        '我觉得 {product} 不必要地复杂',
        // ... 共 10 题
    ],
    ev: [
        '阅读过程让我感到愉悦',
        // ... 共 9 题
    ]
}
```

## 自定义开放题

```javascript
exitSurvey: {
    openQuestions: [
        { id: 'three_words', type: 'words',    label: '用三个词描述使用感受' },
        { id: 'best_part',   type: 'textarea', label: '最喜欢的部分', ph: '请描述…' },
        { id: 'worst_part',  type: 'textarea', label: '最不喜欢的部分', ph: '请描述…' }
    ]
}
```

支持类型：
- `words` — 三个词输入框
- `textarea` — 多行文本

## URL 参数控制开关

dashboard 生成的链接里带有这些参数（也可以手动改）：

| 参数         | 取值            | 作用                                               |
|--------------|-----------------|----------------------------------------------------|
| `smode`      | `test`          | 激活问卷引擎（必填）                               |
| `stype`      | `internal`/`user` | 使用哪套任务/问卷集合                             |
| `swelcome`   | `0`/`1`         | 是否显示欢迎页                                     |
| `stasks`     | `0`/`1`         | 是否显示任务气泡                                   |
| `ssurveys`   | `0`/`1`         | 是否启用情境微问卷                                 |
| `sexit`      | `0`/`1`         | 是否启用总结问卷                                   |
| `scp`        | 逗号分隔的 id   | 仅启用指定的情境节点（如 `onboard_ease,wait_sam`）|
| `uid`        | 任意字符串      | 受测者 ID                                          |
| `test`       | 任意字符串      | 轮次名（用于数据筛选）                             |

## 多个产品共用一套 SDK

一种办法：在不同页面引入不同 config。

```html
<!-- 产品 A 的页面 -->
<script src="/vibe/config-productA.js"></script>
<script src="/vibe/tracker.js"></script>
<script src="/vibe/survey.js"></script>
```

```html
<!-- 产品 B 的页面 -->
<script src="/vibe/config-productB.js"></script>
<script src="/vibe/tracker.js"></script>
<script src="/vibe/survey.js"></script>
```

然后在 dashboard 里用 `test` 轮次名区分数据。
