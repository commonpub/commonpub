<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{ content: Record<string, unknown> }>();

interface Card {
  front: string;
  back: string;
  icon?: string;
  category?: string;
}

const cards = computed<Card[]>(() => {
  const raw = props.content.cards;
  if (!Array.isArray(raw)) return [];
  return raw as Card[];
});

const columns = computed(() => (props.content.columns as number) ?? 3);
const revealed = ref<Set<number>>(new Set());

function toggleCard(index: number): void {
  const s = new Set(revealed.value);
  if (s.has(index)) s.delete(index);
  else s.add(index);
  revealed.value = s;
}

function resetCards(): void {
  revealed.value = new Set();
}
</script>

<template>
  <div class="cpub-reveal-cards">
    <div class="cpub-reveal-grid" :style="{ gridTemplateColumns: `repeat(${columns}, 1fr)` }">
      <button
        v-for="(card, i) in cards"
        :key="i"
        class="cpub-reveal-card"
        :class="{ 'cpub-reveal-card-revealed': revealed.has(i) }"
        @click="toggleCard(i)"
      >
        <div v-if="!revealed.has(i)" class="cpub-reveal-front">
          <i :class="card.icon ? `fa-solid fa-${card.icon}` : 'fa-solid fa-question'" />
          <span>{{ card.front }}</span>
        </div>
        <div v-else class="cpub-reveal-back">
          <strong v-if="card.category" class="cpub-reveal-category" :class="`cpub-cat-${card.category}`">
            {{ card.category }}
          </strong>
          <span>{{ card.back }}</span>
        </div>
      </button>
    </div>

    <div v-if="revealed.size > 0" class="cpub-reveal-actions">
      <button class="cpub-reveal-reset" @click="resetCards">
        <i class="fa-solid fa-rotate-left" /> Reset
      </button>
      <span class="cpub-reveal-count">{{ revealed.size }}/{{ cards.length }} revealed</span>
    </div>
  </div>
</template>

<style scoped>
.cpub-reveal-cards {
  padding: 16px;
}

.cpub-reveal-grid {
  display: grid;
  gap: 8px;
}

.cpub-reveal-card {
  padding: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: var(--border-width-default, 2px) solid var(--border-dark, rgba(255, 255, 255, 0.08));
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cpub-reveal-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
}

.cpub-reveal-card-revealed {
  background: rgba(255, 255, 255, 0.06);
}

.cpub-reveal-front {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-on-dark-dim, rgba(255, 255, 255, 0.45));
  font-size: 13px;
}

.cpub-reveal-front i {
  font-size: 18px;
  opacity: 0.4;
}

.cpub-reveal-back {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-on-dark, rgba(255, 255, 255, 0.85));
  animation: cpub-reveal-flip 0.3s ease;
}

.cpub-reveal-category {
  font-family: var(--font-ui, monospace);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 2px 8px;
}

.cpub-cat-positive { color: var(--accent); background: var(--accent-light); }
.cpub-cat-negative { color: var(--success, #2a9d5c); background: rgba(42, 157, 92, 0.1); }

.cpub-reveal-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: var(--border-width-default, 2px) solid var(--border-dark, rgba(255, 255, 255, 0.05));
}

.cpub-reveal-reset {
  padding: 5px 12px;
  font-family: var(--font-ui, monospace);
  font-size: 10px;
  background: transparent;
  border: var(--border-width-default, 2px) solid var(--border-dark, rgba(255, 255, 255, 0.1));
  color: var(--text-on-dark-dim, rgba(255, 255, 255, 0.4));
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cpub-reveal-reset:hover {
  color: var(--text-on-dark, #fff);
  border-color: rgba(255, 255, 255, 0.2);
}

.cpub-reveal-count {
  font-family: var(--font-ui, monospace);
  font-size: 10px;
  color: var(--text-on-dark-faint, rgba(255, 255, 255, 0.2));
}

@keyframes cpub-reveal-flip {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@media (max-width: 768px) {
  .cpub-reveal-grid {
    grid-template-columns: 1fr !important;
  }
}
</style>
