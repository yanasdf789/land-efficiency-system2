<template>
  <div class="page">
    <div class="row main">
      <aside class="side no-print">
        <section class="glass panel">
          <h1 class="ttl">标准出图</h1>
          <p class="muted" style="margin:0 0 16px">按截止时点的数据自动成图，无需手工叠图</p>
          <form class="fm" @submit.prevent>
            <label class="f">图种
              <select v-model="kind" class="ctl">
                <option value="all">四类低效用地合计分布图</option>
                <option v-for="(c, k) in CLASSES" :key="k" :value="k">{{ c.name }}分布图</option>
              </select>
            </label>
            <label class="f">范围
              <select v-model="village" class="ctl">
                <option value="">全域</option>
                <option v-for="v in villages" :key="v" :value="v">{{ v }}</option>
              </select>
            </label>
            <label class="f">数据时点
              <select v-model="snapshotId" class="ctl">
                <option :value="null">截至今日（当前数据）</option>
                <option v-for="s in snapshots" :key="s.id" :value="s.id">{{ fmt.time(s.at) }} · {{ s.trigger }}</option>
              </select>
            </label>
            <label class="f">图名<input v-model="title" class="ctl" /></label>
            <label class="f">制图单位<input v-model="unit" class="ctl" placeholder="填写制图单位名称" /></label>
            <fieldset class="opts">
              <legend>图面内容</legend>
              <label><input v-model="withTable" type="checkbox" /> 统计表</label>
              <label><input v-model="withOther" type="checkbox" /> 其他工业用地（灰色底）</label>
            </fieldset>
            <button class="btn pri" type="button" :disabled="busy" @click="png">{{ busy ? '生成中…' : '生成标准图（PNG）' }}</button>
            <button class="btn" type="button" @click="print">打印 / 另存为 PDF</button>
          </form>
        </section>
        <section class="glass panel">
          <h2 class="h">清单导出</h2>
          <p class="muted" style="margin:0 0 12px">导出当前图种和范围内的地块清单，Excel 可直接打开</p>
          <button class="btn" type="button" style="width:100%" @click="downloadCsv(csvQuery)">导出地块清单</button>
        </section>
      </aside>

      <section class="glass panel preview">
        <div class="between no-print"><h2 class="h" style="margin:0">预览</h2><span class="muted">A3 横版</span></div>
        <div ref="sheet" class="sheet">
          <div class="sheet-title">{{ fullTitle }}</div>
          <div class="sheet-body">
            <div class="sheet-map"><MiniMap ref="mini" :features="mapFeatures" :preserve="true" :padding="30" /></div>
            <div class="sheet-side">
              <div>
                <div class="sb">图例</div>
                <div v-for="k in legendKeys" :key="k" class="lg"><span class="sw" :style="{ background: CLASSES[k].color }"></span>{{ CLASSES[k].name }}</div>
                <div v-if="withOther" class="lg"><span class="sw" style="background:#B8C4D6"></span>其他工业用地</div>
              </div>
              <table v-if="withTable" class="st">
                <thead><tr><th>类型</th><th>块数</th><th>面积（亩）</th></tr></thead>
                <tbody>
                  <tr v-for="k in legendKeys" :key="k"><td>{{ CLASSES[k].name }}</td><td>{{ stats[k].n }}</td><td>{{ fmt.n(stats[k].mu, 1) }}</td></tr>
                  <tr v-if="legendKeys.length > 1"><td><strong>合计</strong></td><td><strong>{{ totals.n }}</strong></td><td><strong>{{ fmt.n(totals.mu, 1) }}</strong></td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="sheet-foot"><span>制图单位：{{ unit || '—' }}</span><span>底图：OpenStreetMap 矢量数据</span><span>坐标系：CGCS2000</span><span>制图日期：{{ today }}</span></div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { api, CLASSES, fmt, downloadCsv } from '../api.js';
import MiniMap from '../components/MiniMap.vue';

const parcels = ref([]);
const edges = ref([]);
const snapshots = ref([]);
const snapshotId = ref(null);
const snapClasses = ref(null);
const kind = ref('all');
const village = ref('');
const title = ref('前湾新区低效用地分布图');
const unit = ref('');
const withTable = ref(true);
const withOther = ref(false);
const busy = ref(false);
const mini = ref(null);
const today = new Date().toLocaleDateString('sv-SE');

const villages = computed(() => [...new Set(parcels.value.map((f) => f.properties.village).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh')));
const asOf = computed(() => {
  const s = snapshots.value.find((x) => x.id === snapshotId.value);
  const d = s ? new Date(s.at) : new Date();
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
});
const kindName = computed(() => (kind.value === 'all' ? '' : CLASSES[kind.value].name));
const fullTitle = computed(() => `${village.value ? village.value + ' ' : ''}${title.value.replace(/分布图$/, '')}${kindName.value ? `（${kindName.value}）` : ''}分布图（截至 ${asOf.value}）`);
const legendKeys = computed(() => (kind.value === 'all' ? Object.keys(CLASSES) : [kind.value]));
const clsOf = (f) => (snapClasses.value ? snapClasses.value[f.id] : f.properties.cls) || null;
const scoped = computed(() => parcels.value.filter((f) => !village.value || f.properties.village === village.value));
const mapFeatures = computed(() => {
  const out = [];
  for (const f of scoped.value) {
    const c = clsOf(f);
    if (c && legendKeys.value.includes(c)) out.push({ type: 'Feature', geometry: f.geometry, properties: { color: CLASSES[c].color } });
    else if (withOther.value) out.push({ type: 'Feature', geometry: f.geometry, properties: { color: '#B8C4D6' } });
  }
  if (legendKeys.value.includes('jjyb')) {
    for (const e of edges.value) if (e.properties.status !== '已完成') out.push({ type: 'Feature', geometry: e.geometry, properties: { color: CLASSES.jjyb.color } });
  }
  return out;
});
const stats = computed(() => {
  const s = Object.fromEntries(Object.keys(CLASSES).map((k) => [k, { n: 0, mu: 0 }]));
  for (const f of scoped.value) { const c = clsOf(f); if (c) { s[c].n += 1; s[c].mu += f.properties.areaMu; } }
  for (const e of edges.value) if (e.properties.status !== '已完成') { s.jjyb.n += 1; s.jjyb.mu += e.properties.areaMu || 0; }
  return s;
});
const totals = computed(() => legendKeys.value.reduce((t, k) => ({ n: t.n + stats.value[k].n, mu: t.mu + stats.value[k].mu }), { n: 0, mu: 0 }));
const csvQuery = computed(() => {
  const cls = legendKeys.value.filter((k) => k !== 'jjyb');
  if (village.value) return { ids: scoped.value.filter((f) => cls.includes(clsOf(f))).map((f) => f.id).join(',') };
  return { cls: cls.join(',') };
});

watch(snapshotId, async (id) => { snapClasses.value = id ? (await api.get(`/api/snapshots/${id}`)).classes : null; });

onMounted(async () => {
  const [p, e, s] = await Promise.all([api.get('/api/parcels'), api.get('/api/edges'), api.get('/api/snapshots')]);
  parcels.value = p.features; edges.value = e.features; snapshots.value = s;
});

function print() { window.print(); }

// 合成 A3 横版 PNG：标题 + 地图 + 图例 + 统计表 + 图签
async function png() {
  const map = mini.value?.getMap();
  if (!map) return;
  busy.value = true;
  try {
    await new Promise((r) => (map.loaded() ? r() : map.once('idle', r)));
    const W = 2480; const H = 1754; const pad = 80;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const font = (s, w = 400) => `${w} ${s}px "Noto Sans SC", "Microsoft YaHei", sans-serif`;
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#0F2347'; g.lineWidth = 4; g.strokeRect(pad / 2, pad / 2, W - pad, H - pad);
    g.fillStyle = '#0F2347'; g.font = font(56, 700); g.textAlign = 'center';
    g.fillText(fullTitle.value, W / 2, pad + 70);
    const mapBox = { x: pad, y: pad + 120, w: W * 0.74 - pad, h: H - pad * 2 - 200 };
    const src = map.getCanvas();
    const scale = Math.max(mapBox.w / src.width, mapBox.h / src.height);
    const sw = mapBox.w / scale; const sh = mapBox.h / scale;
    g.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, mapBox.x, mapBox.y, mapBox.w, mapBox.h);
    g.lineWidth = 2; g.strokeRect(mapBox.x, mapBox.y, mapBox.w, mapBox.h);
    // 指北针
    const nx = mapBox.x + mapBox.w - 70; const ny = mapBox.y + 60;
    g.beginPath(); g.moveTo(nx, ny - 40); g.lineTo(nx + 18, ny + 14); g.lineTo(nx, ny + 2); g.lineTo(nx - 18, ny + 14); g.closePath(); g.fillStyle = '#0F2347'; g.fill();
    g.font = font(28, 700); g.fillText('N', nx, ny + 50);
    // 图例与统计
    let x = mapBox.x + mapBox.w + 50; let y = mapBox.y + 20;
    g.textAlign = 'left'; g.font = font(36, 700); g.fillText('图例', x, y + 30); y += 70;
    const keys = [...legendKeys.value];
    for (const k of keys) { g.fillStyle = CLASSES[k].color; g.fillRect(x, y - 26, 40, 30); g.fillStyle = '#0F2347'; g.font = font(30); g.fillText(CLASSES[k].name, x + 56, y); y += 52; }
    if (withOther.value) { g.fillStyle = '#B8C4D6'; g.fillRect(x, y - 26, 40, 30); g.fillStyle = '#0F2347'; g.fillText('其他工业用地', x + 56, y); y += 52; }
    if (withTable.value) {
      y += 30; g.font = font(36, 700); g.fillText('统计表', x, y); y += 30;
      const cols = [0, 190, 320]; const rowH = 52; const tw = W - pad - x - 20;
      const rows = [['类型', '块数', '面积(亩)'], ...keys.map((k) => [CLASSES[k].name, String(stats.value[k].n), fmt.n(stats.value[k].mu, 1)])];
      if (keys.length > 1) rows.push(['合计', String(totals.value.n), fmt.n(totals.value.mu, 1)]);
      g.lineWidth = 1.5; g.strokeStyle = '#5E6E86';
      rows.forEach((r, i) => {
        g.strokeRect(x, y, tw, rowH);
        g.font = font(26, i === 0 || i === rows.length - 1 ? 700 : 400);
        r.forEach((c, j) => g.fillText(c, x + 14 + cols[j], y + 35));
        y += rowH;
      });
    }
    g.font = font(26); g.fillStyle = '#3E5170'; g.textAlign = 'left';
    const foot = [`制图单位：${unit.value || '—'}`, '底图：OpenStreetMap 矢量数据', '坐标系：CGCS2000', `制图日期：${today}`];
    foot.forEach((t, i) => g.fillText(t, pad + i * ((W - pad * 2) / 4), H - pad - 20));
    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.download = `${fullTitle.value}.png`;
    a.click();
  } finally { busy.value = false; }
}
</script>

<style scoped>
.main { align-items: flex-start; }
.side { flex: 1 1 300px; max-width: 360px; display: flex; flex-direction: column; gap: 16px; }
.ttl { font-size: 22px; font-weight: 900; margin-bottom: 4px; }
.fm { display: flex; flex-direction: column; gap: 14px; }
.opts { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
.opts legend { padding: 0; margin-bottom: 6px; color: var(--ink-2); }
.preview { flex: 999 1 640px; min-width: 0; }
.between { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.sheet { background: #fff; border: 1px solid #9AA5B4; padding: 20px; aspect-ratio: 1.414; display: flex; flex-direction: column; gap: 12px; }
.sheet-title { text-align: center; font-size: 22px; font-weight: 700; }
.sheet-body { flex: 1; display: flex; gap: 16px; min-height: 0; }
.sheet-map { flex: 3; min-width: 0; border: 1px solid #9AA5B4; }
.sheet-map :deep(.minimap) { border-radius: 0; }
.sheet-side { flex: 1; min-width: 160px; display: flex; flex-direction: column; gap: 14px; font-size: 13px; }
.sb { font-weight: 700; margin-bottom: 6px; }
.lg { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.st th, .st td { border: 1px solid #9AA5B4; padding: 4px 6px; text-align: center; font-size: 12px; }
.sheet-foot { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 12px; color: var(--ink-2); }
@media print {
  .page { padding: 0; max-width: none; }
  .preview { border: 0; box-shadow: none; background: none; padding: 0; }
  .sheet { border: 0; }
}
</style>
