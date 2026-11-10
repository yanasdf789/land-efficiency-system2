<template>
  <div :class="['app', { full: route.meta.full }]">
    <AppHeader />
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router';
import AppHeader from './components/AppHeader.vue';
const route = useRoute();
</script>

<style>
.app { min-height: 100vh; display: flex; flex-direction: column; }
.app.full { height: 100vh; }
.app-main { flex: 1; min-height: 0; position: relative; }
.app.full .app-header { position: absolute; left: 0; right: 0; top: 0; z-index: 10; }
</style>
