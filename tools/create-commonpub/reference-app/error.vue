<script setup lang="ts">
const props = defineProps<{
  error: {
    statusCode: number;
    statusMessage?: string;
    message?: string;
  };
}>();

useSeoMeta({ title: `${props.error.statusCode} — CommonPub` });

const isNotFound = computed(() => props.error.statusCode === 404);

function handleBack(): void {
  clearError({ redirect: '/' });
}
</script>

<template>
  <div class="cpub-error-page">
    <div class="cpub-error-grid" />
    <div class="cpub-error-inner">
      <div class="cpub-error-code">{{ error.statusCode }}</div>
      <h1 class="cpub-error-title">
        {{ isNotFound ? 'Page not found' : 'Something went wrong' }}
      </h1>
      <p class="cpub-error-desc">
        {{ isNotFound ? "The page you're looking for doesn't exist or has been moved." : (error.statusMessage || error.message || 'An unexpected error occurred.') }}
      </p>
      <div class="cpub-error-actions">
        <button class="cpub-error-btn cpub-error-btn-primary" @click="handleBack">
          <i class="fa-solid fa-house"></i> Go Home
        </button>
        <NuxtLink to="/search" class="cpub-error-btn">
          <i class="fa-solid fa-magnifying-glass"></i> Search
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-error-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg, #fafaf9);
  position: relative;
  overflow: hidden;
}

.cpub-error-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(var(--border2, #d4d4d0) 1px, transparent 1px),
    linear-gradient(90deg, var(--border2, #d4d4d0) 1px, transparent 1px);
  background-size: 40px 40px;
  opacity: 0.15;
}

.cpub-error-inner {
  position: relative; z-index: 1;
  text-align: center;
  padding: 32px;
  max-width: 480px;
}

.cpub-error-code {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 80px;
  font-weight: 700;
  color: var(--accent, #5b9cf6);
  line-height: 1;
  margin-bottom: 12px;
  letter-spacing: -0.04em;
}

.cpub-error-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text, #1a1a1a);
  margin-bottom: 10px;
}

.cpub-error-desc {
  font-size: 13px;
  color: var(--text-dim, #6b6b66);
  line-height: 1.6;
  margin-bottom: 28px;
}

.cpub-error-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.cpub-error-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  font-size: 12px;
  font-weight: 500;
  border: 2px solid var(--border, #1a1a1a);
  background: var(--surface, #fff);
  color: var(--text, #1a1a1a);
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.cpub-error-btn:hover {
  box-shadow: 2px 2px 0 var(--border, #1a1a1a);
}

.cpub-error-btn-primary {
  background: var(--accent, #5b9cf6);
  color: #fff;
  box-shadow: 4px 4px 0 var(--border, #1a1a1a);
}

.cpub-error-btn-primary:hover {
  box-shadow: 6px 6px 0 var(--border, #1a1a1a);
  transform: translate(-1px, -1px);
}
</style>
