<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{ content: Record<string, unknown> }>();

interface Card {
  title: string;
  icon?: string;
  description: string;
  detail: string;
}

const cards = computed<Card[]>(() => {
  const raw = props.content.cards;
  return Array.isArray(raw) ? raw as Card[] : [];
});

const expandedIndex = ref<number | null>(null);

function toggleCard(idx: number): void {
  expandedIndex.value = expandedIndex.value === idx ? null : idx;
}
</script>

<template>
  <div class="cpub-clickable-cards">
    <div class="cpub-cc-grid">
      <button
        v-for="(card, i) in cards"
        :key="i"
        class="cpub-cc-card"
        :class="{ 'cpub-cc-card-active': expandedIndex === i }"
        @click="toggleCard(i)"
      >
        <i v-if="card.icon" :class="`fa-solid fa-${card.icon}`" class="cpub-cc-icon" />
        <span class="cpub-cc-title">{{ card.title }}</span>
        <span class="cpub-cc-desc">{{ card.description }}</span>
      </button>
    </div>

    <!-- Detail panel -->
    <div v-if="expandedIndex !== null && cards[expandedIndex]" class="cpub-cc-detail">
      <div class="cpub-cc-detail-header">
        <span class="cpub-cc-detail-title">{{ cards[expandedIndex]!.title }}</span>
        <button class="cpub-cc-detail-close" @click="expandedIndex = null">
          <i class="fa-solid fa-xmark" />
        </button>
      </div>
      <div class="cpub-cc-detail-body" v-html="cards[expandedIndex]!.detail" />
    </div>
  </div>
</template>

<style scoped>
.cpub-clickable-cards { padding: 16px; }

.cpub-cc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 6px;
}

.cpub-cc-card {
  padding: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: var(--border-width-default, 2px) solid var(--border-dark, rgba(255, 255, 255, 0.08));
  cursor: pointer;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: all 0.15s;
}

.cpub-cc-card:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.cpub-cc-card-active {
  border-color: var(--accent, #e04030);
  background: rgba(255, 255, 255, 0.06);
}

.cpub-cc-icon {
  font-size: 18px;
  color: var(--accent, #e04030);
  margin-bottom: 4px;
}

.cpub-cc-title {
  font-family: var(--font-ui, monospace);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-on-dark, rgba(255, 255, 255, 0.85));
}

.cpub-cc-desc {
  font-size: 11px;
  color: var(--text-on-dark-dim, rgba(255, 255, 255, 0.45));
  line-height: 1.4;
}

.cpub-cc-detail {
  margin-top: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: var(--border-width-default, 2px) solid var(--border-dark, rgba(255, 255, 255, 0.08));
  border-left: 3px solid var(--accent, #e04030);
  animation: cpub-cc-expand 0.2s ease;
}

.cpub-cc-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: var(--border-width-default, 2px) solid var(--border-dark, rgba(255, 255, 255, 0.06));
}

.cpub-cc-detail-title {
  font-family: var(--font-ui, monospace);
  font-size: 12px;
  font-weight: 700;
  color: var(--accent, #e04030);
}

.cpub-cc-detail-close {
  background: none;
  border: none;
  color: var(--text-on-dark-faint, rgba(255, 255, 255, 0.2));
  cursor: pointer;
  font-size: 12px;
}

.cpub-cc-detail-body {
  padding: 12px 14px;
  font-size: 13px;
  color: var(--text-on-dark-dim, rgba(255, 255, 255, 0.55));
  line-height: 1.6;
}

@keyframes cpub-cc-expand {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 640px) {
  .cpub-cc-grid { grid-template-columns: 1fr; }
}
</style>
