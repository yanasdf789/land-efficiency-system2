<template>
  <header class="app-header">
    <RouterLink to="/" class="brand">
      <svg width="36" height="36" viewBox="0 0 56 56" aria-hidden="true">
        <path d="M28 6 L48 17 L48 39 L28 50 L8 39 L8 17 Z" fill="#4C93FF" opacity="0.25" />
        <path d="M28 14 L40 21 L28 28 L16 21 Z" fill="#9CC8FF" />
        <path d="M16 21 L28 28 L28 42 L16 35 Z" fill="#4C93FF" />
        <path d="M40 21 L28 28 L28 42 L40 35 Z" fill="#2F7BF5" />
      </svg>
      <span>
        <span class="name">低效用地监管系统</span>
        <span class="en">Land Efficiency Supervision</span>
      </span>
    </RouterLink>
    <nav aria-label="主导航">
      <RouterLink to="/" class="nav" exact-active-class="on">一张图</RouterLink>
      <RouterLink to="/edge" class="nav" active-class="on">金角银边</RouterLink>
      <RouterLink to="/export" class="nav" active-class="on">标准出图</RouterLink>
      <RouterLink to="/data" class="nav" active-class="on">数据管理</RouterLink>
    </nav>
    <div class="right">
      <div v-if="IS_STATIC" class="demo">
        <span>演示版 · 修改只保存在本浏览器</span>
        <button type="button" @click="reset">恢复初始数据</button>
      </div>
      <div class="date">
        <div>数据截至 {{ today }}</div>
        <div class="muted">{{ week }} · 系统自动更新</div>
      </div>
      <label class="op">
        <span class="avatar" aria-hidden="true"></span>
        <input :value="operator" placeholder="填写操作人" aria-label="操作人姓名" @change="setOperator($event.target.value)" />
      </label>
    </div>
  </header>
</template>

<script setup>
import { operator, setOperator, IS_STATIC, resetDemo } from '../api.js';
async function reset() {
  if (!confirm('清除本浏览器中的全部修改（开工、建设量、金角银边、项目、规则和变更记录），恢复为原始数据？')) return;
  await resetDemo();
  location.reload();
}
const d = new Date();
const today = d.toLocaleDateString('sv-SE');
const week = '星期' + '日一二三四五六'[d.getDay()];
</script>

<style scoped>
.app-header {
  display: flex; flex-wrap: wrap; align-items: center; gap: 24px; padding: 10px 24px;
  background: rgba(255, 255, 255, 0.5); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.9);
}
.brand { display: flex; align-items: center; gap: 10px; color: var(--ink); }
.brand > span { display: flex; flex-direction: column; }
.name { font-size: 17px; font-weight: 900; letter-spacing: 0.04em; }
nav { display: flex; flex-wrap: wrap; gap: 4px; }
.nav { color: var(--ink-2); padding: 8px 16px; border-radius: 999px; font-weight: 500; }
.nav:hover { color: var(--primary); background: rgba(255, 255, 255, 0.6); }
.nav.on { color: var(--primary); background: #fff; box-shadow: 0 4px 12px rgba(47, 123, 245, 0.14); }
.right { margin-left: auto; display: flex; align-items: center; gap: 16px; }
.date { text-align: right; font-size: 13px; font-weight: 500; }
.demo { display: flex; align-items: center; gap: 8px; padding: 4px 6px 4px 12px; border-radius: 999px; background: #FFF4D6; color: #6B4500; font-size: 12.5px; }
.demo button { border: 0; border-radius: 999px; padding: 4px 10px; background: #fff; color: #6B4500; font: inherit; cursor: pointer; }
.op { display: flex; align-items: center; gap: 8px; }
.avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #9CC8FF, #2F7BF5); }
.op input { width: 110px; min-height: 34px; border: 1px solid transparent; border-radius: 10px; background: transparent; font: inherit; font-size: 13px; color: var(--ink); padding: 0 8px; }
.op input:hover, .op input:focus { border-color: rgba(47, 123, 245, 0.25); background: rgba(255, 255, 255, 0.8); outline: none; }
</style>
