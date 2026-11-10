// 把 data/ 下的工业用地 shapefile 导入 SQLite
// 用法：npm run import          （已有数据时跳过）
//       npm run import -- --force （清空地块表后重新导入，人工维护的开工、建设量等会丢失）
import { db } from './db.js';
import { sqliteStore } from './store-sqlite.js';
import { createService } from '../shared/service.js';
import { readParcels } from './shp.js';

const force = process.argv.includes('--force');
const existing = db.prepare('SELECT COUNT(*) n FROM parcels').get().n;
if (existing > 0 && !force) {
  console.log(`数据库已有 ${existing} 个地块，跳过导入（如需重新导入请加 --force）`);
  process.exit(0);
}

const { shpName, rows } = await readParcels();
db.exec('BEGIN');
if (force) db.exec('DELETE FROM parcels');
for (const r of rows) sqliteStore.parcels.insert({ ...r, updated_at: new Date().toISOString() });
db.exec('COMMIT');

sqliteStore.changes.add({ at: new Date().toISOString(), target: 'parcel', target_id: null, summary: `导入 ${shpName}：${rows.length} 个地块`, operator: '系统导入', basis: shpName });
const { counts } = createService(sqliteStore).recalc('数据导入');
console.log(`导入完成：${rows.length} 个地块`, counts);
