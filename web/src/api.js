// 接口封装
// - 正常部署：请求后端 /api
// - GitHub Pages 演示版（VITE_STATIC=1）：在浏览器内运行同一套业务逻辑，修改保存在本浏览器
import { ref } from 'vue';

export const IS_STATIC = import.meta.env.VITE_STATIC === '1';

export const operator = ref(readOperator());
function readOperator() { try { return localStorage.getItem('operator') || ''; } catch { return ''; } }
export function setOperator(name) {
  operator.value = name;
  try { localStorage.setItem('operator', name); } catch { /* 隐私模式下忽略 */ }
}
const opName = () => operator.value || (IS_STATIC ? '演示用户' : '系统用户');

// ---------- 演示版：浏览器内路由 ----------
let local = null;
async function localService() {
  if (!local) {
    local = (async () => {
      const [{ createService }, store] = await Promise.all([import('../../shared/service.js'), import('./static/localStore.js')]);
      const info = await store.initLocalStore(`${import.meta.env.BASE_URL}data/parcels.json`);
      const svc = createService(store.localStore);
      if (info.fresh) {
        store.localStore.changes.add({ at: new Date().toISOString(), target: 'parcel', target_id: null, summary: `载入 ${info.source}：${store.localStore.parcels.all().length} 个地块`, operator: '系统导入', basis: info.source });
        svc.recalc('数据导入');
      }
      return { svc, store };
    })();
  }
  return local;
}

const ROUTES = [
  ['GET', /^\/api\/parcels$/, (s) => s.listParcels()],
  ['GET', /^\/api\/parcels\/(\d+)$/, (s, [id]) => s.getParcel(id)],
  ['PATCH', /^\/api\/parcels\/(\d+)$/, (s, [id], b) => s.patchParcel(id, b, opName())],
  ['GET', /^\/api\/stats$/, (s) => s.stats()],
  ['GET', /^\/api\/rules$/, (s) => s.getRules()],
  ['PUT', /^\/api\/rules$/, (s, _, b) => s.putRules(b, opName())],
  ['POST', /^\/api\/recalc$/, (s) => s.recalc('手动全量重算').counts],
  ['GET', /^\/api\/snapshots$/, (s) => s.listSnapshots()],
  ['GET', /^\/api\/snapshots\/(\d+)$/, (s, [id]) => s.getSnapshot(id)],
  ['GET', /^\/api\/edges$/, (s) => s.listEdges()],
  ['POST', /^\/api\/edges$/, (s, _, b) => s.createEdge(b, opName())],
  ['POST', /^\/api\/edges\/import$/, (s, _, b) => s.importEdges(b, opName())],
  ['PATCH', /^\/api\/edges\/(\d+)$/, (s, [id], b) => s.patchEdge(id, b, opName())],
  ['DELETE', /^\/api\/edges\/(\d+)$/, (s, [id]) => s.deleteEdge(id, opName())],
  ['GET', /^\/api\/projects$/, (s) => s.listProjects()],
  ['POST', /^\/api\/projects$/, (s, _, b) => s.createProject(b, opName())],
  ['PATCH', /^\/api\/projects\/(\d+)$/, (s, [id], b) => s.patchProject(id, b, opName())],
  ['GET', /^\/api\/changes$/, (s, _, __, q) => s.listChanges(q.limit || 100)],
  ['GET', /^\/api\/sources$/, (s) => s.sources()]
];

async function localRequest(method, url, body) {
  const { svc } = await localService();
  const u = new URL(url, 'http://local');
  const q = Object.fromEntries(u.searchParams);
  for (const [m, re, fn] of ROUTES) {
    const hit = m === method && u.pathname.match(re);
    if (hit) return JSON.parse(JSON.stringify(fn(svc, hit.slice(1), body ? JSON.parse(JSON.stringify(body)) : {}, q)));
  }
  throw new Error(`演示版不支持：${method} ${u.pathname}`);
}

// ---------- 通用 ----------
async function request(method, url, body) {
  if (IS_STATIC) return localRequest(method, url, body);
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-operator': encodeURIComponent(opName()) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败（${res.status}）`);
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
  patch: (url, body) => request('PATCH', url, body),
  put: (url, body) => request('PUT', url, body),
  del: (url) => request('DELETE', url)
};

export function saveBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// 导出地块清单：query 为 {cls:'gwy,ywj'} 或 {ids:'1,2,3'}
export async function downloadCsv(query) {
  if (IS_STATIC) {
    const { svc } = await localService();
    const { filename, text } = svc.exportCsv(query);
    saveBlob(new Blob([text], { type: 'text/csv;charset=utf-8' }), filename);
    return;
  }
  const qs = new URLSearchParams(query).toString();
  const a = document.createElement('a');
  a.href = `/api/export/parcels.csv?${qs}`;
  a.click();
}

// 演示版：清除本浏览器中的全部修改
export async function resetDemo() {
  const { store } = await localService();
  store.resetLocalStore();
  local = null;
}

// 低效类型配色与名称（与原型设计语言一致）
export const CLASSES = {
  gwy: { name: '供而未用', short: '①', color: '#F29B4B', desc: '已供未开工 · 看权利人' },
  ywj: { name: '用而未尽', short: '②', color: '#7A6CF0', desc: '已开工未建完 · 看剩余' },
  jjyb: { name: '金角银边', short: '③', color: '#2BB5A0', desc: '边角零星地 · 看去向' },
  qydx: { name: '企业低效', short: '④', color: '#EF6B73', desc: '亩均效益低 · 看整改' }
};

export const fmt = {
  n: (v, d = 0) => (v == null || Number.isNaN(v) ? '—' : Number(v).toLocaleString('zh-CN', { maximumFractionDigits: d, minimumFractionDigits: 0 })),
  date: (s) => (s ? String(s).slice(0, 10) : '—'),
  time: (s) => (s ? new Date(s).toLocaleString('zh-CN', { hour12: false }) : '—')
};
