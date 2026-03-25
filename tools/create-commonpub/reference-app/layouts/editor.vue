<script setup lang="ts">
const route = useRoute();
</script>

<template>
  <div class="cpub-editor-layout">
    <header class="cpub-editor-topbar">
      <NuxtLink to="/" class="cpub-editor-logo" aria-label="Home">
        <span class="cpub-editor-logo-accent">[</span>cpub<span class="cpub-editor-logo-accent">]</span>
      </NuxtLink>

      <button class="cpub-editor-back" aria-label="Go back" @click="$router.back()">
        ←
      </button>

      <div class="cpub-editor-topbar-divider" aria-hidden="true" />

      <div class="cpub-editor-topbar-title-wrap">
        <slot name="title" />
      </div>

      <div class="cpub-editor-topbar-spacer" />

      <slot name="mode-tabs" />

      <div class="cpub-editor-topbar-actions">
        <slot name="actions" />
      </div>
    </header>

    <div class="cpub-editor-shell">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.cpub-editor-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.cpub-editor-topbar {
  height: 48px;
  background: var(--surface);
  border-bottom: var(--border-width-default) solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 var(--space-4);
  gap: 0;
  flex-shrink: 0;
  z-index: var(--z-sticky);
}

.cpub-editor-logo {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-bold);
  color: var(--text-dim);
  letter-spacing: 0.06em;
  text-decoration: none;
  flex-shrink: 0;
}

.cpub-editor-logo-accent {
  color: var(--accent);
}

.cpub-editor-back {
  width: 30px;
  height: 30px;
  background: none;
  border: var(--border-width-default) solid transparent;
  color: var(--text-dim);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  margin-left: var(--space-2);
  flex-shrink: 0;
}

.cpub-editor-back:hover {
  background: var(--surface2);
  border-color: var(--border2);
  color: var(--text);
}

.cpub-editor-back:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.cpub-editor-topbar-divider {
  width: 2px;
  height: 22px;
  background: var(--border);
  margin: 0 var(--space-3);
  flex-shrink: 0;
}

.cpub-editor-topbar-title-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.cpub-editor-topbar-spacer {
  flex: 1;
}

.cpub-editor-topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.cpub-editor-shell {
  display: flex;
  flex: 1;
  overflow: hidden;
}
</style>
