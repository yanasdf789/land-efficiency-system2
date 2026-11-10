<template>
  <div class="mapview">
    <div ref="mapEl" class="map"></div>

    <div class="overlay">
      <!-- 左侧：标题、图层、筛选 -->
      <aside class="col left">
        <div class="title">
          <h1>低效用地一张图</h1>
          <div class="slogan">存量盘活 · 精准监管 · 动态更新</div>
        </div>
        <section class="glass panel">
          <h2 class="h">图层</h2>
          <div class="layers">
            <label v-for="(c, k) in CLASSES" :key="k">
              <input v-model="visible[k]" type="checkbox" />
              <span class="sw" :style="{ background: c.color }"></span>
              {{ c.short }} {{ c.name }}
              <span class="muted cnt">{{ k === 'jjyb' ? edgeScope.active.length : scopeStats[k].n }} 块</span>
            </label>
            <hr />
            <label><input v-model="showCcc" type="checkbox" /><span class="sw dash"></span>厂中厂标识</label>
            <label><input v-model="showEdgeHistory" type="checkbox" /><span class="sw" style="background:#D3DCE8"></span>金角银边已处置（历史）</label>
            <label><input v-model="showOther" type="checkbox" /><span class="sw" style="background:#B8C4D6"></span>其他工业用地</label>
          </div>
        </section>
        <section class="glass panel">
          <h2 class="h">筛选</h2>
          <div class="filters">
            <label class="f">所在村 / 社区
              <select v-model="filter.village" class="ctl">
                <option value="">全部</option>
                <option v-for="v in villages" :key="v" :value="v">{{ v }}</option>
              </select>
            </label>
            <label class="f">项目状态
              <select v-model="filter.stage" class="ctl">
                <option value="">全部</option>
                <option value="none">无项目</option>
                <option v-for="s in STAGES" :key="s" :value="s">{{ s }}</option>
              </select>
            </label>
            <RouterLink class="btn pri" to="/export">按截至今日出标准图</RouterLink>
            <button class="btn" type="button" @click="downloadCsv(exportQuery)">导出当前清单（Excel）</button>
          </div>
        </section>
      </aside>

      <!-- 中间：工具条 + 四类卡片 -->
      <div class="col center">
        <div class="toolbar">
          <input v-model="filter.q" type="search" class="ctl search" placeholder="搜索地块编号 / 坐落 / 企业" aria-label="搜索地块" @keydown.enter="flyToFirst" />
          <button :class="['tool', { on: tool === 'lasso' }]" type="button" @click="startLasso">圈选范围</button>
          <button v-if="selection" class="tool" type="button" @click="clearSelection">清除圈选</button>
          <button :class="['tool', { on: tool === 'measure' }]" type="button" @click="startMeasure">测量</button>
          <span v-if="measureText" class="tool">{{ measureText }} <a href="#" @click.prevent="clearMeasure">×</a></span>
          <label class="tool">
            时点回看
            <select v-model="snapshotId" class="snap" aria-label="选择快照">
              <option :value="null">当前</option>
              <option v-for="s in snapshots" :key="s.id" :value="s.id">{{ fmt.time(s.at) }}</option>
            </select>
          </label>
        </div>
        <div v-if="tool" class="hint glass">单击加点，双击结束，Esc 取消</div>
        <div v-if="snapshotId" class="hint glass">正在回看 {{ snapshotLabel }} 的归类结果</div>

        <div class="cards">
          <section v-for="(c, k) in CLASSES" :key="k" :class="['glass', 'tcard', { solo: solo === k }]" :style="solo === k ? { borderColor: c.color } : null">
            <IsoIcon :color="c.color" />
            <div class="tname">{{ c.name }}</div>
            <div class="tnum">
              {{ fmt.n(k === 'jjyb' ? edgeScope.active.length : scopeStats[k].n) }}
              <span class="muted">块 · {{ cardSub(k) }}</span>
            </div>
            <div class="tfoot">
              <span class="muted">{{ c.desc }}</span>
              <button class="arrow" type="button" :aria-label="`只看${c.name}`" @click="toggleSolo(k)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </div>
          </section>
        </div>
      </div>

      <!-- 右侧：统计 + 清单 -->
      <aside class="col right">
        <section class="glass panel">
          <div class="between">
            <h2 class="h">当前图上地块</h2>
            <span class="muted">{{ selection ? '圈选范围' : '全部筛选结果' }}</span>
          </div>
          <div class="kpis">
            <div><div class="muted">四类合计</div><div class="big">{{ fmt.n(totalN) }} <small>块</small></div></div>
            <div><div class="muted">面积</div><div class="big">{{ fmt.n(totalMu) }} <small>亩</small></div></div>
          </div>
          <div class="bar">
            <span v-for="(c, k) in CLASSES" :key="k" :style="{ flex: barPart(k), background: c.color }" :title="c.name"></span>
          </div>
          <div class="muted">按面积构成</div>
        </section>
        <section class="glass panel">
          <h2 class="h">金角银边 {{ year }} 年开工进度</h2>
          <div class="progress"><span :style="{ width: edgeRate + '%' }"></span><i></i></div>
          <div class="between muted" style="margin-top:6px"><span>已开工 {{ edgeScope.started }} / 共 {{ edgeScope.all.length }} 块</span><span>目标 ≥ 50%</span></div>
          <div v-if="!edgeScope.all.length" class="muted" style="margin-top:6px">尚未登记金角银边地块，<RouterLink to="/edge">去登记</RouterLink></div>
        </section>
        <section class="glass panel list">
          <div class="between">
            <h2 class="h">地块清单</h2>
            <span class="muted">{{ lowInScope.length }} 块</span>
          </div>
          <div class="scroll">
            <table>
              <thead><tr><th>编号</th><th>类型</th><th>权利人</th><th>亩</th></tr></thead>
              <tbody>
                <tr v-for="f in lowInScope.slice(0, 200)" :key="f.id" :class="['click', { sel: selectedId === f.id }]" @click="focusParcel(f.id)">
                  <td>{{ f.properties.code.slice(-5) }}</td>
                  <td><span class="sw" :style="{ background: CLASSES[f.properties.c].color }"></span> {{ CLASSES[f.properties.c].name }}</td>
                  <td class="ellip" :title="f.properties.owner">{{ f.properties.owner }}</td>
                  <td>{{ f.properties.areaMu }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </aside>
    </div>
    <div class="scale muted">OpenStreetMap 矢量底图 · CGCS2000（按 WGS84 显示）</div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, defineComponent, h } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import * as maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import { api, CLASSES, fmt, downloadCsv } from '../api.js';
import { loadBaseStyle, DEFAULT_VIEW } from '../map/basemap.js';
import { draw, clearDraw, showGeometry } from '../map/draw.js';

const STAGES = ['谋划', '立项', '实施', '验收销号'];
const route = useRoute();
const router = useRouter();
const year = new Date().getFullYear();

// 等距立方体图标
const IsoIcon = defineComponent({
  props: { color: String },
  setup(props) {
    const tint = (hex, a) => {
      const n = parseInt(hex.slice(1), 16);
      const mix = (c) => Math.round(c + (255 - c) * a);
      return `rgb(${mix(n >> 16)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
    };
    return () => h('svg', { width: 48, height: 48, viewBox: '0 0 56 56', 'aria-hidden': 'true' }, [
      h('path', { d: 'M28 42 L50 31 L28 20 L6 31 Z', fill: tint(props.color, 0.78) }),
      h('path', { d: 'M6 31 V34 L28 45 L50 34 V31 L28 42 Z', fill: tint(props.color, 0.55) }),
      h('path', { d: 'M28 9 L42 16 L28 23 L14 16 Z', fill: tint(props.color, 0.6) }),
      h('path', { d: 'M14 16 L28 23 L28 37 L14 30 Z', fill: tint(props.color, 0.2) }),
      h('path', { d: 'M42 16 L28 23 L28 37 L42 30 Z', fill: props.color })
    ]);
  }
});

const mapEl = ref(null);
let map = null;
let popup = null;

const parcels = ref([]);
const edges = ref([]);
const snapshots = ref([]);
const snapshotId = ref(null);
const snapshotClasses = ref(null);
const visible = reactive({ gwy: true, ywj: true, jjyb: true, qydx: true });
const solo = ref(null);
const showCcc = ref(true);
const showEdgeHistory = ref(false);
const showOther = ref(false);
const filter = reactive({ village: '', stage: '', q: '' });
const selection = ref(null);
const tool = ref(null);
const measureText = ref('');
const selectedId = ref(null);

const villages = computed(() => [...new Set(parcels.value.map((f) => f.properties.village).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh')));
const snapshotLabel = computed(() => fmt.time(snapshots.value.find((s) => s.id === snapshotId.value)?.at));

// 应用筛选与时点回看后的地块（属性 c = 当前展示的归类）
const filtered = computed(() => {
  const q = filter.q.trim();
  return parcels.value
    .map((f) => ({ ...f, properties: { ...f.properties, c: (snapshotClasses.value ? snapshotClasses.value[f.id] : f.properties.cls) || 'none' } }))
    .filter((f) => {
      const p = f.properties;
      if (filter.village && p.village !== filter.village) return false;
      if (filter.stage === 'none' && p.projectStage) return false;
      if (filter.stage && filter.stage !== 'none' && p.projectStage !== filter.stage) return false;
      if (q && !(`${p.code} ${p.owner} ${p.user} ${p.location}`.includes(q))) return false;
      return true;
    });
});
// 地块内点缓存（非响应式），用于圈选判断
let ptCache = new Map();
const inScope = computed(() => {
  const sel = selection.value;
  if (!sel) return filtered.value;
  return filtered.value.filter((f) => {
    let pt = ptCache.get(f.id);
    if (!pt) { pt = turf.pointOnFeature(f); ptCache.set(f.id, pt); }
    return turf.booleanPointInPolygon(pt, sel);
  });
});
const lowInScope = computed(() => inScope.value
  .filter((f) => f.properties.c !== 'none' && visible[f.properties.c])
  .sort((a, b) => b.properties.areaMu - a.properties.areaMu));
const scopeStats = computed(() => {
  const s = { gwy: { n: 0, mu: 0, remaining: 0 }, ywj: { n: 0, mu: 0, remaining: 0 }, qydx: { n: 0, mu: 0, remaining: 0 } };
  for (const f of inScope.value) {
    const c = f.properties.c;
    if (!s[c]) continue;
    s[c].n += 1; s[c].mu += f.properties.areaMu; s[c].remaining += f.properties.remaining || 0;
  }
  return s;
});
const edgeScope = computed(() => {
  const all = edges.value.filter((e) => !selection.value || turf.booleanPointInPolygon(turf.pointOnFeature(e), selection.value));
  const active = all.filter((e) => e.properties.status !== '已完成');
  return { all, active, started: all.filter((e) => e.properties.started).length, mu: active.reduce((s, e) => s + (e.properties.areaMu || 0), 0) };
});
const edgeRate = computed(() => (edgeScope.value.all.length ? Math.round((edgeScope.value.started / edgeScope.value.all.length) * 100) : 0));
const totalN = computed(() => ['gwy', 'ywj', 'qydx'].reduce((s, k) => s + (visible[k] ? scopeStats.value[k].n : 0), 0) + (visible.jjyb ? edgeScope.value.active.length : 0));
const totalMu = computed(() => ['gwy', 'ywj', 'qydx'].reduce((s, k) => s + (visible[k] ? scopeStats.value[k].mu : 0), 0) + (visible.jjyb ? edgeScope.value.mu : 0));
const barPart = (k) => (visible[k] ? (k === 'jjyb' ? edgeScope.value.mu : scopeStats.value[k].mu) : 0);
const cardSub = (k) => {
  if (k === 'ywj') return `剩余 ${fmt.n(scopeStats.value.ywj.remaining / 10000, 1)} 万m²`;
  if (k === 'jjyb') return `已开工 ${edgeRate.value}%`;
  return `${fmt.n(scopeStats.value[k].mu)} 亩`;
};
const exportQuery = computed(() => {
  const narrowed = selection.value || filter.village || filter.stage || filter.q;
  if (narrowed) return { ids: lowInScope.value.map((f) => f.id).join(',') };
  return { cls: ['gwy', 'ywj', 'qydx'].filter((k) => visible[k]).join(',') };
});

function toggleSolo(k) {
  if (solo.value === k) {
    solo.value = null;
    Object.keys(visible).forEach((key) => { visible[key] = true; });
  } else {
    solo.value = k;
    Object.keys(visible).forEach((key) => { visible[key] = key === k; });
  }
}

// ---------- 地图 ----------
const colorExpr = ['match', ['get', 'c'], 'gwy', CLASSES.gwy.color, 'ywj', CLASSES.ywj.color, 'qydx', CLASSES.qydx.color, '#B8C4D6'];

function parcelFilter() {
  const list = Object.keys(visible).filter((k) => visible[k] && k !== 'jjyb');
  if (showOther.value) list.push('none');
  return ['in', ['get', 'c'], ['literal', list]];
}

function refreshMap() {
  if (!map || !map.getSource('parcels')) return;
  map.getSource('parcels').setData({ type: 'FeatureCollection', features: filtered.value });
  const f = parcelFilter();
  map.setFilter('parcels-fill', f);
  map.setFilter('parcels-line', f);
  map.setFilter('parcels-ccc', ['all', f, ['>', ['get', 'ccc'], 0]]);
  map.setLayoutProperty('parcels-ccc', 'visibility', showCcc.value ? 'visible' : 'none');
  const edgeStatus = showEdgeHistory.value ? ['未启动', '进行中', '已完成'] : ['未启动', '进行中'];
  const ef = ['in', ['get', 'status'], ['literal', visible.jjyb ? edgeStatus : (showEdgeHistory.value ? ['已完成'] : [])]];
  map.setFilter('edges-fill', ef);
  map.setFilter('edges-line', ef);
  map.getSource('edges').setData({ type: 'FeatureCollection', features: edges.value });
}

watch([filtered, () => ({ ...visible }), showCcc, showEdgeHistory, showOther, edges], refreshMap, { deep: true });
watch(selectedId, (id) => map && map.getLayer('parcels-sel') && map.setFilter('parcels-sel', ['==', ['id'], id ?? -1]));
watch(snapshotId, async (id) => {
  snapshotClasses.value = id ? (await api.get(`/api/snapshots/${id}`)).classes : null;
});

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function openParcelPopup(f, lngLat) {
  const p = f.properties;
  const c = CLASSES[p.c];
  const el = document.createElement('div');
  el.className = 'pp';
  el.innerHTML = `
    <div class="pp-head"><strong>${esc(p.code)}</strong>
      ${c ? `<span class="tag" style="color:${c.color};background:${c.color}1f">${c.short} ${c.name}</span>` : '<span class="tag">非低效</span>'}
      ${p.ccc ? `<span class="tag">${p.ccc === 2 ? '疑似厂中厂' : '厂中厂'}</span>` : ''}</div>
    <dl>
      <dt>土地权利人</dt><dd>${esc(p.owner)}</dd>
      ${p.user && p.user !== p.owner ? `<dt>使用权利人</dt><dd>${esc(p.user)}</dd>` : ''}
      <dt>用地面积</dt><dd>${p.areaMu} 亩</dd>
      <dt>开工</dt><dd>${p.started ? '已开工' : '未开工'}</dd>
      <dt>应建 / 已建</dt><dd>${p.planned ? fmt.n(p.planned) : '—'} / ${fmt.n(p.built)} m²</dd>
      ${p.c === 'ywj' ? `<dt>剩余规模</dt><dd style="color:${c.color};font-weight:700">${fmt.n(p.remaining)} m²</dd>` : ''}
      <dt>容积率</dt><dd>${p.far}</dd>
      <dt>亩均税收</dt><dd>${p.muTax} 万元/亩</dd>
    </dl>
    <a href="/parcel/${p.id}" class="pp-link">查看地块详情 →</a>`;
  el.querySelector('.pp-link').addEventListener('click', (e) => { e.preventDefault(); router.push(`/parcel/${p.id}`); });
  popup?.remove();
  popup = new maplibregl.Popup({ maxWidth: '300px', offset: 8 }).setLngLat(lngLat).setDOMContent(el).addTo(map);
  selectedId.value = f.id;
}

function openEdgePopup(f, lngLat) {
  const p = f.properties;
  const el = document.createElement('div');
  el.className = 'pp';
  el.innerHTML = `
    <div class="pp-head"><strong>${esc(p.code)}</strong><span class="tag" style="color:${CLASSES.jjyb.color};background:${CLASSES.jjyb.color}1f">③ 金角银边</span><span class="tag">${esc(p.status)}</span></div>
    <dl>
      <dt>形态 / 位置</dt><dd>${esc(p.shape) || '—'}</dd>
      <dt>相邻企业</dt><dd>${esc(p.neighbor) || '—'}</dd>
      <dt>受让企业</dt><dd>${esc(p.assignee) || '—'}</dd>
      <dt>拟开发内容</dt><dd>${esc(p.dev_content) || '—'}</dd>
      <dt>牵头人</dt><dd>${esc(p.leader) || '—'}</dd>
      <dt>开工</dt><dd>${p.started ? '已开工' : '未开工'}</dd>
      <dt>面积</dt><dd>${p.areaMu ?? '—'} 亩</dd>
    </dl>
    <a href="/edge" class="pp-link">进入处置管理 →</a>`;
  el.querySelector('.pp-link').addEventListener('click', (e) => { e.preventDefault(); router.push(`/edge?id=${p.id}`); });
  popup?.remove();
  popup = new maplibregl.Popup({ maxWidth: '300px', offset: 8 }).setLngLat(lngLat).setDOMContent(el).addTo(map);
}

function focusParcel(id) {
  const f = filtered.value.find((x) => x.id === id) || parcels.value.find((x) => x.id === id);
  if (!f) return;
  const b = turf.bbox(f);
  map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: { top: 360, bottom: 280, left: 360, right: 420 }, maxZoom: 17, duration: 0 });
  const c = turf.pointOnFeature(f).geometry.coordinates;
  openParcelPopup(f, { lng: c[0], lat: c[1] });
}
function flyToFirst() { if (lowInScope.value[0]) focusParcel(lowInScope.value[0].id); else if (inScope.value[0]) focusParcel(inScope.value[0].id); }

async function startLasso() {
  if (tool.value) return;
  popup?.remove();
  clearMeasure();
  tool.value = 'lasso';
  const g = await draw(map, 'polygon');
  tool.value = null;
  if (g) selection.value = g;
}
function clearSelection() { selection.value = null; clearDraw(map); }
async function startMeasure() {
  if (tool.value) return;
  popup?.remove();
  if (selection.value) clearSelection();
  tool.value = 'measure';
  const g = await draw(map, 'line', ({ length }) => { measureText.value = length >= 1000 ? `${(length / 1000).toFixed(2)} km` : `${Math.round(length)} m`; });
  tool.value = null;
  if (!g) measureText.value = '';
}
function clearMeasure() { measureText.value = ''; if (map && !selection.value) clearDraw(map); }

async function load() {
  const [fc, ec, snaps] = await Promise.all([api.get('/api/parcels'), api.get('/api/edges'), api.get('/api/snapshots')]);
  ptCache = new Map();
  parcels.value = fc.features;
  edges.value = ec.features;
  snapshots.value = snaps;
}

onMounted(async () => {
  const [style] = await Promise.all([loadBaseStyle(), load()]);
  map = new maplibregl.Map({ container: mapEl.value, style, ...DEFAULT_VIEW, attributionControl: { compact: true } });
  if (import.meta.env.DEV) window.__map = map;
  map.on('error', (e) => console.warn('地图错误', e.error?.message || e));
  map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
  // style.load 只等样式就绪，不等底图瓦片，地块可以先于底图显示
  map.once('style.load', () => {
    map.addSource('parcels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'id' });
    map.addSource('edges', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'parcels-fill', type: 'fill', source: 'parcels', paint: { 'fill-color': colorExpr, 'fill-opacity': ['case', ['==', ['get', 'c'], 'none'], 0.18, 0.4] } });
    map.addLayer({ id: 'parcels-line', type: 'line', source: 'parcels', paint: { 'line-color': colorExpr, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 16, 2] } });
    map.addLayer({ id: 'parcels-ccc', type: 'line', source: 'parcels', paint: { 'line-color': '#0F2347', 'line-width': 1.4, 'line-dasharray': [3, 2], 'line-offset': -2 }, minzoom: 13 });
    map.addLayer({ id: 'edges-fill', type: 'fill', source: 'edges', paint: { 'fill-color': ['case', ['==', ['get', 'status'], '已完成'], '#D3DCE8', CLASSES.jjyb.color], 'fill-opacity': 0.45 } });
    map.addLayer({ id: 'edges-line', type: 'line', source: 'edges', paint: { 'line-color': ['case', ['==', ['get', 'status'], '已完成'], '#9AA9BD', CLASSES.jjyb.color], 'line-width': 2 } });
    map.addLayer({ id: 'parcels-sel', type: 'line', source: 'parcels', filter: ['==', ['id'], -1], paint: { 'line-color': '#2F7BF5', 'line-width': 4 } });
    refreshMap();
    if (parcels.value.length) {
      const b = turf.bbox({ type: 'FeatureCollection', features: parcels.value });
      map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: { top: 120, bottom: 260, left: 340, right: 380 }, duration: 0 });
    }
    if (route.query.parcel) focusParcel(Number(route.query.parcel));
    if (route.query.snapshot) snapshotId.value = Number(route.query.snapshot);
  });
  map.on('click', (e) => {
    if (tool.value) return;
    const hit = map.queryRenderedFeatures(e.point, { layers: ['edges-fill', 'parcels-fill'] })[0];
    if (!hit) { popup?.remove(); selectedId.value = null; return; }
    if (hit.layer.id === 'edges-fill') openEdgePopup(hit, e.lngLat);
    else openParcelPopup(hit, e.lngLat);
  });
  for (const l of ['parcels-fill', 'edges-fill']) {
    map.on('mouseenter', l, () => { if (!tool.value) map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', l, () => { if (!tool.value) map.getCanvas().style.cursor = ''; });
  }
});
onBeforeUnmount(() => { popup?.remove(); map?.remove(); });

// 圈选完成后在地图上保留范围
watch(selection, (g) => { if (map && g) showGeometry(map, g); });
</script>

<style scoped>
.mapview { position: absolute; inset: 0; overflow: hidden; }
.map { position: absolute; inset: 0; }
.overlay {
  position: absolute; inset: 64px 0 0 0; display: flex; justify-content: space-between; gap: 16px;
  padding: 16px 24px 28px; pointer-events: none;
}
.col { display: flex; flex-direction: column; gap: 14px; min-height: 0; }
.col > * { pointer-events: auto; }
.left { flex: 0 0 280px; overflow: auto; }
.right { flex: 0 0 330px; }
.center { flex: 1 1 auto; min-width: 0; justify-content: space-between; pointer-events: none; }
.center > .toolbar, .center > .hint { pointer-events: auto; }
.title { padding: 2px 4px 4px; }
.title h1 { font-size: 30px; font-weight: 900; letter-spacing: 0.04em; line-height: 1.25; text-shadow: 0 1px 0 rgba(255,255,255,0.8); }
.slogan { margin-top: 4px; font-size: 13px; color: var(--ink-2); letter-spacing: 0.12em; }
.layers, .filters { display: flex; flex-direction: column; gap: 9px; }
.layers label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.layers .cnt { margin-left: auto; }
.layers hr { border: 0; border-top: 1px solid var(--line); margin: 2px 0; width: 100%; }
.sw.dash { border: 2px dashed var(--ink); background: transparent; }
.toolbar { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.search { width: 240px; border-radius: 999px; border-color: var(--glass-edge); background: rgba(255,255,255,0.78); }
.snap { border: 0; background: transparent; font: inherit; color: inherit; max-width: 150px; }
.hint { align-self: center; padding: 6px 14px; border-radius: 999px; font-size: 12.5px; margin-top: 8px; }
.cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; pointer-events: auto; margin-top: auto; }
.tcard { padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; transition: transform 0.15s, box-shadow 0.15s; }
.tcard:hover { transform: translateY(-3px); }
.tcard.solo { border-width: 2px; }
.tname { font-size: 15px; font-weight: 700; }
.tnum { font-size: 24px; font-weight: 700; }
.tnum .muted { font-weight: 400; }
.tfoot { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.between { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.kpis { display: flex; gap: 24px; }
.kpis small { font-size: 13px; font-weight: 400; color: var(--muted); }
.bar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; margin: 12px 0 6px; background: rgba(15,35,71,0.06); }
.list { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.list .scroll { flex: 1; min-height: 120px; }
.list td { white-space: nowrap; padding: 8px 6px; }
.ellip { max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scale { position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%); font-size: 11px; pointer-events: none; }
:deep(.pp) { padding: 14px 16px; font-size: 13px; min-width: 240px; }
:deep(.pp-head) { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 8px; padding-right: 18px; }
:deep(.pp dl) { display: grid; grid-template-columns: 76px 1fr; gap: 4px 8px; margin: 0 0 10px; }
:deep(.pp dt) { color: var(--muted); }
:deep(.pp dd) { margin: 0; }
:deep(.pp-link) { font-weight: 500; }
@media (max-width: 1100px) {
  .overlay { flex-wrap: wrap; overflow: auto; }
  .left, .right { flex: 1 1 280px; }
  .center { order: 3; flex-basis: 100%; }
  .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
