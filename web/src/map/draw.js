// 轻量绘制工具：多边形（圈选、金角银边绘制）和折线（测量）
// 单击加点，双击或点击起点结束，Esc 取消
import * as turf from '@turf/turf';

const SRC = '__draw';

function ensureLayers(map) {
  if (map.getSource(SRC)) return;
  map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: `${SRC}-fill`, type: 'fill', source: SRC, filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#2F7BF5', 'fill-opacity': 0.08 } });
  map.addLayer({ id: `${SRC}-line`, type: 'line', source: SRC, filter: ['!=', '$type', 'Point'], paint: { 'line-color': '#2F7BF5', 'line-width': 2, 'line-dasharray': [3, 2] } });
  map.addLayer({ id: `${SRC}-pt`, type: 'circle', source: SRC, filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 4, 'circle-color': '#fff', 'circle-stroke-color': '#2F7BF5', 'circle-stroke-width': 2 } });
}

export function clearDraw(map) {
  const s = map.getSource(SRC);
  if (s) s.setData({ type: 'FeatureCollection', features: [] });
}

export function showGeometry(map, geometry) {
  ensureLayers(map);
  map.getSource(SRC).setData({ type: 'FeatureCollection', features: geometry ? [{ type: 'Feature', geometry, properties: {} }] : [] });
}

/**
 * @param {maplibregl.Map} map
 * @param {'polygon'|'line'} mode
 * @param {(info: {length?: number, area?: number}) => void} onProgress 实时回调（测量用）
 * @returns {Promise<GeoJSON.Geometry|null>} 取消时返回 null
 */
export function draw(map, mode = 'polygon', onProgress = () => {}) {
  ensureLayers(map);
  const pts = [];
  let hover = null;
  map.doubleClickZoom.disable();
  map.getCanvas().style.cursor = 'crosshair';

  const render = () => {
    const coords = hover ? [...pts, hover] : pts;
    const features = pts.map((c) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: {} }));
    if (coords.length >= 2) {
      if (mode === 'polygon' && coords.length >= 3) {
        features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...coords, coords[0]]] }, properties: {} });
      } else {
        features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} });
      }
      if (mode === 'line') onProgress({ length: turf.length(turf.lineString(coords), { units: 'meters' }) });
      if (mode === 'polygon' && coords.length >= 3) onProgress({ area: turf.area(turf.polygon([[...coords, coords[0]]])) });
    }
    map.getSource(SRC).setData({ type: 'FeatureCollection', features });
  };

  return new Promise((resolve) => {
    const finish = (ok) => {
      map.off('click', onClick);
      map.off('dblclick', onDbl);
      map.off('mousemove', onMove);
      window.removeEventListener('keydown', onKey);
      map.getCanvas().style.cursor = '';
      setTimeout(() => map.doubleClickZoom.enable(), 0);
      hover = null;
      if (!ok) { clearDraw(map); resolve(null); return; }
      const min = mode === 'polygon' ? 3 : 2;
      if (pts.length < min) { clearDraw(map); resolve(null); return; }
      const geometry = mode === 'polygon'
        ? { type: 'Polygon', coordinates: [[...pts, pts[0]]] }
        : { type: 'LineString', coordinates: pts };
      render();
      resolve(geometry);
    };
    const onClick = (e) => {
      const c = [e.lngLat.lng, e.lngLat.lat];
      if (mode === 'polygon' && pts.length >= 3) {
        const first = map.project(pts[0]);
        if (Math.hypot(first.x - e.point.x, first.y - e.point.y) < 10) { finish(true); return; }
      }
      pts.push(c);
      render();
    };
    const onDbl = (e) => { e.preventDefault(); pts.pop(); finish(true); };
    const onMove = (e) => { hover = [e.lngLat.lng, e.lngLat.lat]; render(); };
    const onKey = (e) => { if (e.key === 'Escape') finish(false); if (e.key === 'Enter') finish(true); };
    map.on('click', onClick);
    map.on('dblclick', onDbl);
    map.on('mousemove', onMove);
    window.addEventListener('keydown', onKey);
  });
}
