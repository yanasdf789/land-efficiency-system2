// 低效用地监管系统 API（业务逻辑在 shared/service.js，与浏览器演示版共用）
import express from 'express';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createService, HttpError } from '../shared/service.js';
import { sqliteStore } from './store-sqlite.js';

const svc = createService(sqliteStore);
const app = express();
app.use(express.json({ limit: '10mb' }));
const PORT = Number(process.env.API_PORT || 3001);

const operatorOf = (req) => {
  const h = req.get('x-operator');
  try { return h ? decodeURIComponent(h) : '系统用户'; } catch { return h || '系统用户'; }
};
// 把 service 方法包装成路由处理函数
const h = (fn) => (req, res, next) => {
  try { res.json(fn(req)); } catch (err) { next(err); }
};

app.get('/api/parcels', h(() => svc.listParcels()));
app.get('/api/parcels/:id', h((req) => svc.getParcel(req.params.id)));
app.patch('/api/parcels/:id', h((req) => svc.patchParcel(req.params.id, req.body, operatorOf(req))));
app.get('/api/stats', h(() => svc.stats()));
app.get('/api/rules', h(() => svc.getRules()));
app.put('/api/rules', h((req) => svc.putRules(req.body, operatorOf(req))));
app.post('/api/recalc', h(() => svc.recalc('手动全量重算').counts));
app.get('/api/snapshots', h(() => svc.listSnapshots()));
app.get('/api/snapshots/:id', h((req) => svc.getSnapshot(req.params.id)));
app.get('/api/edges', h(() => svc.listEdges()));
app.post('/api/edges', h((req) => svc.createEdge(req.body, operatorOf(req))));
app.post('/api/edges/import', h((req) => svc.importEdges(req.body, operatorOf(req))));
app.patch('/api/edges/:id', h((req) => svc.patchEdge(req.params.id, req.body, operatorOf(req))));
app.delete('/api/edges/:id', h((req) => svc.deleteEdge(req.params.id, operatorOf(req))));
app.get('/api/projects', h(() => svc.listProjects()));
app.post('/api/projects', h((req) => svc.createProject(req.body, operatorOf(req))));
app.patch('/api/projects/:id', h((req) => svc.patchProject(req.params.id, req.body, operatorOf(req))));
app.get('/api/changes', h((req) => svc.listChanges(req.query.limit || 100)));
app.get('/api/sources', h(() => svc.sources()));
app.get('/api/export/parcels.csv', (req, res, next) => {
  try {
    const { filename, text } = svc.exportCsv(req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(text);
  } catch (err) { next(err); }
});

// 生产环境：托管前端
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  if (!(err instanceof HttpError)) console.error(err);
  res.status(err.status || 500).json({ error: err.message });
});

app.listen(PORT, () => console.log(`API 已启动：http://localhost:${PORT}`));
