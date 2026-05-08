# SCF 后端部署指南

本目录提供一份**腾讯云 SCF 云函数（Node.js）**参考实现，配合前端 `createRestAdapter` 就能实现评审数据云端同步。

## 部署步骤

### 1. 准备 COS 存储桶

1. 登录腾讯云控制台 → **对象存储 COS** → 新建存储桶
2. 记下 `Bucket`（如 `my-review-1234567890`）和 `Region`（如 `ap-guangzhou`）
3. 权限建议设为**私有读写**（后端通过 SDK 访问）

### 2. 创建 SCF 云函数

1. 登录 **云函数 SCF** 控制台
2. 新建函数：
   - 创建方式：**从头开始**
   - 函数类型：**事件函数**
   - 运行环境：**Node.js 16.x** 或 Node.js 18.x
   - 触发方式：暂不创建
3. 上传代码：
   ```bash
   cd scf-nodejs
   npm install              # 安装 cos-nodejs-sdk-v5
   zip -r ../function.zip .  # 打包
   ```
   把 `function.zip` 上传到 SCF
4. 配置环境变量（SCF 函数 → 函数配置 → 环境变量）：
   ```
   COS_SECRET_ID    = 你的腾讯云 SecretId
   COS_SECRET_KEY   = 你的腾讯云 SecretKey
   COS_BUCKET       = 你的 COS 桶名（如 my-review-1234567890）
   COS_REGION       = 桶所在地域（如 ap-guangzhou）
   ```
   > 💡 建议在 **CAM 子账号** 下生成只对该 Bucket 有读写权限的 Key

### 3. 配置 API 网关触发器

1. SCF 函数 → **触发管理** → 创建触发器
2. 选择 **API 网关触发**
3. 集成请求：**是**
4. 创建后获取 **访问路径**（如 `https://service-xxxxx-1234567890.gz.apigw.tencentcs.com/release`）

### 4. 前端接入

```tsx
import { DesignReviewApp, createRestAdapter } from './review';

<DesignReviewApp
  config={{
    productName: '我的产品',
    storageKey: 'myproduct_v1',
    pages: [...],
    adapter: createRestAdapter({
      baseUrl: 'https://service-xxxxx.gz.apigw.tencentcs.com/release',
      pollInterval: 10000,  // 每 10 秒轮询一次（实现准实时协作）
    }),
  }}
/>
```

## API 路径说明

| Method | Path | 描述 |
|--------|------|------|
| GET    | `/reviews/:key`            | 拉取完整数据 |
| POST   | `/reviews/:key/events`     | 推送单条变更 |
| GET    | `/reviews/:key/events?since={timestamp}` | 增量拉取（轮询用） |

## 数据存储结构

每个 `storageKey` 对应 COS 下两个文件：

```
reviews/{storageKey}/data.json      ← 主数据（pageAnnos/snaps/snapAnnos）
reviews/{storageKey}/events.json    ← 事件日志（最多 500 条）
```

## 常见问题

**Q: 读取 data.json 返回 404？**
A: 正常，第一次还没有数据。前端会拿到空对象继续使用。

**Q: 怎么删除一个评审项目？**
A: 直接在 COS 控制台删除对应 `reviews/{key}/` 前缀下的所有文件。

**Q: 性能怎么样？**
A: 冷启动 < 1s，稳态响应 < 200ms。数据量大时（> 10MB）建议拆分 storageKey。

**Q: 可以加鉴权吗？**
A: 可以，在 `index.js` 的 `main_handler` 开头添加：
```js
const auth = event.headers?.authorization;
if (auth !== `Bearer ${process.env.API_KEY}`) return err(401, 'unauthorized');
```
前端 Adapter 传 headers：
```js
createRestAdapter({
  baseUrl: '...',
  headers: { Authorization: `Bearer your-api-key` },
})
```

## 费用估算

- **SCF**：免费额度每月 100 万次调用 + 40 万 GB·秒，评审场景远远用不完
- **COS**：存储 0.02 元/GB/月，调用 0.01 元/万次
- **一个小团队 30 人用一个月大约** ¥0~2

💡 **不想折腾 SCF？** 可以用 **腾讯云 CloudBase**，它自带 REST 云函数和数据库，部署更简单。见 `../cloudbase/` 目录。
