// 业务逻辑层：后端（SQLite）和浏览器演示版（localStorage）共用
// store 接口（同步）：
//   parcels: all() get(id) update(id, row)
//   edges / projects: all() get(id) insert(row)→id update(id, row) [edges.remove(id)]
//   changes: add(row) list(limit)
//   snapshots: add(row) list(limit) get(id)
//   rules: get()→obj|null set(obj)
import * as turf from '@turf/turf';
import { evaluate, DEFAULT_RULES, CLASS_NAMES } from './rules.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const now = () => new Date().toISOString();
const STAGES = ['谋划', '立项', '实施', '验收销号'];

export function createService(store) {
  const log = (target, targetId, summary, operator, basis = null) =>
    store.changes.add({ at: now(), target, target_id: targetId == null ? null : String(targetId), summary, operator: operator || '系统用户', basis });

  const getRules = () => ({ ...DEFAULT_RULES, ...(store.rules.get() || {}) });

  function recalc(trigger = '手动全量重算') {
    const rules = getRules();
    const classes = {};
    const counts = { gwy: 0, ywj: 0, jjyb: 0, qydx: 0 };
    for (const r of store.parcels.all()) {
      const { cls } = evaluate(r, rules);
      if (cls) { classes[r.id] = cls; counts[cls] += 1; }
    }
    counts.jjyb = store.edges.all().filter((e) => e.status !== '已完成').length;
    store.snapshots.add({ at: now(), trigger, counts, classes });
    return { counts, classes };
  }

  const projectByParcel = () => {
    const m = new Map();
    for (const p of store.projects.all()) if (p.parcel_id != null) m.set(p.parcel_id, p);
    return m;
  };

  function summary(row, rules, projects) {
    const p = row.props;
    const e = evaluate(row, rules);
    const proj = projects.get(row.id);
    return {
      id: row.id, code: row.code, cls: e.cls, owner: p.TDQLR, user: p['权利人'], village: p.SZC, location: p.TDZL,
      areaMu: +e.areaMu.toFixed(2), area: Math.round(e.area), started: e.started ? 1 : 0, supplied: e.supplied ? 1 : 0,
      far: +e.far.toFixed(2), muTax: +e.muTax.toFixed(2), planned: e.planned ? Math.round(e.planned) : null,
      built: Math.round(e.built), remaining: e.remaining != null ? Math.round(e.remaining) : null,
      ccc: row.ccc, projectStage: proj ? proj.stage : null
    };
  }

  const edgeFeature = (e) => ({
    type: 'Feature', id: e.id, geometry: e.geom,
    properties: { ...e, geom: undefined, areaMu: e.area ? +(e.area / 666.67).toFixed(2) : null }
  });

  const nextEdgeCode = () => `JJ-${String(store.edges.all().length + 1).padStart(3, '0')}`;

  return {
    recalc,
    getRules,

    listParcels() {
      const rules = getRules();
      const projects = projectByParcel();
      return {
        type: 'FeatureCollection',
        features: store.parcels.all().map((r) => ({ type: 'Feature', id: r.id, geometry: r.geom, properties: summary(r, rules, projects) }))
      };
    },

    getParcel(id) {
      const row = store.parcels.get(Number(id));
      if (!row) throw new HttpError(404, '地块不存在');
      const rules = getRules();
      const e = evaluate(row, rules);
      return {
        id: row.id, code: row.code, props: row.props, geometry: row.geom,
        eval: { ...e, clsName: e.cls ? CLASS_NAMES[e.cls] : null },
        started: row.started, startDate: row.start_date, startBasis: row.start_basis,
        plannedFarOverride: row.planned_far, builtFloorOverride: row.built_floor,
        ccc: row.ccc, landlord: row.landlord, tenants: row.tenants || [], rules,
        project: store.projects.all().find((p) => p.parcel_id === row.id) || null,
        history: store.changes.list(1000).filter((c) => c.target === 'parcel' && c.target_id === String(row.id)).slice(0, 50)
      };
    },

    // 更新开工标记、建设量、厂中厂信息 → 自动重算
    patchParcel(id, b = {}, operator) {
      id = Number(id);
      const row = store.parcels.get(id);
      if (!row) throw new HttpError(404, '地块不存在');
      const rules = getRules();
      const before = evaluate(row, rules);
      const next = { ...row };
      const notes = [];
      const optNum = (v) => (v === '' || v == null ? null : Number(v));
      if ('started' in b && Number(!!b.started) !== row.started) {
        next.started = b.started ? 1 : 0;
        notes.push(`开工标记：${row.started ? '已开工' : '未开工'} → ${next.started ? '已开工' : '未开工'}`);
      }
      if ('startDate' in b && (b.startDate || null) !== row.start_date) { next.start_date = b.startDate || null; notes.push(`开工日期：${next.start_date || '空'}`); }
      if ('startBasis' in b && (b.startBasis || null) !== row.start_basis) { next.start_basis = b.startBasis || null; notes.push(`开工依据：${next.start_basis || '空'}`); }
      if ('plannedFar' in b && optNum(b.plannedFar) !== row.planned_far) { next.planned_far = optNum(b.plannedFar); notes.push(`规划容积率：${next.planned_far ?? '用原始数据'}`); }
      if ('builtFloor' in b && optNum(b.builtFloor) !== row.built_floor) { next.built_floor = optNum(b.builtFloor); notes.push(`已建面积：${Math.round(before.built)} → ${next.built_floor ?? '用原始数据'} m²`); }
      if ('ccc' in b && Number(b.ccc) !== row.ccc) { next.ccc = Number(b.ccc); notes.push(`厂中厂：${['否', '是', '疑似'][next.ccc]}`); }
      if ('landlord' in b && (b.landlord || null) !== row.landlord) { next.landlord = b.landlord || null; notes.push(`出租方：${next.landlord || '空'}`); }
      if ('tenants' in b && JSON.stringify(b.tenants || []) !== JSON.stringify(row.tenants || [])) {
        next.tenants = b.tenants || [];
        notes.push(`承租方：${next.tenants.map((t) => t.name).filter(Boolean).join('、') || '无'}`);
      }
      if (!notes.length) return { changed: false };
      next.updated_at = now();
      store.parcels.update(id, next);
      const after = evaluate(next, rules);
      if (before.cls !== after.cls) notes.push(`系统自动归类：${CLASS_NAMES[before.cls] || '非低效'} → ${CLASS_NAMES[after.cls] || '非低效'}`);
      log('parcel', id, notes.join('；'), operator, b.basisFile || null);
      recalc(`地块 ${row.code} 数据变更`);
      return { changed: true, before: before.cls, after: after.cls, notes };
    },

    stats() {
      const rules = getRules();
      const rows = store.parcels.all();
      const classes = { gwy: { n: 0, mu: 0 }, ywj: { n: 0, mu: 0, remaining: 0 }, qydx: { n: 0, mu: 0 } };
      const missing = { plannedFar: 0, ccc: 0 };
      for (const r of rows) {
        const e = evaluate(r, rules);
        if (e.cls) { classes[e.cls].n += 1; classes[e.cls].mu += e.areaMu; }
        if (e.cls === 'ywj') classes.ywj.remaining += e.remaining || 0;
        if (e.started && !e.plannedFar) missing.plannedFar += 1;
        if (r.ccc === 2) missing.ccc += 1;
      }
      const edges = store.edges.all();
      const year = new Date().getFullYear();
      const projects = store.projects.all().filter((p) => p.year === year || p.year == null);
      return {
        total: rows.length, classes, missing,
        edges: {
          total: edges.length,
          done: edges.filter((e) => e.status === '已完成').length,
          doing: edges.filter((e) => e.status === '进行中').length,
          todo: edges.filter((e) => e.status === '未启动').length,
          started: edges.filter((e) => e.started).length,
          mu: edges.filter((e) => e.status !== '已完成').reduce((s, e) => s + (e.area || 0) / 666.67, 0)
        },
        projects: {
          n: projects.length,
          investment: projects.reduce((s, p) => s + (p.investment || 0), 0),
          companies: new Set(projects.map((p) => p.company).filter(Boolean)).size,
          demo: projects.filter((p) => p.demo).length
        },
        rules, asOf: now()
      };
    },

    putRules(b = {}, operator) {
      const allowed = ['ywjRatio', 'qydxMuTax', 'qydxFar', 'qydxMode', 'qydxZeroTaxAsLow'];
      const next = {};
      for (const k of allowed) if (k in b) next[k] = b[k];
      const rules = { ...getRules(), ...next };
      store.rules.set(rules);
      log('rules', null, `判定规则调整：${JSON.stringify(next)}`, operator, b.basis || null);
      return { rules, counts: recalc('判定规则调整').counts };
    },

    listSnapshots() {
      return store.snapshots.list(100).map(({ id, at, trigger, counts }) => ({ id, at, trigger, counts }));
    },
    getSnapshot(id) {
      const s = store.snapshots.get(Number(id));
      if (!s) throw new HttpError(404, '快照不存在');
      return s;
    },

    // ---------- 金角银边 ----------
    listEdges() { return { type: 'FeatureCollection', features: store.edges.all().map(edgeFeature) }; },
    createEdge(b = {}, operator) {
      if (!b.geometry) throw new HttpError(400, '缺少地块范围（geometry）');
      const area = turf.area({ type: 'Feature', geometry: b.geometry, properties: {} });
      const code = b.code || nextEdgeCode();
      const id = store.edges.insert({
        code, shape: b.shape || null, neighbor: b.neighbor || null, assignee: b.assignee || null, dev_content: b.devContent || null,
        leader: b.leader || null, started: b.started ? 1 : 0, status: b.status || '未启动', area, geom: b.geometry, updated_at: now()
      });
      log('edge', id, `新增金角银边地块 ${code}（${(area / 666.67).toFixed(2)} 亩）`, operator);
      recalc(`新增金角银边 ${code}`);
      return edgeFeature(store.edges.get(id));
    },
    importEdges(fc, operator) {
      let n = 0;
      for (const f of (fc && fc.features) || []) {
        if (!f.geometry || !/Polygon/.test(f.geometry.type)) continue;
        const p = f.properties || {};
        store.edges.insert({
          code: p.code || p['编号'] || nextEdgeCode(), shape: p.shape || p['形态'] || null,
          neighbor: p.neighbor || p['相邻企业'] || null, assignee: p.assignee || p['受让企业'] || null,
          dev_content: p.devContent || p['拟开发内容'] || null, leader: p.leader || p['牵头人'] || null,
          started: p.started || p['开工'] === '是' ? 1 : 0, status: p.status || p['处置状态'] || '未启动',
          area: turf.area(f), geom: f.geometry, updated_at: now()
        });
        n += 1;
      }
      log('edge', null, `导入金角银边地块 ${n} 块`, operator);
      recalc('导入金角银边');
      return { imported: n };
    },
    patchEdge(id, b = {}, operator) {
      id = Number(id);
      const e = store.edges.get(id);
      if (!e) throw new HttpError(404, '地块不存在');
      const map = { shape: 'shape', neighbor: 'neighbor', assignee: 'assignee', devContent: 'dev_content', leader: 'leader', status: 'status' };
      const labels = { shape: '形态/位置', neighbor: '相邻企业', assignee: '受让企业', devContent: '拟开发内容', leader: '牵头人', status: '处置状态' };
      const next = { ...e };
      const notes = [];
      for (const [k, col] of Object.entries(map)) {
        if (k in b && (b[k] || null) !== e[col]) { next[col] = b[k] || null; notes.push(`${labels[k]}：${e[col] || '空'} → ${next[col] || '空'}`); }
      }
      if (!next.status) next.status = '未启动';
      if ('started' in b && Number(!!b.started) !== e.started) { next.started = b.started ? 1 : 0; notes.push(`开工：${next.started ? '已开工' : '未开工'}`); }
      if (!notes.length) return { changed: false };
      next.updated_at = now();
      store.edges.update(id, next);
      log('edge', id, `${e.code}：${notes.join('；')}`, operator, b.basisFile || null);
      recalc(`金角银边 ${e.code} 状态变更`);
      return { changed: true, feature: edgeFeature(store.edges.get(id)) };
    },
    deleteEdge(id, operator) {
      const e = store.edges.get(Number(id));
      if (!e) throw new HttpError(404, '地块不存在');
      store.edges.remove(Number(id));
      log('edge', id, `删除金角银边地块 ${e.code}`, operator);
      recalc(`删除金角银边 ${e.code}`);
      return { deleted: true };
    },

    // ---------- 项目 ----------
    listProjects() {
      const parcels = new Map(store.parcels.all().map((p) => [p.id, p.code]));
      const edges = new Map(store.edges.all().map((e) => [e.id, e.code]));
      return store.projects.all()
        .map((p) => ({ ...p, parcel_code: parcels.get(p.parcel_id) || null, edge_code: edges.get(p.edge_id) || null }))
        .sort((a, b) => b.id - a.id);
    },
    createProject(b = {}, operator) {
      if (!b.name) throw new HttpError(400, '项目名称必填');
      const row = projectRow(b, { stage: '谋划', demo: 0, year: new Date().getFullYear() });
      row.updated_at = now();
      const id = store.projects.insert(row);
      log('project', id, `新建项目 ${b.name}`, operator);
      return store.projects.get(id);
    },
    patchProject(id, b = {}, operator) {
      id = Number(id);
      const p = store.projects.get(id);
      if (!p) throw new HttpError(404, '项目不存在');
      const changes = projectRow(b, {});
      const notes = [];
      for (const [col, v] of Object.entries(changes)) {
        if (v !== p[col]) notes.push(col === 'stage' ? `当前节点：${p.stage} → ${v}` : `${PROJECT_LABELS[col]}：${v ?? '空'}`);
      }
      if (!notes.length) return { changed: false };
      store.projects.update(id, { ...p, ...changes, updated_at: now() });
      log('project', id, `${p.name}：${notes.join('；')}`, operator);
      return store.projects.get(id);
    },

    // ---------- 变更记录 / 数据源 / 导出 ----------
    listChanges(limit = 100) { return store.changes.list(Number(limit)); },
    sources() {
      const all = store.changes.list(100000);
      const last = (target) => all.find((c) => c.target === target)?.at || null;
      const imp = all.find((c) => c.operator === '系统导入');
      const rows = store.parcels.all();
      const rules = getRules();
      let noFar = 0; let noTax = 0;
      for (const r of rows) { const e = evaluate(r, rules); if (e.started && !e.plannedFar) noFar += 1; if (!e.muTax) noTax += 1; }
      return [
        { item: '工业用地数据库（供地、权利人、建设、税收）', from: imp?.basis || 'data 文件夹', mode: 'Shapefile 导入', at: imp?.at, status: `${rows.length} 个地块` },
        { item: '开工标记', from: '原始数据 + 人工维护', mode: '人工录入', at: last('parcel'), status: `${rows.filter((r) => !r.started).length} 块未开工` },
        { item: '规划容积率（应建规模）', from: '原始数据 + 人工维护', mode: '人工录入', at: last('parcel'), status: noFar ? `${noFar} 块已开工但缺规划容积率` : '完整' },
        { item: '亩均税收', from: '原始数据（税收字段）', mode: 'Shapefile 导入', at: imp?.at, status: `${noTax} 块为 0 或缺失` },
        { item: '厂中厂租赁信息', from: '权利人不一致自动识别 + 人工核实', mode: '人工录入', at: last('parcel'), status: `${rows.filter((r) => r.ccc === 2).length} 块疑似待核实` },
        { item: '金角银边地块', from: '人工绘制 / GeoJSON 导入', mode: '人工录入', at: last('edge'), status: `${store.edges.all().length} 块` },
        { item: '项目信息', from: '经信 / 招商 / 自然资源', mode: '人工录入', at: last('project'), status: `${store.projects.all().length} 个项目` }
      ];
    },
    exportCsv(query = {}) {
      const rules = getRules();
      const projects = projectByParcel();
      const want = query.cls ? String(query.cls).split(',') : null;
      const ids = query.ids ? new Set(String(query.ids).split(',').map(Number)) : null;
      const rows = store.parcels.all().map((r) => summary(r, rules, projects))
        .filter((s) => s.cls && (!want || want.includes(s.cls)) && (!ids || ids.has(s.id)));
      const head = ['地块索引号', '低效类型', '土地权利人', '使用权利人', '所在村', '坐落', '面积(亩)', '开工', '实际容积率', '亩均税收(万元/亩)', '应建(m²)', '已建(m²)', '剩余(m²)', '厂中厂', '项目节点'];
      const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
      const lines = rows.map((s) => [s.code, CLASS_NAMES[s.cls], s.owner, s.user, s.village, s.location, s.areaMu, s.started ? '已开工' : '未开工',
        s.far, s.muTax, s.planned, s.built, s.remaining, ['否', '是', '疑似'][s.ccc], s.projectStage].map(esc).join(','));
      return {
        filename: `低效用地清单_${new Date().toISOString().slice(0, 10)}.csv`,
        text: '﻿' + [head.join(','), ...lines].join('\r\n')
      };
    }
  };
}

const PROJECT_FIELDS = { name: 'name', parcelId: 'parcel_id', edgeId: 'edge_id', investment: 'investment', company: 'company',
  leadUnit: 'lead_unit', owner: 'owner', stage: 'stage', demo: 'demo', monthly: 'monthly', year: 'year' };
const PROJECT_LABELS = { name: '项目名称', parcel_id: '关联地块', edge_id: '关联金角银边', investment: '投资额（亿元）', company: '引进企业',
  lead_unit: '牵头单位', owner: '责任人', stage: '当前节点', demo: '示范项目', monthly: '本月工作', year: '年度' };

function projectRow(b, defaults) {
  const row = { ...defaults };
  for (const [k, col] of Object.entries(PROJECT_FIELDS)) {
    if (!(k in b)) continue;
    let v = b[k] === '' ? null : b[k];
    if (k === 'demo') v = v ? 1 : 0;
    if (k === 'stage' && v && !STAGES.includes(v)) throw new HttpError(400, `未知的项目节点：${v}`);
    if (k === 'stage' && !v) v = '谋划';
    row[col] = v;
  }
  return row;
}
