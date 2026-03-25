<script setup lang="ts">
const progress = ref(0);

function handleScroll(): void {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  progress.value = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});
</script>

<template>
  <div class="cpub-progress-tracker" role="progressbar" :aria-valuenow="Math.round(progress)" aria-valuemin="0" aria-valuemax="100">
    <div class="cpub-progress-fill" :style="{ width: progress + '%' }"></div>
  </div>
</template>

<style scoped>
.cpub-progress-tracker {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--surface2);
  z-index: 1000;
}

.cpub-progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.1s;
}
</style>
