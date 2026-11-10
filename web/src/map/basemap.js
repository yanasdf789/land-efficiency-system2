// OpenStreetMap 矢量底图（OpenFreeMap 提供的 OpenMapTiles 矢量瓦片，无需密钥）
// 加载后按设计语言重新配色：浅蓝白底、浅蓝水系、白色道路，中文注记优先
import { setWorkerUrl } from 'maplibre-gl';
// 显式指定 Web Worker 地址，保证开发和打包后都能加载
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
setWorkerUrl(workerUrl);

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

const recolor = {
  background: '#EEF4FC',
  water: '#C9DFF7',
  land: '#E6EEF8',
  green: '#DCEBE4',
  building: '#DCE6F3'
};

let cached = null;

export async function loadBaseStyle() {
  if (cached) return structuredClone(cached);
  try {
    const res = await fetch(STYLE_URL);
    if (!res.ok) throw new Error(res.statusText);
    const style = await res.json();
    for (const layer of style.layers) {
      const id = layer.id;
      if (layer.type === 'background') layer.paint = { ...layer.paint, 'background-color': recolor.background };
      else if (layer.type === 'fill' && /water/.test(id)) layer.paint = { ...layer.paint, 'fill-color': recolor.water };
      else if (layer.type === 'fill' && /(park|wood|grass|landcover)/.test(id)) layer.paint = { ...layer.paint, 'fill-color': recolor.green };
      else if (layer.type === 'fill' && /building/.test(id)) layer.paint = { ...layer.paint, 'fill-color': recolor.building };
      else if (layer.type === 'fill' && /landuse/.test(id)) layer.paint = { ...layer.paint, 'fill-color': recolor.land };
      else if (layer.type === 'line' && /waterway/.test(id)) layer.paint = { ...layer.paint, 'line-color': recolor.water };
      if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
        // 中文名优先，没有中文名时用本地名
        layer.layout['text-field'] = ['coalesce', ['get', 'name:zh'], ['get', 'name'], ['get', 'name:latin']];
      }
    }
    cached = style;
    return structuredClone(style);
  } catch (err) {
    console.warn('矢量底图加载失败，使用空白底图', err);
    return {
      version: 8,
      sources: {},
      layers: [{ id: 'background', type: 'background', paint: { 'background-color': recolor.background } }]
    };
  }
}

// 研究区范围（由地块数据计算后传入；这里给一个前湾新区附近的默认值）
export const DEFAULT_VIEW = { center: [121.235, 30.308], zoom: 12 };
