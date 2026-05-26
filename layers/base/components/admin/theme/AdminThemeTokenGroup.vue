<script setup lang="ts">
/**
 * Collapsible group of token rows. Renders the group header + a list of
 * AdminThemeTokenInput inside an open <details>. The "modified" count
 * badge on the header tells the user which groups they've touched.
 */
import { computed } from 'vue';
import type { TokenSpec, TokenGroup } from '@commonpub/ui';

const props = defineProps<{
  group: TokenGroup;
  label: string;
  icon: string;
  description: string;
  specs: TokenSpec[];
  tokens: Record<string, string>;
  /** Default open state. Surfaces (top group) opens by default. */
  open?: boolean;
}>();

const emit = defineEmits<{
  update: [key: string, value: string];
  reset: [key: string];
}>();

const modifiedCount = computed(() =>
  props.specs.reduce((acc, s) => acc + (props.tokens[s.key] && props.tokens[s.key] !== s.default ? 1 : 0), 0),
);
</script>

<template>
  <details class="token-group" :open="open">
    <summary class="token-group-header">
      <i :class="['fa-solid', icon, 'token-group-icon']" aria-hidden="true" />
      <div class="token-group-meta">
        <span class="token-group-label">{{ label }}</span>
        <span class="token-group-desc">{{ description }}</span>
      </div>
      <span v-if="modifiedCount > 0" class="token-group-count">{{ modifiedCount }}</span>
      <i class="fa-solid fa-chevron-right token-group-chevron" aria-hidden="true" />
    </summary>

    <div class="token-group-body">
      <AdminThemeTokenInput
        v-for="spec in specs"
        :key="spec.key"
        :spec="spec"
        :value="tokens[spec.key] ?? ''"
        @update="(v) => emit('update', spec.key, v)"
        @reset="emit('reset', spec.key)"
      />
    </div>
  </details>
</template>

<style scoped>
.token-group {
  border-bottom: var(--border-width-default) solid var(--border2);
}
.token-group:last-of-type { border-bottom: 0; }

.token-group-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-3);
  background: var(--surface);
  cursor: pointer;
  user-select: none;
  list-style: none;
}
.token-group-header::-webkit-details-marker { display: none; }
.token-group-header:hover { background: var(--surface2); }

.token-group-icon { color: var(--text-dim); font-size: 14px; width: 16px; text-align: center; flex-shrink: 0; }
.token-group-meta { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.token-group-label { font-size: var(--text-sm); font-weight: var(--font-weight-semibold); color: var(--text); }
.token-group-desc { font-size: var(--text-xs); color: var(--text-faint); line-height: var(--leading-snug); }

.token-group-count {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-wide);
  padding: 1px 6px;
  background: var(--accent-bg);
  color: var(--accent);
  border: var(--border-width-thin) solid var(--accent-border);
}

.token-group-chevron {
  font-size: 11px;
  color: var(--text-faint);
  transition: transform var(--transition-fast);
}
[open] > .token-group-header .token-group-chevron { transform: rotate(90deg); }

.token-group-body { background: var(--bg); }
</style>
