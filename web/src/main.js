import { createApp } from 'vue';
import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router';
import { IS_STATIC } from './api.js';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import App from './App.vue';
import MapView from './views/MapView.vue';
import ParcelView from './views/ParcelView.vue';
import EdgeView from './views/EdgeView.vue';
import ExportView from './views/ExportView.vue';
import DataView from './views/DataView.vue';

const router = createRouter({
  // GitHub Pages 没有服务端路由回退，演示版用 hash 路由
  history: IS_STATIC ? createWebHashHistory(import.meta.env.BASE_URL) : createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: MapView, meta: { title: '一张图', full: true } },
    { path: '/parcel/:id', component: ParcelView, meta: { title: '地块详情' } },
    { path: '/edge', component: EdgeView, meta: { title: '金角银边' } },
    { path: '/export', component: ExportView, meta: { title: '标准出图' } },
    { path: '/data', component: DataView, meta: { title: '数据管理' } }
  ]
});
router.afterEach((to) => { document.title = `${to.meta.title || ''} · 低效用地监管系统`; });

createApp(App).use(router).mount('#app');
