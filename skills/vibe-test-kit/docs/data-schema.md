# 事件格式

所有事件都是统一结构：

```typescript
{
  seq:     number,      // 本 session 内自增序号
  uid:     string,      // 受测者 ID（URL 参数 uid 或匿名）
  test:    string,      // 测试轮次（URL 参数 test）
  session: string,      // 页面 session（uid_timestamp）
  page:    string,      // 页面名（pathname 最后一段）
  type:    string,      // 事件类型（见下表）
  ts:      string,      // ISO 时间戳
  elapsed: number,      // 距页面进入的秒数
  d:       object       // 具体 payload
}
```

## 事件类型（type）

### 自动采集

| type               | d 示例                                                      | 说明                     |
|--------------------|-------------------------------------------------------------|--------------------------|
| `enter`            | `{ url, referrer, screen, viewport }`                       | 页面进入                 |
| `leave`            | `{ duration, scrollDepth, interactions, hesitation }`       | 页面离开（beforeunload） |
| `first_interact`   | `{ how: 'click'|'scroll'|'focus_input', hesitation }`        | 首次交互（犹豫检测）     |
| `click`            | `{ target, text, x, y, action }`                            | 点击（含坐标）           |
| `file_select`      | `{ name, sizeMB, type }`                                    | 选择文件                 |
| `input_enter`      | `{ inputId, length }`                                       | 输入框回车               |
| `focus`            | `{ target }`                                                | 输入框聚焦               |
| `scroll`           | `{ depth }`                                                 | 滚动深度（每增加 10%）   |
| `tab_away`         | `{ elapsed }`                                               | 切走页面                 |
| `tab_back`         | `{ elapsed }`                                               | 切回页面                 |
| `frustration`      | `{ target, repeats, hint }`                                 | 反复点击同一元素         |
| `error`            | `{ msg, file, line }`                                       | JS 错误                  |

### 手动打点

| type                | 调用方式                                                    | 说明                           |
|---------------------|-------------------------------------------------------------|--------------------------------|
| `milestone`         | `VibeTracker.milestone(name, extra)`                        | 业务里程碑（自定义 name）      |
| `phase_start`       | `VibeTracker.phaseStart(name)`                              | 阶段开始                       |
| `phase_end`         | `VibeTracker.phaseEnd(name)`                                | 阶段结束                       |
| `progress`          | `VibeTracker.progress(label, pct)`                          | 通用进度                       |
| `success`           | `VibeTracker.success(name, extra)`                          | 成功事件                       |
| `failure`           | `VibeTracker.failure(name, err)`                            | 失败事件                       |
| `task_complete`     | `VibeTracker.taskComplete(id, label)`                       | 任务完成（对应任务气泡）       |

### 问卷联动（由 survey.js 自动触发）

| type                   | d 示例                                            | 说明                   |
|------------------------|---------------------------------------------------|------------------------|
| `survey_welcome_show`  | `{ config: 'internal_v1' }`                       | 欢迎页展示             |
| `survey_welcome_done`  | `{ config: 'internal_v1' }`                       | 欢迎页点击"开始"       |
| `survey_show`          | `{ checkpoint: 'onboard_ease', type: 'rating' }`  | 微问卷展示             |
| `survey_answer`        | `{ checkpoint, rating / sam, comment? }`          | 微问卷回答             |
| `survey_skip`          | `{ checkpoint }`                                  | 微问卷被跳过           |
| `survey_exit_show`     | `{}`                                              | 总结问卷展示           |
| `survey_exit_submit`   | `{ susScore, susAnswers, ev, nps, npsWhy, words, open1, open2 }` | 总结问卷提交 |

## 典型分析套路

### 1. 完成率漏斗

```javascript
const totalUsers = new Set(events.map(e => e.uid)).size;
const taskCompletes = events.filter(e => e.type === 'task_complete');
const completed = new Set(taskCompletes.map(e => e.uid)).size;
const rate = completed / totalUsers;
```

### 2. 平均犹豫时间

```javascript
const hes = events.filter(e => e.type === 'first_interact');
const avgHes = hes.reduce((s, e) => s + (e.d.hesitation || 0), 0) / hes.length;
```

### 3. 困惑用户

```javascript
const frustrated = events.filter(e => e.type === 'frustration');
const frustratedUsers = new Set(frustrated.map(e => e.uid));
```

### 4. SUS 均分

```javascript
const submits = events.filter(e => e.type === 'survey_exit_submit');
const avgSUS = submits.reduce((s, e) => s + (e.d.susScore || 0), 0) / submits.length;
// >=68 可接受，>=80 优秀
```

### 5. NPS 净推荐值

```javascript
const nps = submits.map(e => e.d.nps).filter(n => typeof n === 'number');
const promoters = nps.filter(n => n >= 9).length;
const detractors = nps.filter(n => n <= 6).length;
const score = (promoters - detractors) / nps.length * 100;
```
