<template>
  <div class="page">
    <div class="page-head">
      <h1>金角银边处置管理</h1>
      <span class="muted">企业周边零星地、边角地 · 处置完成后并入受让企业工业用地，并保留历史</span>
      <div class="spacer row" style="gap:8px">
        <label class="btn">导入 GeoJSON<input type="file" accept=".geojson,.json" hidden @change="importFile" /></label>
        <button class="btn" type="button" :disabled="!rows.length" @click="exportCsv">导出清单（Excel）</button>
        <button class="btn pri" type="button" :disabled="drawing" @click="startDraw">{{ drawing ? '在地图上绘制中…' : '在地图上新增地块' }}</button>
      </div>
    </div>

    <section class="kpis">
      <div class="glass panel"><div class="muted">地块总数</div><div class="big">{{ all.length }} <small>块</small></div></div>
      <div class="glass panel"><div class="muted">已完成处置</div><div class="big" style="color:var(--ok)">{{ count('已完成') }}</div></div>
      <div class="glass panel"><div class="muted">正在进行</div><div class="big" style="color:var(--warn)">{{ count('进行中') }}</div></div>
      <div class="glass panel"><div class="muted">未启动</div><div class="big" style="color:var(--ink)">{{ count('未启动') }}</div></div>
      <div class="glass panel">
        <div class="muted">{{ year }} 年开工率（目标 ≥ 50%）</div>
        <div class="big">{{ rate }}%</div>
        <div class="progress"><span :style="{ width: rate + '%' }"></span><i></i></div>
      </div>
    </section>

    <div class="row main">
      <section class="glass panel list">
        <div class="row" style="gap:12px;align-items:center;margin-bottom:12px">
          <div class="seg" role="group" aria-label="处置状态筛选">
            <button v-for="s in ['全部', '已完成', '进行中', '未启动']" :key="s" type="button" :class="{ on: tab === s }" :aria-pressed="tab === s" @click="tab = s">{{ s }}</button>
          </div>
          <input v-model="q" type="search" class="ctl" style="max-width:240px" placeholder="搜索编号 / 相邻企业 / 受让企业" aria-label="搜索" />
        </div>
        <div class="scroll">
          <table>
            <thead><tr><th>编号</th><th>形态 / 位置</th><th>面积</th><th>相邻企业</th><th>受让企业</th><th>拟开发内容</th><th>牵头人</th><th>开工</th><th>状态</th></tr></thead>
            <tbody>
              <tr v-for="f in rows" :key="f.id" :class="['click', { sel: sel && sel.id === f.id }]" @click="select(f)">
                <td>{{ f.properties.code }}</td><td>{{ f.properties.shape || '—' }}</td><td>{{ f.properties.areaMu }} 亩</td>
                <td>{{ f.properties.neighbor || '—' }}</td><td>{{ f.properties.assignee || '—' }}</td><td>{{ f.properties.dev_content || '—' }}</td>
                <td>{{ f.properties.leader || '—' }}</td><td>{{ f.properties.started ? '已开工' : '未开工' }}</td>
                <td><span class="st" :class="stCls(f.properties.status)">{{ f.properties.status }}</span></td>
              </tr>
            </tbody>
          </table>
          <div v-if="!rows.length" class="empty">
            {{ all.length ? '没有符合条件的地块' : '尚未登记金角银边地块。可点击“在地图上新增地块”逐块绘制，或导入 GeoJSON（属性可含 编号、形态、相邻企业、受让企业、拟开发内容、牵头人、处置状态、开工）。' }}
          </div>
        </div>
      </section>

      <aside class="side">
        <section class="glass panel mapbox">
          <MiniMap ref="mini" :features="mapFeatures" :highlight="sel ? 'e' + sel.id : null" :padding="50" @ready="onMapReady" @pick="onPick" />
          <div v-if="drawing" class="hint">单击加点，双击结束，Esc 取消</div>
        </section>
        <section v-if="form" class="glass panel">
          <h2 class="h">{{ form.id ? `处置登记 · ${form.code}` : '新增金角银边地块' }}</h2>
          <form class="fm" @submit.prevent="save">
            <div class="grid2">
              <label class="f">处置状态
                <select v-model="form.status" class="ctl"><option>未启动</option><option>进行中</option><option>已完成</option></select>
              </label>
              <label class="f">开工情况
                <select v-model="form.started" class="ctl"><option :value="0">未开工</option><option :value="1">已开工</option></select>
              </label>
            </div>
            <label class="f">形态 / 位置<input v-model="form.shape" class="ctl" placeholder="如：L 形绿地 · 企业北侧" /></label>
            <label class="f">相邻企业<input v-model="form.neighbor" class="ctl" /></label>
            <label class="f">受让企业<input v-model="form.assignee" class="ctl" placeholder="一般为相邻企业" /></label>
            <label class="f">拟开发内容<input v-model="form.devContent" class="ctl" placeholder="以后做什么开发" /></label>
            <label class="f">牵头人<input v-model="form.leader" class="ctl" placeholder="姓名 / 单位" /></label>
            <div class="muted">状态设为“已完成”后，地块从一张图当前图层移出，作为历史保留。</div>
            <div class="row" style="gap:8px">
              <button class="btn pri" type="submit">保存</button>
              <button class="btn" type="button" @click="cancel">取消</button>
              <button v-if="form.id" class="btn danger spacer" type="button" @click="remove">删除</button>
            </div>
          </form>
        </section>
      </aside>
    </div>
    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import * as turf from '@turf/turf';
import { api, CLASSES } from '../api.js';
import MiniMap from '../components/MiniMap.vue';
import { draw, clearDraw } from '../map/draw.js';

const route = useRoute();
const year = new Date().getFullYear();
const all = ref([]);
const parcels = ref([]);
const tab = ref('全部');
const q = ref('');
const sel = ref(null);
const form = ref(null);
const drawing = ref(false);
const toast = ref('');
const mini = ref(null);
let mapRef = null;

const count = (s) => all.value.filter((f) => f.properties.status === s).length;
const rate = computed(() => (all.value.length ? Math.round((all.value.filter((f) => f.properties.started).length / all.value.length) * 100) : 0));
const rows = computed(() => all.value.filter((f) => {
  const p = f.properties;
  if (tab.value !== '全部' && p.status !== tab.value) return false;
  const k = q.value.trim();
  return !k || `${p.code} ${p.neighbor || ''} ${p.assignee || ''}`.includes(k);
}));
const stCls = (s) => ({ 已完成: 'done', 进行中: 'doing', 未启动: 'todo' })[s];
const mapFeatures = computed(() => [
  ...parcels.value.map((f) => ({ type: 'Feature', geometry: f.geometry, properties: { fid: 'p' + f.id, color: '#B8C4D6' } })),
  ...all.value.map((f) => ({ type: 'Feature', geometry: f.geometry, properties: { fid: 'e' + f.id, color: f.properties.status === '已完成' ? '#9AA9BD' : CLASSES.jjyb.color } }))
]);

function flash(msg) { toast.value = msg; setTimeout(() => { toast.value = ''; }, 2600); }
const toForm = (f) => ({
  id: f.id, code: f.properties.code, status: f.properties.status, started: f.properties.started, shape: f.properties.shape || '',
  neighbor: f.properties.neighbor || '', assignee: f.properties.assignee || '', devContent: f.properties.dev_content || '', leader: f.properties.leader || ''
});
function select(f) {
  sel.value = f;
  form.value = toForm(f);
  const m = mini.value?.getMap();
  if (m) { const b = turf.bbox(f); m.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 80, maxZoom: 17 }); }
}
function onPick(fid) {
  if (!String(fid).startsWith('e')) return;
  const f = all.value.find((x) => 'e' + x.id === fid);
  if (f) select(f);
}
function onMapReady(m) { mapRef = m; }
function cancel() { form.value = null; sel.value = null; if (mapRef) clearDraw(mapRef); }

async function load() {
  const [e, p] = await Promise.all([api.get('/api/edges'), parcels.value.length ? null : api.get('/api/parcels')]);
  all.value = e.features;
  if (p) parcels.value = p.features;
  if (route.query.id) { const f = all.value.find((x) => x.id === Number(route.query.id)); if (f) select(f); }
}

async function startDraw() {
  if (!mapRef) return;
  sel.value = null;
  drawing.value = true;
  const g = await draw(mapRef, 'polygon');
  drawing.value = false;
  if (!g) return;
  // 相邻企业默认取离新地块最近的工业用地权利人
  const c = turf.centroid({ type: 'Feature', geometry: g, properties: {} });
  let best = null; let dist = Infinity;
  for (const f of parcels.value) {
    const d = turf.distance(c, turf.pointOnFeature(f));
    if (d < dist) { dist = d; best = f; }
  }
  const owner = best ? best.properties.owner : '';
  form.value = { geometry: g, status: '未启动', started: 0, shape: '', neighbor: owner, assignee: owner, devContent: '', leader: '' };
}

async function save() {
  try {
    const f = form.value;
    if (f.id) {
      await api.patch(`/api/edges/${f.id}`, f);
      flash(f.status === '已完成' ? `${f.code} 已完成处置，已并入受让企业并保留历史` : '已保存');
    } else {
      const created = await api.post('/api/edges', f);
      flash(`已新增 ${created.properties.code}`);
      if (mapRef) clearDraw(mapRef);
    }
    await load();
    const again = form.value.id ? all.value.find((x) => x.id === form.value.id) : null;
    if (again) select(again); else cancel();
  } catch (err) { flash(err.message); }
}
async function remove() {
  if (!confirm(`确定删除 ${form.value.code}？此操作会记录在变更记录中。`)) return;
  await api.del(`/api/edges/${form.value.id}`);
  cancel();
  await load();
  flash('已删除');
}

async function importFile(ev) {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const fc = JSON.parse(await file.text());
    const r = await api.post('/api/edges/import', fc);
    await load();
    mini.value?.refit();
    flash(`已导入 ${r.imported} 块`);
  } catch (err) { flash(`导入失败：${err.message}`); }
}

function exportCsv() {
  const head = ['编号', '形态/位置', '面积(亩)', '相邻企业', '受让企业', '拟开发内容', '牵头人', '开工', '处置状态'];
  const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = rows.value.map(({ properties: p }) => [p.code, p.shape, p.areaMu, p.neighbor, p.assignee, p.dev_content, p.leader, p.started ? '已开工' : '未开工', p.status].map(esc).join(','));
  const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `金角银边清单_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

onMounted(load);
</script>

<style scoped>
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 16px; margin-bottom: 16px; }
.big small { font-size: 13px; font-weight: 400; color: var(--muted); }
.kpis .progress { margin-top: 6px; }
.main { align-items: flex-start; }
.list { flex: 999 1 640px; min-width: 0; }
.list .scroll { max-height: 62vh; }
.list td { white-space: nowrap; }
.side { flex: 1 1 360px; max-width: 460px; display: flex; flex-direction: column; gap: 16px; }
.mapbox { position: relative; height: 380px; padding: 8px; }
.hint { position: absolute; left: 50%; top: 16px; transform: translateX(-50%); background: rgba(255,255,255,0.9); padding: 6px 12px; border-radius: 999px; font-size: 12.5px; }
.fm { display: flex; flex-direction: column; gap: 12px; }
.seg { display: flex; }
.seg button { min-height: 40px; padding: 0 14px; border: 1px solid rgba(47,123,245,0.18); background: rgba(255,255,255,0.8); font: inherit; cursor: pointer; color: var(--ink); }
.seg button + button { border-left: 0; }
.seg button:first-child { border-radius: 12px 0 0 12px; }
.seg button:last-child { border-radius: 0 12px 12px 0; }
.seg button.on { background: var(--jjyb); border-color: var(--jjyb); color: #fff; }
.st { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; }
.st.done { background: #DDF2EF; color: #0D6B61; }
.st.doing { background: #FCEBD7; color: #8A4A0B; }
.st.todo { background: rgba(15,35,71,0.06); color: var(--ink-2); }
</style>
