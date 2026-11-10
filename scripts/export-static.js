// 生成 GitHub Pages 演示版用的静态地块数据：web/public/data/parcels.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readParcels } from '../server/shp.js';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'public', 'data');
// 页面用不到的字段，减小文件体积
const DROP = ['SHAPE_Leng', 'SHAPE_Area', '计数', 'BZ', 'KFQ', 'KFQLX', 'WFYDMJ', 'AAMJ', 'XZQDM', 'SZX', 'SZXZ', 'PZYT', 'GHFHQK', 'SFSJWFYD', 'SFFZ'];
const round = (c) => (typeof c[0] === 'number' ? [+c[0].toFixed(7), +c[1].toFixed(7)] : c.map(round));

const { shpName, rows } = await readParcels();
for (const r of rows) {
  for (const k of DROP) delete r.props[k];
  r.geom = { ...r.geom, coordinates: round(r.geom.coordinates) };
}
mkdirSync(out, { recursive: true });
const file = join(out, 'parcels.json');
writeFileSync(file, JSON.stringify({ source: shpName, generatedAt: new Date().toISOString(), rows }));
console.log(`已生成 ${file}（${rows.length} 个地块）`);
