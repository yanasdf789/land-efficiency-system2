// service 的 SQLite 存储实现
import { db } from './db.js';

const parse = (s, fallback = null) => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };

const parcelOut = (r) => r && ({ ...r, props: parse(r.props, {}), geom: parse(r.geom), tenants: parse(r.tenants, []) });
const edgeOut = (r) => r && ({ ...r, geom: parse(r.geom) });

const EDGE_COLS = ['code', 'shape', 'neighbor', 'assignee', 'dev_content', 'leader', 'started', 'status', 'area', 'geom', 'updated_at'];
const PROJECT_COLS = ['name', 'parcel_id', 'edge_id', 'investment', 'company', 'lead_unit', 'owner', 'stage', 'demo', 'monthly', 'year', 'updated_at'];

function insertRow(table, cols, row) {
  const use = cols.filter((c) => c in row);
  const vals = use.map((c) => (c === 'geom' ? JSON.stringify(row[c]) : row[c] ?? null));
  return Number(db.prepare(`INSERT INTO ${table} (${use.join(',')}) VALUES (${use.map(() => '?').join(',')})`).run(...vals).lastInsertRowid);
}
function updateRow(table, cols, id, row) {
  const vals = cols.map((c) => (c === 'geom' ? JSON.stringify(row[c]) : row[c] ?? null));
  db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...vals, id);
}

export const sqliteStore = {
  parcels: {
    all: () => db.prepare('SELECT * FROM parcels').all().map(parcelOut),
    get: (id) => parcelOut(db.prepare('SELECT * FROM parcels WHERE id = ?').get(id)),
    update(id, r) {
      db.prepare(`UPDATE parcels SET started = ?, start_date = ?, start_basis = ?, planned_far = ?, built_floor = ?,
        ccc = ?, landlord = ?, tenants = ?, updated_at = ? WHERE id = ?`)
        .run(r.started, r.start_date, r.start_basis, r.planned_far, r.built_floor, r.ccc, r.landlord, JSON.stringify(r.tenants || []), r.updated_at, id);
    },
    insert(r) {
      db.prepare(`INSERT INTO parcels (id, code, props, geom, started, start_date, start_basis, planned_far, built_floor, ccc, landlord, tenants, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(r.id, r.code, JSON.stringify(r.props), JSON.stringify(r.geom), r.started, r.start_date, r.start_basis, r.planned_far, r.built_floor,
          r.ccc, r.landlord, JSON.stringify(r.tenants || []), r.updated_at);
    }
  },
  edges: {
    all: () => db.prepare('SELECT * FROM edges ORDER BY id').all().map(edgeOut),
    get: (id) => edgeOut(db.prepare('SELECT * FROM edges WHERE id = ?').get(id)),
    insert: (row) => insertRow('edges', EDGE_COLS, row),
    update: (id, row) => updateRow('edges', EDGE_COLS, id, row),
    remove: (id) => db.prepare('DELETE FROM edges WHERE id = ?').run(id)
  },
  projects: {
    all: () => db.prepare('SELECT * FROM projects').all(),
    get: (id) => db.prepare('SELECT * FROM projects WHERE id = ?').get(id),
    insert: (row) => insertRow('projects', PROJECT_COLS, row),
    update: (id, row) => updateRow('projects', PROJECT_COLS, id, row)
  },
  changes: {
    add: (c) => db.prepare('INSERT INTO changes (at, target, target_id, summary, operator, basis) VALUES (?, ?, ?, ?, ?, ?)')
      .run(c.at, c.target, c.target_id, c.summary, c.operator, c.basis),
    list: (limit) => db.prepare('SELECT * FROM changes ORDER BY id DESC LIMIT ?').all(limit)
  },
  snapshots: {
    add: (s) => db.prepare('INSERT INTO snapshots (at, trigger, counts, classes) VALUES (?, ?, ?, ?)')
      .run(s.at, s.trigger, JSON.stringify(s.counts), JSON.stringify(s.classes)),
    list: (limit) => db.prepare('SELECT id, at, trigger, counts FROM snapshots ORDER BY id DESC LIMIT ?').all(limit)
      .map((s) => ({ ...s, counts: parse(s.counts, {}) })),
    get(id) {
      const s = db.prepare('SELECT * FROM snapshots WHERE id = ?').get(id);
      return s && { ...s, counts: parse(s.counts, {}), classes: parse(s.classes, {}) };
    }
  },
  rules: {
    get() { const r = db.prepare("SELECT value FROM rules WHERE key = 'thresholds'").get(); return r ? parse(r.value) : null; },
    set: (v) => db.prepare("INSERT INTO rules (key, value) VALUES ('thresholds', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(v))
  }
};
