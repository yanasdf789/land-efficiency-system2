// GitHub Pages 演示版：地块底数来自静态 parcels.json，所有修改保存在本浏览器 localStorage
const KEY = 'land-demo-v1';
const MAX_SNAPSHOTS = 40;

let base = [];          // 原始地块
let source = '';
let state = null;       // 本浏览器的修改
let merged = null;      // 原始 + 修改 的缓存

const empty = () => ({ parcels: {}, edges: [], projects: [], changes: [], snapshots: [], rules: null, seq: { edge: 0, project: 0, change: 0, snapshot: 0 } });

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (err) { console.warn('本地保存失败', err); }
}
function load() {
  try { const s = localStorage.getItem(KEY); return s ? { ...empty(), ...JSON.parse(s) } : null; } catch { return null; }
}
const nextId = (k) => { state.seq[k] += 1; return state.seq[k]; };
const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

export async function initLocalStore(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`地块数据加载失败（${res.status}）`);
  const data = await res.json();
  base = data.rows;
  source = data.source;
  const saved = load();
  state = saved || empty();
  return { fresh: !saved, source };
}

export function resetLocalStore() {
  try { localStorage.removeItem(KEY); } catch { /* 忽略 */ }
  state = empty();
  merged = null;
}

const PARCEL_FIELDS = ['started', 'start_date', 'start_basis', 'planned_far', 'built_floor', 'ccc', 'landlord', 'tenants', 'updated_at'];

export const localStore = {
  parcels: {
    all() {
      if (!merged) merged = base.map((r) => (state.parcels[r.id] ? { ...r, ...state.parcels[r.id] } : r));
      return merged;
    },
    get(id) { return this.all().find((r) => r.id === id) || null; },
    update(id, row) {
      const o = {};
      for (const k of PARCEL_FIELDS) o[k] = clone(row[k]);
      state.parcels[id] = o;
      merged = null;
      save();
    }
  },
  edges: {
    all: () => state.edges,
    get: (id) => state.edges.find((e) => e.id === id) || null,
    insert(row) { const id = nextId('edge'); state.edges.push({ ...clone(row), id }); save(); return id; },
    update(id, row) { state.edges = state.edges.map((e) => (e.id === id ? { ...clone(row), id } : e)); save(); },
    remove(id) { state.edges = state.edges.filter((e) => e.id !== id); save(); }
  },
  projects: {
    all: () => state.projects,
    get: (id) => state.projects.find((p) => p.id === id) || null,
    insert(row) { const id = nextId('project'); state.projects.push({ ...clone(row), id }); save(); return id; },
    update(id, row) { state.projects = state.projects.map((p) => (p.id === id ? { ...clone(row), id } : p)); save(); }
  },
  changes: {
    add(c) { state.changes.unshift({ ...c, id: nextId('change') }); state.changes = state.changes.slice(0, 2000); save(); },
    list: (limit) => state.changes.slice(0, limit)
  },
  snapshots: {
    add(s) { state.snapshots.unshift({ ...clone(s), id: nextId('snapshot') }); state.snapshots = state.snapshots.slice(0, MAX_SNAPSHOTS); save(); },
    list: (limit) => state.snapshots.slice(0, limit),
    get: (id) => state.snapshots.find((s) => s.id === id) || null
  },
  rules: {
    get: () => state.rules,
    set(v) { state.rules = clone(v); save(); }
  }
};

export const localSource = () => source;
