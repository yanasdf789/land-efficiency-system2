<template>
  <div class="page">
    <div class="page-head">
      <h1>数据管理</h1>
      <span class="muted">所有信息在此统一更新；保存后系统自动重算归类，一张图、清单和统计同步变化</span>
    </div>
    <div class="tabs" role="tablist">
      <button v-for="t in TABS" :key="t.id" type="button" role="tab" :aria-selected="tab === t.id" :class="{ on: tab === t.id }" @click="go(t.id)">{{ t.label }}</button>
    </div>

    <!-- 状态录入 -->
    <div v-if="tab === 'status'" class="row top">
      <section class="glass panel form-col">
        <h2 class="h">开工标记 · 建设量 · 厂中厂</h2>
        <label class="f">地块（输入索引号、权利人或坐落）
          <input v-model="pq" class="ctl" type="search" placeholder="如 3302821180056 或 企业名称" @input="pickOpen = true" />
        </label>
        <ul v-if="pickOpen && pq && matches.length" class="picker glass">
          <li v-for="f in matches" :key="f.id"><button type="button" @click="choose(f.id)">{{ f.properties.code }} · {{ f.properties.owner }} <span class="muted">{{ f.properties.areaMu }} 亩</span></button></li>
        </ul>
        <template v-if="cur">
          <div class="curbox">
            <strong>{{ cur.code }}</strong> · {{ cur.props.TDQLR }}
            <span class="tag" :style="curCls ? { color: curCls.color, background: curCls.color + '1f' } : null">当前：{{ curCls ? curCls.name : '非低效' }}</span>
            <RouterLink :to="`/parcel/${cur.id}`" class="muted">详情</RouterLink>
          </div>
          <form class="fm" @submit.prevent="saveParcel">
            <fieldset class="radios"><legend>开工标记</legend>
              <label><input v-model="pf.started" type="radio" :value="1" /> 已开工</label>
              <label><input v-model="pf.started" type="radio" :value="0" /> 未开工</label>
            </fieldset>
            <div class="grid2">
              <label class="f">开工日期<input v-model="pf.startDate" class="ctl" type="date" /></label>
              <label class="f">开工依据
                <select v-model="pf.startBasis" class="ctl">
                  <option value="">—</option>
                  <option>施工许可</option><option>巡查记录</option><option>企业申报</option>
                  <option v-for="b in extraBasis" :key="b">{{ b }}</option>
                </select>
              </label>
              <label class="f">规划容积率<input v-model="pf.plannedFar" class="ctl" type="number" step="0.01" min="0" :placeholder="`原始数据：${cur.props.GHRJL || '无'}`" /></label>
              <label class="f">已建建筑面积（m²）<input v-model="pf.builtFloor" class="ctl" type="number" step="1" min="0" :placeholder="`原始数据：${Math.round(cur.props.SJJZMJ || 0)}`" /></label>
              <label class="f">厂中厂
                <select v-model.number="pf.ccc" class="ctl"><option :value="0">否</option><option :value="1">是</option><option :value="2">疑似，待核实</option></select>
              </label>
              <label class="f">出租方<input v-model="pf.landlord" class="ctl" :placeholder="cur.props.TDQLR" /></label>
            </div>
            <div v-if="pf.ccc" class="tenants">
              <div class="muted">承租方</div>
              <div v-for="(t, i) in pf.tenants" :key="i" class="trow">
                <input v-model="t.name" class="ctl" placeholder="承租企业" aria-label="承租企业" />
                <input v-model="t.area" class="ctl" type="number" placeholder="面积 m²" aria-label="租赁面积" />
                <input v-model="t.use" class="ctl" placeholder="用途" aria-label="用途" />
                <button class="btn sm" type="button" aria-label="删除承租方" @click="pf.tenants.splice(i, 1)">×</button>
              </div>
              <button class="btn sm" type="button" @click="pf.tenants.push({ name: '', area: null, use: '' })">+ 添加承租方</button>
            </div>
            <label class="f">变更依据（文件号 / 附件说明）<input v-model="pf.basisFile" class="ctl" /></label>
            <div class="note">规划容积率、已建面积留空时使用原始数据。保存后系统会立即重新判定该地块的低效类型。</div>
            <button class="btn pri" type="submit">保存并重算</button>
          </form>
        </template>
        <div v-else class="muted" style="margin-top:12px">先搜索并选择一个地块，或从右侧待处理清单中点“处理”。</div>
      </section>
      <section class="glass panel grow">
        <div class="seg-mini">
          <button v-for="q in QUEUES" :key="q.id" type="button" :class="{ on: queue === q.id }" @click="queue = q.id">{{ q.label }}（{{ queueRows(q.id).length }}）</button>
        </div>
        <p class="muted" style="margin:8px 0">{{ QUEUES.find((q) => q.id === queue).desc }}</p>
        <div class="scroll" style="max-height:60vh">
          <table>
            <thead><tr><th>地块</th><th>土地权利人</th><th>使用权利人</th><th>面积（亩）</th><th>当前归类</th><th></th></tr></thead>
            <tbody>
              <tr v-for="f in queueRows(queue).slice(0, 300)" :key="f.id">
                <td>{{ f.properties.code }}</td><td>{{ f.properties.owner }}</td><td>{{ f.properties.user }}</td><td>{{ f.properties.areaMu }}</td>
                <td>{{ f.properties.cls ? CLASSES[f.properties.cls].name : '—' }}</td>
                <td><button class="btn sm" type="button" @click="choose(f.id)">处理</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- 规则与重算 -->
    <div v-else-if="tab === 'rule'" class="stack">
      <section class="glass panel bar">
        <span>最近重算：{{ snapshots[0] ? fmt.time(snapshots[0].at) : '—' }} · {{ snapshots[0]?.trigger }}</span>
        <span class="muted">底层数据一变自动重算，也可手动全量重算</span>
        <button class="btn pri spacer" type="button" @click="recalcAll">立即全量重算</button>
      </section>
      <div class="rules">
        <section class="glass panel rc" style="border-top:4px solid var(--gwy)">
          <h2 class="h">① 供而未用</h2>
          <div class="rule">是否供地 = 是 AND 开工标记 = 未开工</div>
          <div class="muted">当前 {{ counts.gwy ?? '—' }} 块 · 开工标记在“状态录入”中维护</div>
        </section>
        <section class="glass panel rc" style="border-top:4px solid var(--ywj)">
          <h2 class="h">② 用而未尽</h2>
          <div class="rule">已开工 AND 已建 &lt; 应建 × 比例<br />应建 = 规划容积率 × 用地面积</div>
          <label class="f">判定比例（%）<input v-model.number="rf.ywjRatioPct" class="ctl" type="number" min="1" max="100" /></label>
          <div class="muted">当前 {{ counts.ywj ?? '—' }} 块；缺规划容积率的地块不参与判定</div>
        </section>
        <section class="glass panel rc" style="border-top:4px solid var(--qydx)">
          <h2 class="h">④ 企业低效</h2>
          <div class="rule">亩均税收 &lt; 阈值 {{ rf.qydxMode === 'and' ? 'AND' : 'OR' }} 实际容积率 &lt; 阈值</div>
          <div class="grid2">
            <label class="f">亩均税收阈值（万元/亩）<input v-model.number="rf.qydxMuTax" class="ctl" type="number" step="0.1" min="0" /></label>
            <label class="f">容积率阈值<input v-model.number="rf.qydxFar" class="ctl" type="number" step="0.05" min="0" /></label>
            <label class="f">组合方式
              <select v-model="rf.qydxMode" class="ctl"><option value="and">两项都低于阈值</option><option value="or">任一项低于阈值</option></select>
            </label>
            <label class="f chk"><input v-model="rf.qydxZeroTaxAsLow" type="checkbox" /> 亩均税收为 0 视为低于阈值</label>
          </div>
          <div class="muted">当前 {{ counts.qydx ?? '—' }} 块；已归为①②的地块不重复计入</div>
        </section>
        <section class="glass panel rc">
          <h2 class="h">保存规则</h2>
          <label class="f">调整依据（文件号）<input v-model="rf.basis" class="ctl" /></label>
          <p class="note">默认阈值是初始值，需业务部门确认后调整。保存后全量重算，并生成一份快照。</p>
          <button class="btn pri" type="button" @click="saveRules">保存并重算</button>
        </section>
      </div>
      <section class="glass panel">
        <h2 class="h">重算快照（可在一张图上回看）</h2>
        <div class="scroll" style="max-height:44vh">
          <table>
            <thead><tr><th>时间</th><th>触发来源</th><th>供而未用</th><th>用而未尽</th><th>金角银边</th><th>企业低效</th><th></th></tr></thead>
            <tbody>
              <tr v-for="s in snapshots" :key="s.id">
                <td>{{ fmt.time(s.at) }}</td><td>{{ s.trigger }}</td><td>{{ s.counts.gwy }}</td><td>{{ s.counts.ywj }}</td><td>{{ s.counts.jjyb }}</td><td>{{ s.counts.qydx }}</td>
                <td><RouterLink :to="`/?snapshot=${s.id}`">在图上回看</RouterLink></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- 项目信息 -->
    <div v-else-if="tab === 'project'" class="row top">
      <section class="glass panel form-col">
        <h2 class="h">{{ prf.id ? '更新项目' : '登记项目' }}</h2>
        <form class="fm" @submit.prevent="saveProject">
          <label class="f">项目名称<input v-model="prf.name" class="ctl" required /></label>
          <label class="f">关联地块（索引号）
            <input v-model="prf.parcelCode" class="ctl" list="parcel-codes" placeholder="输入地块索引号" />
            <datalist id="parcel-codes"><option v-for="f in lowParcels" :key="f.id" :value="f.properties.code">{{ f.properties.owner }}</option></datalist>
          </label>
          <div class="grid2">
            <label class="f">投资额（亿元）<input v-model.number="prf.investment" class="ctl" type="number" step="0.01" min="0" /></label>
            <label class="f">引进企业<input v-model="prf.company" class="ctl" /></label>
            <label class="f">牵头单位
              <select v-model="prf.leadUnit" class="ctl"><option value="">—</option><option>自然资源</option><option>经信</option><option>招商</option></select>
            </label>
            <label class="f">责任人<input v-model="prf.owner" class="ctl" /></label>
            <label class="f">当前节点
              <select v-model="prf.stage" class="ctl"><option v-for="s in STAGES" :key="s">{{ s }}</option></select>
            </label>
            <label class="f chk"><input v-model="prf.demo" type="checkbox" /> 示范项目</label>
          </div>
          <label class="f">本月工作<textarea v-model="prf.monthly" class="ctl" placeholder="这个月针对该地块做了什么"></textarea></label>
          <div class="note">项目流程节点为示意，待业务确认后调整。</div>
          <div class="row" style="gap:8px">
            <button class="btn pri" type="submit">保存</button>
            <button v-if="prf.id" class="btn" type="button" @click="resetProject()">新建另一个</button>
          </div>
        </form>
      </section>
      <section class="glass panel grow">
        <div class="kp">
          <span>今年项目 <strong>{{ projects.length }}</strong> 个</span>
          <span>投资总额 <strong>{{ fmt.n(projects.reduce((s, p) => s + (p.investment || 0), 0), 2) }}</strong> 亿元</span>
          <span>引进企业 <strong>{{ new Set(projects.map((p) => p.company).filter(Boolean)).size }}</strong> 家</span>
          <span>示范项目 <strong>{{ projects.filter((p) => p.demo).length }}</strong> 个</span>
        </div>
        <div class="scroll">
          <table>
            <thead><tr><th>项目名称</th><th>关联地块</th><th>投资额</th><th>引进企业</th><th>牵头单位</th><th>责任人</th><th>当前节点</th><th>更新</th></tr></thead>
            <tbody>
              <tr v-for="p in projects" :key="p.id" :class="['click', { sel: prf.id === p.id }]" @click="editProject(p)">
                <td>{{ p.name }}</td>
                <td><RouterLink v-if="p.parcel_id" :to="`/parcel/${p.parcel_id}`" @click.stop>{{ p.parcel_code }}</RouterLink><span v-else>—</span></td>
                <td>{{ p.investment != null ? p.investment + ' 亿' : '—' }}</td><td>{{ p.company || '—' }}</td><td>{{ p.lead_unit || '—' }}</td>
                <td>{{ p.owner || '—' }}</td><td>{{ p.stage }}</td><td>{{ fmt.date(p.updated_at) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="!projects.length" class="empty">暂无项目，在左侧登记第一个项目</div>
        </div>
      </section>
    </div>

    <!-- 数据对接 -->
    <div v-else-if="tab === 'source'" class="stack">
      <section class="glass panel">
        <h2 class="h">数据源状态</h2>
        <table>
          <thead><tr><th>数据项</th><th>来源</th><th>更新方式</th><th>最近更新</th><th>状态</th></tr></thead>
          <tbody><tr v-for="s in sources" :key="s.item"><td>{{ s.item }}</td><td>{{ s.from }}</td><td>{{ s.mode }}</td><td>{{ fmt.time(s.at) }}</td><td>{{ s.status }}</td></tr></tbody>
        </table>
      </section>
      <section class="glass panel">
        <h2 class="h">更新工业用地数据库</h2>
        <p class="note">把新的 Shapefile（.shp/.dbf/.shx/.prj/.cpg）放入项目 data 文件夹，然后在服务器上执行：</p>
        <pre class="code">npm run import -- --force</pre>
        <p class="muted">注意：重新导入会覆盖地块表，此前人工维护的开工标记、建设量、厂中厂信息需要重新录入。金角银边、项目和变更记录不受影响。</p>
      </section>
    </div>

    <!-- 变更记录 -->
    <div v-else-if="tab === 'log'">
      <section class="glass panel">
        <h2 class="h">变更记录</h2>
        <table>
          <thead><tr><th>时间</th><th>对象</th><th>变更内容</th><th>操作人</th><th>依据</th></tr></thead>
          <tbody>
            <tr v-for="c in changes" :key="c.id">
              <td style="white-space:nowrap">{{ fmt.time(c.at) }}</td>
              <td style="white-space:nowrap"><RouterLink v-if="c.target === 'parcel' && c.target_id" :to="`/parcel/${c.target_id}`">地块</RouterLink><span v-else>{{ TARGETS[c.target] }}</span></td>
              <td>{{ c.summary }}</td><td>{{ c.operator }}</td><td>{{ c.basis || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, CLASSES, fmt } from '../api.js';

const TABS = [
  { id: 'status', label: '状态录入' }, { id: 'rule', label: '规则与重算' }, { id: 'project', label: '项目信息' },
  { id: 'source', label: '数据对接' }, { id: 'log', label: '变更记录' }
];
const TARGETS = { parcel: '地块', edge: '金角银边', project: '项目', rules: '规则' };
const STAGES = ['谋划', '立项', '实施', '验收销号'];
const QUEUES = [
  { id: 'ccc', label: '疑似厂中厂', desc: '土地权利人与使用权利人不一致，需核实是否存在出租并登记承租方' },
  { id: 'far', label: '缺规划容积率', desc: '已开工但没有规划容积率，无法判断是否用而未尽，需补录规划条件' },
  { id: 'gwy', label: '供而未用', desc: '已供应但开工标记为未开工；企业开工后在此更新开工标记' }
];

const route = useRoute();
const router = useRouter();
const tab = ref(route.query.tab || 'status');
const toast = ref('');
const flash = (m) => { toast.value = m; setTimeout(() => { toast.value = ''; }, 3200); };
function go(id) { tab.value = id; router.replace({ query: { ...route.query, tab: id } }); }
watch(() => route.query.tab, (t) => { if (t && t !== tab.value) tab.value = t; });

// ---------- 地块 ----------
const parcels = ref([]);
const pq = ref('');
const pickOpen = ref(false);
const cur = ref(null);
const pf = reactive({});
const queue = ref('ccc');
const matches = computed(() => {
  const k = pq.value.trim();
  if (!k) return [];
  return parcels.value.filter((f) => `${f.properties.code} ${f.properties.owner} ${f.properties.user} ${f.properties.location}`.includes(k)).slice(0, 12);
});
const lowParcels = computed(() => parcels.value.filter((f) => f.properties.cls));
const curCls = computed(() => (cur.value?.eval.cls ? CLASSES[cur.value.eval.cls] : null));
const extraBasis = computed(() => (cur.value?.startBasis && !['施工许可', '巡查记录', '企业申报'].includes(cur.value.startBasis) ? [cur.value.startBasis] : []));
const queueRows = (id) => parcels.value.filter((f) => {
  const p = f.properties;
  if (id === 'ccc') return p.ccc === 2;
  if (id === 'far') return p.started && !p.planned;
  return p.cls === 'gwy';
});

async function loadParcels() { parcels.value = (await api.get('/api/parcels')).features; }
async function choose(id) {
  pickOpen.value = false;
  cur.value = await api.get(`/api/parcels/${id}`);
  pq.value = cur.value.code;
  Object.assign(pf, {
    started: cur.value.started, startDate: cur.value.startDate || '', startBasis: cur.value.startBasis || '',
    plannedFar: cur.value.plannedFarOverride ?? '', builtFloor: cur.value.builtFloorOverride ?? '',
    ccc: cur.value.ccc, landlord: cur.value.landlord || '', tenants: cur.value.tenants.map((t) => ({ ...t })), basisFile: ''
  });
  if (route.query.parcel != id) router.replace({ query: { ...route.query, parcel: id } });
}
async function saveParcel() {
  try {
    const body = { ...pf, tenants: pf.ccc ? pf.tenants.filter((t) => t.name) : [] };
    const r = await api.patch(`/api/parcels/${cur.value.id}`, body);
    if (!r.changed) { flash('没有修改'); return; }
    const name = (c) => (c ? CLASSES[c].name : '非低效');
    flash(r.before !== r.after ? `已保存，系统自动归类：${name(r.before)} → ${name(r.after)}` : `已保存，归类不变（${name(r.after)}）`);
    await Promise.all([choose(cur.value.id), loadParcels()]);
  } catch (err) { flash(err.message); }
}

// ---------- 规则 ----------
const rf = reactive({});
const counts = ref({});
const snapshots = ref([]);
async function loadRules() {
  const [r, s] = await Promise.all([api.get('/api/rules'), api.get('/api/snapshots')]);
  Object.assign(rf, { ...r, ywjRatioPct: Math.round(r.ywjRatio * 100), basis: '' });
  snapshots.value = s;
  counts.value = s[0]?.counts || {};
}
async function saveRules() {
  try {
    const r = await api.put('/api/rules', { ywjRatio: rf.ywjRatioPct / 100, qydxMuTax: rf.qydxMuTax, qydxFar: rf.qydxFar, qydxMode: rf.qydxMode, qydxZeroTaxAsLow: rf.qydxZeroTaxAsLow, basis: rf.basis });
    flash(`已保存并重算：供而未用 ${r.counts.gwy}，用而未尽 ${r.counts.ywj}，企业低效 ${r.counts.qydx}`);
    await loadRules();
  } catch (err) { flash(err.message); }
}
async function recalcAll() { const c = await api.post('/api/recalc'); flash(`重算完成：供而未用 ${c.gwy}，用而未尽 ${c.ywj}，企业低效 ${c.qydx}`); await loadRules(); }

// ---------- 项目 ----------
const projects = ref([]);
const prf = reactive({});
function resetProject(parcelId) {
  const code = parcelId ? parcels.value.find((f) => f.id === Number(parcelId))?.properties.code : '';
  Object.assign(prf, { id: null, name: '', parcelCode: code || '', investment: null, company: '', leadUnit: '', owner: '', stage: '谋划', demo: false, monthly: '' });
}
function editProject(p) {
  Object.assign(prf, { id: p.id, name: p.name, parcelCode: p.parcel_code || '', investment: p.investment, company: p.company || '', leadUnit: p.lead_unit || '', owner: p.owner || '', stage: p.stage, demo: !!p.demo, monthly: p.monthly || '' });
}
async function loadProjects() { projects.value = await api.get('/api/projects'); }
async function saveProject() {
  const parcel = prf.parcelCode ? parcels.value.find((f) => f.properties.code === prf.parcelCode.trim()) : null;
  if (prf.parcelCode && !parcel) { flash('没有找到该地块索引号'); return; }
  const body = { name: prf.name, parcelId: parcel ? parcel.id : null, investment: prf.investment, company: prf.company, leadUnit: prf.leadUnit, owner: prf.owner, stage: prf.stage, demo: prf.demo, monthly: prf.monthly };
  try {
    const saved = prf.id ? await api.patch(`/api/projects/${prf.id}`, body) : await api.post('/api/projects', body);
    flash('项目已保存');
    await loadProjects();
    if (saved.id) editProject({ ...saved, parcel_code: parcel?.properties.code });
  } catch (err) { flash(err.message); }
}

// ---------- 数据源、变更 ----------
const sources = ref([]);
const changes = ref([]);

watch(tab, async (t) => {
  if (!parcels.value.length && (t === 'status' || t === 'project')) await loadParcels();
  if (t === 'status' && route.query.parcel && !cur.value) await choose(Number(route.query.parcel));
  if (t === 'rule') await loadRules();
  if (t === 'project') { await loadProjects(); if (!prf.name && !prf.id) resetProject(route.query.parcel); }
  if (t === 'source') sources.value = await api.get('/api/sources');
  if (t === 'log') changes.value = await api.get('/api/changes?limit=300');
}, { immediate: true });
</script>

<style scoped>
.top { align-items: flex-start; }
.stack { display: flex; flex-direction: column; gap: 16px; }
.form-col { flex: 1 1 380px; max-width: 540px; position: relative; }
.grow { flex: 999 1 560px; min-width: 0; }
.fm { display: flex; flex-direction: column; gap: 14px; margin-top: 12px; }
.radios { border: 0; padding: 0; margin: 0; display: flex; gap: 20px; align-items: center; font-size: 14px; }
.radios legend { padding: 0; margin-bottom: 6px; color: var(--ink-2); }
.chk { flex-direction: row; align-items: center; gap: 8px; align-self: end; min-height: 40px; }
.picker { position: absolute; left: 16px; right: 16px; z-index: 5; list-style: none; margin: 4px 0 0; padding: 6px; max-height: 320px; overflow: auto; background: rgba(255,255,255,0.97); }
.picker button { width: 100%; text-align: left; border: 0; background: none; padding: 8px 10px; border-radius: 10px; font: inherit; cursor: pointer; color: var(--ink); }
.picker button:hover { background: rgba(47,123,245,0.08); }
.curbox { margin-top: 12px; padding: 10px 12px; border-radius: 12px; background: rgba(47,123,245,0.06); display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.tenants { display: flex; flex-direction: column; gap: 8px; }
.trow { display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 8px; }
.note { margin: 0; padding: 10px 12px; border-radius: 12px; background: rgba(47,123,245,0.07); font-size: 13px; color: var(--ink-2); }
.seg-mini { display: flex; flex-wrap: wrap; gap: 6px; }
.seg-mini button { min-height: 36px; padding: 0 14px; border-radius: 999px; border: 1px solid rgba(47,123,245,0.2); background: rgba(255,255,255,0.8); font: inherit; cursor: pointer; color: var(--ink); }
.seg-mini button.on { background: var(--primary); border-color: var(--primary); color: #fff; }
.bar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.rules { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.rc { display: flex; flex-direction: column; gap: 10px; }
.rule { font-family: ui-monospace, Consolas, monospace; font-size: 13px; background: rgba(47,123,245,0.06); border-radius: 8px; padding: 8px 10px; }
.kp { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 12px; font-size: 13.5px; }
.kp strong { color: var(--primary); font-size: 18px; }
.code { background: #0F2347; color: #fff; padding: 12px 16px; border-radius: 12px; font-size: 13px; }
</style>
