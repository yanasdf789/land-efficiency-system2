// 读取 data/ 下的工业用地 shapefile，转成初始地块记录
import * as shapefile from 'shapefile';
import { readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initialParcel } from '../shared/rules.js';

export const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

export async function readParcels() {
  const shpName = readdirSync(dataDir).find((f) => f.toLowerCase().endsWith('.shp'));
  if (!shpName) throw new Error('data 文件夹下没有找到 .shp 文件');
  const stem = join(dataDir, basename(shpName, '.shp'));
  const source = await shapefile.open(`${stem}.shp`, `${stem}.dbf`, { encoding: 'utf-8' });
  const rows = [];
  for (let r = await source.read(); !r.done; r = await source.read()) rows.push(initialParcel(r.value));
  return { shpName, rows };
}
