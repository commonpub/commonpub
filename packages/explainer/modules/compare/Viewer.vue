<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ content: Record<string, unknown> }>();

const doTitle = computed(() => (props.content.doTitle as string) || 'Do');
const dontTitle = computed(() => (props.content.dontTitle as string) || 'Don\'t');
const doItems = computed<string[]>(() => {
  const raw = props.content.doItems;
  return Array.isArray(raw) ? raw as string[] : [];
});
const dontItems = computed<string[]>(() => {
  const raw = props.content.dontItems;
  return Array.isArray(raw) ? raw as string[] : [];
});
</script>

<template>
  <div class="cpub-compare-module">
    <div class="cpub-compare-grid">
      <!-- DO column -->
      <div class="cpub-compare-col cpub-compare-good">
        <div class="cpub-compare-header">
          <i class="fa-solid fa-check" />
          <span>{{ doTitle }}</span>
        </div>
        <ul class="cpub-compare-list">
          <li v-for="(item, i) in doItems" :key="i">{{ item }}</li>
        </ul>
        <p v-if="!doItems.length" class="cpub-compare-empty">No items added</p>
      </div>

      <!-- DON'T column -->
      <div class="cpub-compare-col cpub-compare-bad">
        <div class="cpub-compare-header">
          <i class="fa-solid fa-xmark" />
          <span>{{ dontTitle }}</span>
        </div>
        <ul class="cpub-compare-list">
          <li v-for="(item, i) in dontItems" :key="i">{{ item }}</li>
        </ul>
        <p v-if="!dontItems.length" class="cpub-compare-empty">No items added</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-compare-module { padding: 16px; }

.cpub-compare-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
}

.cpub-compare-col {
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
}

.cpub-compare-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-ui, monospace);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid currentColor;
}

.cpub-compare-good { color: var(--success, #2a9d5c); }
.cpub-compare-bad { color: var(--error, #e04030); }

.cpub-compare-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cpub-compare-list li {
  font-size: 13px;
  color: var(--text-on-dark-dim, rgba(255, 255, 255, 0.55));
  padding-left: 16px;
  position: relative;
  line-height: 1.5;
}

.cpub-compare-good .cpub-compare-list li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--success, #2a9d5c);
  font-weight: 700;
}

.cpub-compare-bad .cpub-compare-list li::before {
  content: '✗';
  position: absolute;
  left: 0;
  color: var(--error, #e04030);
  font-weight: 700;
}

.cpub-compare-empty {
  font-size: 12px;
  color: var(--text-on-dark-faint, rgba(255, 255, 255, 0.2));
  font-style: italic;
}

@media (max-width: 640px) {
  .cpub-compare-grid { grid-template-columns: 1fr; }
}
</style>
