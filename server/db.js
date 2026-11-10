// SQLite 数据库（使用 Node 内置 node:sqlite，无需原生依赖）
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DB_PATH = process.env.DB_PATH || join(root, 'storage', 'land.db');
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS parcels (
  id            INTEGER PRIMARY KEY,      -- OBJECTID
  code          TEXT,                     -- DKSYH 地块索引号
  props         TEXT NOT NULL,            -- 原始属性 JSON
  geom          TEXT NOT NULL,            -- GeoJSON 几何
  started       INTEGER NOT NULL DEFAULT 0, -- 开工标记 0/1
  start_date    TEXT,
  start_basis   TEXT,
  planned_far   REAL,                     -- 规划容积率（可覆盖原始值）
  built_floor   REAL,                     -- 已建建筑面积 m²（可覆盖原始值）
  ccc           INTEGER NOT NULL DEFAULT 0, -- 厂中厂：0 否 1 是 2 疑似待核实
  landlord      TEXT,                     -- 出租方
  tenants       TEXT,                     -- 承租方 JSON [{name, area, use}]
  updated_at    TEXT
);
CREATE TABLE IF NOT EXISTS edges (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT,
  shape        TEXT,                      -- 形态/位置描述
  neighbor     TEXT,                      -- 相邻企业
  assignee     TEXT,                      -- 受让企业
  dev_content  TEXT,                      -- 拟开发内容
  leader       TEXT,                      -- 牵头人
  started      INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT '未启动', -- 未启动 / 进行中 / 已完成
  area         REAL,                      -- m²
  geom         TEXT NOT NULL,
  updated_at   TEXT
);
CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  parcel_id   INTEGER,
  edge_id     INTEGER,
  investment  REAL,                       -- 亿元
  company     TEXT,                       -- 引进企业
  lead_unit   TEXT,                       -- 牵头单位
  owner       TEXT,                       -- 责任人
  stage       TEXT NOT NULL DEFAULT '谋划',
  demo        INTEGER NOT NULL DEFAULT 0,
  monthly     TEXT,                       -- 本月工作
  year        INTEGER,
  updated_at  TEXT
);
CREATE TABLE IF NOT EXISTS rules (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS changes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         TEXT NOT NULL,
  target     TEXT NOT NULL,              -- parcel / edge / project / rules
  target_id  TEXT,
  summary    TEXT NOT NULL,
  operator   TEXT,
  basis      TEXT
);
CREATE TABLE IF NOT EXISTS snapshots (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  at       TEXT NOT NULL,
  trigger  TEXT NOT NULL,
  counts   TEXT NOT NULL,                -- {gwy, ywj, jjyb, qydx}
  classes  TEXT NOT NULL                 -- {parcelId: cls}
);
`);



