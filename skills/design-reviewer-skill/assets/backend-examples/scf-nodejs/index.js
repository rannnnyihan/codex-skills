/**
 * 设计评审 SCF 云函数后端（Node.js）
 *
 * 支持：
 *   - GET    /reviews/:key               → 返回完整数据
 *   - POST   /reviews/:key/events        → 接收一条变更事件，持久化到 COS
 *   - GET    /reviews/:key/events?since  → 增量拉取（用于轮询同步）
 *
 * 存储：COS
 *   - 主数据：reviews/{key}/data.json
 *   - 事件日志：reviews/{key}/events.json  （仅保留最近 500 条）
 *
 * 配置（通过环境变量）：
 *   COS_SECRET_ID, COS_SECRET_KEY, COS_BUCKET, COS_REGION
 *
 * 使用：触发方式 API 网关，集成方式"集成请求"。
 */
const COS = require('cos-nodejs-sdk-v5');

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY,
});
const BUCKET = process.env.COS_BUCKET;
const REGION = process.env.COS_REGION;

/* ---------- COS helpers ---------- */

async function readJSON(key, fallback) {
  try {
    const resp = await cos.getObject({ Bucket: BUCKET, Region: REGION, Key: key });
    return JSON.parse(resp.Body.toString('utf-8'));
  } catch (err) {
    if (err.statusCode === 404) return fallback;
    throw err;
  }
}

async function writeJSON(key, data) {
  await cos.putObject({
    Bucket: BUCKET, Region: REGION, Key: key,
    Body: JSON.stringify(data),
    ContentType: 'application/json; charset=utf-8',
  });
}

/* ---------- response helpers ---------- */

function ok(data) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(data),
  };
}

function err(status, msg) {
  return {
    statusCode: status,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: msg }),
  };
}

/* ---------- event reducer ---------- */

function applyEvent(data, event) {
  // data: { pageAnnos, snaps, snapAnnos }
  // event: { t, ...fields, by, at }
  switch (event.t) {
    case 'pageAnno:add': {
      const list = data.pageAnnos[event.frameKey] || [];
      if (!list.find(a => a.id === event.data.id)) {
        data.pageAnnos[event.frameKey] = [...list, event.data];
      }
      break;
    }
    case 'pageAnno:update': {
      const list = data.pageAnnos[event.frameKey] || [];
      data.pageAnnos[event.frameKey] = list.map(a =>
        a.id === event.id ? { ...a, ...event.patch } : a);
      break;
    }
    case 'pageAnno:delete': {
      const list = data.pageAnnos[event.frameKey] || [];
      data.pageAnnos[event.frameKey] = list.filter(a => a.id !== event.id);
      break;
    }
    case 'snap:add':
      if (!data.snaps.find(s => s.id === event.data.id)) {
        data.snaps = [event.data, ...data.snaps];
      }
      break;
    case 'snap:delete':
      data.snaps = data.snaps.filter(s => s.id !== event.id);
      delete data.snapAnnos[event.id];
      break;
    case 'snap:updateNote':
      data.snaps = data.snaps.map(s =>
        s.id === event.id ? { ...s, note: event.note } : s);
      break;
    case 'snapAnno:add': {
      const list = data.snapAnnos[event.snapId] || [];
      if (!list.find(a => a.id === event.data.id)) {
        data.snapAnnos[event.snapId] = [...list, event.data];
      }
      break;
    }
    case 'snapAnno:update': {
      const list = data.snapAnnos[event.snapId] || [];
      data.snapAnnos[event.snapId] = list.map(a =>
        a.id === event.id ? { ...a, ...event.patch } : a);
      break;
    }
    case 'snapAnno:delete': {
      const list = data.snapAnnos[event.snapId] || [];
      data.snapAnnos[event.snapId] = list.filter(a => a.id !== event.id);
      break;
    }
  }
  return data;
}

/* ---------- main handler ---------- */

exports.main_handler = async (event, context) => {
  const method = event.httpMethod || 'GET';
  const path = event.path || '';

  // CORS preflight
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    };
  }

  // 解析 /reviews/:key 或 /reviews/:key/events
  const m = path.match(/^\/reviews\/([^/]+)(\/events)?$/);
  if (!m) return err(404, 'not found');
  const key = decodeURIComponent(m[1]);
  const isEvents = !!m[2];

  const dataKey = `reviews/${key}/data.json`;
  const eventsKey = `reviews/${key}/events.json`;

  try {
    /* GET /reviews/:key → 返回主数据 */
    if (method === 'GET' && !isEvents) {
      const data = await readJSON(dataKey, {
        pageAnnos: {}, snaps: [], snapAnnos: {},
      });
      return ok(data);
    }

    /* GET /reviews/:key/events?since=timestamp → 增量 */
    if (method === 'GET' && isEvents) {
      const since = parseInt(event.queryString?.since || '0', 10) || 0;
      const events = await readJSON(eventsKey, []);
      const filtered = events.filter(e => e.at > since).map(e => {
        /* 剥离 by/at 等服务端字段，返回纯事件 */
        const { by, at, ...pureEvent } = e;
        return pureEvent;
      });
      return ok(filtered);
    }

    /* POST /reviews/:key/events → 接收事件 */
    if (method === 'POST' && isEvents) {
      let body = event.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { return err(400, 'invalid json'); }
      }
      if (!body?.t) return err(400, 'missing field: t');

      /* 1. 读主数据，应用事件，写回 */
      const data = await readJSON(dataKey, {
        pageAnnos: {}, snaps: [], snapAnnos: {},
      });
      applyEvent(data, body);
      await writeJSON(dataKey, data);

      /* 2. 追加到事件日志（仅保留最近 500 条） */
      const events = await readJSON(eventsKey, []);
      events.push(body);
      if (events.length > 500) events.splice(0, events.length - 500);
      await writeJSON(eventsKey, events);

      return ok({ success: true });
    }

    return err(405, 'method not allowed');
  } catch (e) {
    console.error('handler error:', e);
    return err(500, e.message || 'internal error');
  }
};
