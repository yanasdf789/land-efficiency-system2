<template>
  <div ref="el" class="minimap"></div>
</template>

<script setup>
// 小地图：显示一个或多个要素，可选点击回调
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import { loadBaseStyle } from '../map/basemap.js';

const props = defineProps({
  features: { type: Array, default: () => [] },   // GeoJSON Feature[]，properties.color 决定颜色
  highlight: { type: [Number, String], default: null },
  preserve: { type: Boolean, default: false },     // 出图时需要保留绘制缓冲区
  padding: { type: Number, default: 40 }
});
const emit = defineEmits(['ready', 'pick']);
const el = ref(null);
let map = null;

function update(fit = true) {
  if (!map || !map.getSource('f')) return;
  map.getSource('f').setData({ type: 'FeatureCollection', features: props.features });
  map.setFilter('f-hl', ['==', ['get', 'fid'], props.highlight ?? '__none']);
  if (fit && props.features.length) {
    const b = turf.bbox({ type: 'FeatureCollection', features: props.features });
    map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: props.padding, maxZoom: 17, duration: 0 });
  }
}

onMounted(async () => {
  const style = await loadBaseStyle();
  map = new maplibregl.Map({ container: el.value, style, center: [121.235, 30.308], zoom: 12, attributionControl: { compact: true }, canvasContextAttributes: { preserveDrawingBuffer: props.preserve } });
  map.once('style.load', () => {
    map.addSource('f', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'f-fill', type: 'fill', source: 'f', paint: { 'fill-color': ['coalesce', ['get', 'color'], '#2F7BF5'], 'fill-opacity': 0.42 } });
    map.addLayer({ id: 'f-line', type: 'line', source: 'f', paint: { 'line-color': ['coalesce', ['get', 'color'], '#2F7BF5'], 'line-width': 1.5 } });
    map.addLayer({ id: 'f-hl', type: 'line', source: 'f', filter: ['==', ['get', 'fid'], '__none'], paint: { 'line-color': '#2F7BF5', 'line-width': 4 } });
    update();
    emit('ready', map);
  });
  map.on('click', 'f-fill', (e) => emit('pick', e.features[0].properties.fid));
  map.on('mouseenter', 'f-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'f-fill', () => { map.getCanvas().style.cursor = ''; });
});
onBeforeUnmount(() => map?.remove());
watch(() => props.features, () => update(true));
watch(() => props.highlight, () => update(false));
defineExpose({ getMap: () => map, refit: () => update(true) });
</script>

<style scoped>
.minimap { width: 100%; height: 100%; min-height: 200px; border-radius: 14px; overflow: hidden; }
</style>
