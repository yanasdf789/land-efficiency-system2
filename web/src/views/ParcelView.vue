<template>
  <div class="page">
    <div v-if="error" class="glass panel empty">{{ error }}</div>
    <template v-else-if="d">
      <div class="page-head">
        <RouterLink :to="`/?parcel=${d.id}`" class="muted">← 返回一张图</RouterLink>
        <h1>地块 {{ d.code }}</h1>
        <span v-if="cls" class="tag" :style="{ color: cls.color, background: cls.color + '1f' }">{{ cls.short }} {{ cls.name }}</span>
        <span v-else class="tag">非低效</span>
        <span v-if="d.ccc" class="tag">{{ d.ccc === 2 ? '疑似厂中厂（待核实）' : '厂中厂' }}</span>
        <span class="muted">归类由系统按开工标记、建设量和效益指标自动计算</span>
        <div class="spacer row" style="gap:8px">
          <RouterLink class="btn" :to="`/data?parcel=${d.id}`">更新开工 / 建设量 / 厂中厂</RouterLink>
          <RouterLink class="btn pri" :to="`/?parcel=${d.id}`">在地图上定位</RouterLink>
        </div>
      </div>

      <div class="cards">
        <section class="glass panel">
          <h2 class="h">基本信息</h2>
          <div class="mm"><MiniMap :features="[{ type: 'Feature', geometry: d.geometry, properties: { color: cls?.color } }]" :padding="60" /></div>
          <dl class="kv">
            <dt>地块索引号</dt><dd>{{ d.code }}</dd>
            <dt>坐落</dt><dd>{{ p.TDZL || '—' }}</dd>
            <dt>所在村 / 社区</dt><dd>{{ p.SZC }}</dd>
            <dt>用地面积</dt><dd>{{ fmt.n(e.areaMu, 2) }} 亩（{{ fmt.n(e.area) }} m²）</dd>
            <dt>土地用途</dt><dd>{{ p.SJYT || p.PZYT }}</dd>
            <dt>权属性质</dt><dd>{{ p.QSXZ }}</dd>
            <dt>是否供地</dt><dd>{{ p.SFGD }}</dd>
            <dt>用地批准时间</dt><dd>{{ fmt.date(p.YDPZSJ) }}</dd>
            <dt>土地权利人</dt><dd>{{ p.TDQLR }}</dd>
            <dt>不动产权证</dt><dd>{{ p.BDCQZH || '—' }}</dd>
          </dl>
        </section>

        <section class="glass panel">
          <h2 class="h">建设情况</h2>
          <div class="kpi3">
            <div><div class="muted">应建建筑面积</div><div class="num">{{ e.planned ? fmt.n(e.planned) : '—' }} <small>m²</small></div></div>
            <div><div class="muted">已建建筑面积</div><div class="num">{{ fmt.n(e.built) }} <small>m²</small></div></div>
            <div><div class="muted">剩余规模</div><div class="num" :style="{ color: CLASSES.ywj.color }">{{ e.remaining != null ? fmt.n(e.remaining) : '—' }} <small>m²</small></div></div>
          </div>
          <div v-if="e.planned" class="progress plain"><span :style="{ width: Math.min(100, (e.built / e.planned) * 100) + '%' }"></span><i :style="{ left: d.rules.ywjRatio * 100 + '%' }"></i></div>
          <div v-if="e.planned" class="muted" style="margin:6px 0 14px">已建 / 应建 = {{ Math.round((e.built / e.planned) * 100) }}%，竖线为用而未尽判定线 {{ Math.round(d.rules.ywjRatio * 100) }}%</div>
          <div v-else class="muted" style="margin:6px 0 14px">缺少规划容积率，无法计算应建规模，请在数据管理中补录</div>
          <dl class="kv">
            <dt>开工标记</dt><dd>{{ d.started ? '已开工' : '未开工' }}{{ d.startDate ? ` · ${fmt.date(d.startDate)}` : '' }}</dd>
            <dt>开工依据</dt><dd>{{ d.startBasis || '—' }}</dd>
            <dt>约定开工 / 竣工</dt><dd>{{ fmt.date(p.YDKGSJ) }} / {{ fmt.date(p.YDJGSJ) }}</dd>
            <dt>实际竣工</dt><dd>{{ fmt.date(p.SJJGSJ) }}</dd>
            <dt>规划 / 实际容积率</dt><dd>{{ e.plannedFar ?? '—' }} / {{ fmt.n(e.far, 2) }}</dd>
            <dt>规划 / 实际建筑密度</dt><dd>{{ p.GHJZMD || '—' }} / {{ p.SJJZMD || '—' }}</dd>
          </dl>
        </section>

        <section class="glass panel">
          <h2 class="h">效益指标（企业低效判定）</h2>
          <table>
            <thead><tr><th>指标</th><th>本地块</th><th>判定阈值</th><th>结论</th></tr></thead>
            <tbody>
              <tr><td>亩均税收</td><td>{{ fmt.n(e.muTax, 2) }} 万元/亩</td><td>&lt; {{ d.rules.qydxMuTax }}</td><td>{{ taxLow ? '低于阈值' : '达标' }}</td></tr>
              <tr><td>实际容积率</td><td>{{ fmt.n(e.far, 2) }}</td><td>&lt; {{ d.rules.qydxFar }}</td><td>{{ e.far < d.rules.qydxFar ? '低于阈值' : '达标' }}</td></tr>
              <tr><td>地均营收</td><td>{{ fmt.n(p['地均营'], 1) }}</td><td>—</td><td>参考</td></tr>
              <tr><td>约定亩均税收</td><td>{{ p.YDMJSS ? fmt.n(p.YDMJSS, 1) : '—' }}</td><td>—</td><td>参考</td></tr>
            </tbody>
          </table>
          <div class="reason">
            <strong>归类结论：</strong>{{ cls ? cls.name : '非低效' }}
            <ul v-if="e.reasons.length"><li v-for="r in e.reasons" :key="r">{{ r }}</li></ul>
          </div>
          <div class="muted">判定规则在“数据管理 › 规则与重算”中维护（{{ d.rules.qydxMode === 'and' ? '两项都低于阈值' : '任一项低于阈值' }}）</div>
        </section>

        <section class="glass panel">
          <h2 class="h">厂中厂（出租情况）</h2>
          <dl class="kv">
            <dt>状态</dt><dd>{{ ['否', '是', '疑似，待核实'][d.ccc] }}</dd>
            <dt>土地权利人</dt><dd>{{ p.TDQLR }}</dd>
            <dt>使用权利人</dt><dd>{{ p['权利人'] || '—' }}</dd>
            <dt>出租方</dt><dd>{{ d.landlord || '—' }}</dd>
          </dl>
          <table v-if="d.tenants.length" style="margin-top:10px">
            <thead><tr><th>承租方</th><th>租赁面积</th><th>用途</th></tr></thead>
            <tbody><tr v-for="(t, i) in d.tenants" :key="i"><td>{{ t.name }}</td><td>{{ t.area ? t.area + ' m²' : '—' }}</td><td>{{ t.use || '—' }}</td></tr></tbody>
          </table>
          <div v-if="d.ccc === 2" class="muted" style="margin-top:8px">土地权利人与使用权利人不一致，系统自动标为疑似厂中厂，请核实后在数据管理中确认。</div>
        </section>

        <section class="glass panel">
          <h2 class="h">关联项目</h2>
          <dl v-if="d.project" class="kv">
            <dt>项目名称</dt><dd>{{ d.project.name }}</dd>
            <dt>牵头单位 / 责任人</dt><dd>{{ d.project.lead_unit || '—' }} / {{ d.project.owner || '—' }}</dd>
            <dt>投资额</dt><dd>{{ d.project.investment != null ? d.project.investment + ' 亿元' : '—' }}</dd>
            <dt>引进企业</dt><dd>{{ d.project.company || '—' }}</dd>
            <dt>当前节点</dt><dd>{{ d.project.stage }}</dd>
            <dt>本月工作</dt><dd>{{ d.project.monthly || '—' }}</dd>
          </dl>
          <div v-else class="muted">暂无关联项目</div>
          <RouterLink :to="`/data?tab=project&parcel=${d.id}`" style="display:inline-block;margin-top:12px">在数据管理中{{ d.project ? '更新' : '登记' }}项目 →</RouterLink>
        </section>

        <section class="glass panel">
          <h2 class="h">变更历史</h2>
          <ol v-if="d.history.length" class="hist">
            <li v-for="c in d.history" :key="c.id"><strong>{{ fmt.time(c.at) }}</strong> {{ c.summary }} <span class="muted">· {{ c.operator }}</span></li>
          </ol>
          <div v-else class="muted">暂无人工变更；地块数据来自 {{ fmt.date(p.YDPZSJ) !== '—' ? '工业用地数据库' : '工业用地数据库' }} 导入</div>
        </section>
      </div>
    </template>
    <div v-else class="glass panel empty">加载中…</div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api, CLASSES, fmt } from '../api.js';
import MiniMap from '../components/MiniMap.vue';

const route = useRoute();
const d = ref(null);
const error = ref('');
const p = computed(() => d.value?.props || {});
const e = computed(() => d.value?.eval || {});
const cls = computed(() => (e.value.cls ? CLASSES[e.value.cls] : null));
const taxLow = computed(() => (e.value.muTax > 0 ? e.value.muTax < d.value.rules.qydxMuTax : d.value.rules.qydxZeroTaxAsLow));

async function load() {
  error.value = '';
  d.value = null;
  try { d.value = await api.get(`/api/parcels/${route.params.id}`); } catch (err) { error.value = err.message; }
}
watch(() => route.params.id, load, { immediate: true });
</script>

<style scoped>
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 16px; }
.mm { height: 200px; margin-bottom: 14px; }
.kv { display: grid; grid-template-columns: 130px 1fr; gap: 8px 12px; margin: 0; font-size: 13.5px; }
.kv dt { color: var(--muted); }
.kv dd { margin: 0; }
.kpi3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.num { font-size: 22px; font-weight: 700; }
.num small { font-size: 12px; font-weight: 400; color: var(--muted); }
.progress.plain > span { background: linear-gradient(90deg, #988DF5, var(--ywj)); }
.reason { margin: 14px 0 8px; padding: 10px 12px; border-radius: 12px; background: rgba(47, 123, 245, 0.07); font-size: 13.5px; }
.reason ul { margin: 6px 0 0; padding-left: 18px; }
.hist { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
</style>
