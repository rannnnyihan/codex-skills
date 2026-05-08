# CloudBase 后端参考

如果你用 **腾讯云 CloudBase**，可以更简单地部署评审后端。

## 方案 A：直接用云数据库（最快）

前端用官方 SDK `@cloudbase/js-sdk` 直接读写数据库，**完全不需要服务端代码**。

### 1. 创建数据库集合

在 CloudBase 控制台创建集合 `reviews`，结构：
```
{
  _id: string,             // 自动
  storageKey: string,      // 索引
  pageAnnos: object,
  snaps: array,
  snapAnnos: object,
  updatedAt: number,
}
```

### 2. 写自定义 Adapter

```ts
// myCloudBaseAdapter.ts
import cloudbase from '@cloudbase/js-sdk';
import type { SyncAdapter, SyncData, SyncEvent } from 'design-reviewer';

const app = cloudbase.init({ env: 'your-env-id' });
const db = app.database();

export function createCloudBaseAdapter(): SyncAdapter {
  let storageKey = '';
  let user = { nickname: '', color: '' };

  return {
    async init(ctx) {
      storageKey = ctx.storageKey;
      user = ctx.user;
      /* 匿名登录 */
      await app.auth({ persistence: 'local' }).anonymousAuthProvider().signIn();
    },

    async load(): Promise<SyncData> {
      const { data } = await db.collection('reviews')
        .where({ storageKey })
        .limit(1).get();
      if (data.length === 0) {
        return { pageAnnos: {}, snaps: [], snapAnnos: {} };
      }
      const doc = data[0];
      return {
        pageAnnos: doc.pageAnnos || {},
        snaps: doc.snaps || [],
        snapAnnos: doc.snapAnnos || {},
      };
    },

    async push(event: SyncEvent) {
      /* 调用云函数触发 reduce（避免并发冲突） */
      const cbResult = await app.callFunction({
        name: 'applyReviewEvent',
        data: { storageKey, event, by: user.nickname },
      });
      // or 客户端直接 update（简单但可能冲突）
    },

    subscribe(handler) {
      /* CloudBase 自带实时订阅 */
      const watcher = db.collection('reviews')
        .where({ storageKey })
        .watch({
          onChange: (snapshot) => {
            if (snapshot.docs.length) {
              const doc = snapshot.docs[0];
              handler({
                t: 'snapshot',
                data: {
                  pageAnnos: doc.pageAnnos || {},
                  snaps: doc.snaps || [],
                  snapAnnos: doc.snapAnnos || {},
                },
              });
            }
          },
          onError: console.warn,
        });
      return () => watcher.close();
    },
  };
}
```

### 3. 云函数 `applyReviewEvent`（可选，推荐）

```javascript
// cloudfunctions/applyReviewEvent/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async ({ storageKey, event, by }) => {
  // 1. 查数据
  const { data } = await db.collection('reviews')
    .where({ storageKey }).limit(1).get();

  let doc = data[0] || {
    storageKey,
    pageAnnos: {}, snaps: [], snapAnnos: {},
    updatedAt: 0,
  };

  // 2. 应用事件
  applyEvent(doc, event);  // 参考 scf-nodejs/index.js 里的 applyEvent
  doc.updatedAt = Date.now();

  // 3. 写回
  if (data[0]) {
    await db.collection('reviews').doc(data[0]._id).update({
      data: {
        pageAnnos: doc.pageAnnos,
        snaps: doc.snaps,
        snapAnnos: doc.snapAnnos,
        updatedAt: doc.updatedAt,
      },
    });
  } else {
    await db.collection('reviews').add({ data: doc });
  }

  return { success: true };
};
```

### 4. 前端使用

```tsx
import { DesignReviewApp } from './review';
import { createCloudBaseAdapter } from './myCloudBaseAdapter';

<DesignReviewApp
  config={{
    productName: '我的产品',
    storageKey: 'myproduct_v1',
    pages: [...],
    adapter: createCloudBaseAdapter(),
  }}
/>
```

## 优势

- ✅ **天然实时同步**（`watch()` 基于 WebSocket）
- ✅ **零运维**，CloudBase 全托管
- ✅ **权限系统完善**（可以精细到字段级）
- ✅ **免费额度足够**（每月 500MB 存储 + 5 万次调用）

## 参考文档

- https://docs.cloudbase.net/
- https://docs.cloudbase.net/api-reference/webv3/database
