<script setup lang="ts">
interface Prize { place?: number; category?: string; title?: string; description?: string; value?: string }
defineProps<{
  prizes: Prize[];
  /** Optional intro shown above the prize cards (section-level, not per-prize). */
  description?: string | null;
  /** Block-editor intro (BlockTuple[]); rendered instead of `description` when present. */
  blocks?: unknown[] | null;
  format?: 'markdown' | 'html' | null;
}>();

function prizeLabel(prize: Prize): string {
  if (prize.category) return prize.category.toUpperCase();
  const place = prize.place;
  if (place === 1) return '1ST PLACE';
  if (place === 2) return '2ND PLACE';
  if (place === 3) return '3RD PLACE';
  if (place) return `${place}TH PLACE`;
  return 'PRIZE';
}

function prizeColor(prize: Prize): string {
  if (prize.category) return 'default';
  if (prize.place === 1) return 'gold';
  if (prize.place === 2) return 'silver';
  if (prize.place === 3) return 'bronze';
  return 'default';
}

function prizeIcon(prize: Prize): string {
  if (prize.place === 1) return 'fa-trophy';
  if (prize.place === 2) return 'fa-medal';
  if (prize.place === 3) return 'fa-award';
  return 'fa-star';
}
</script>

<template>
  <div class="cpub-prizes-section">
    <div class="cpub-sec-head">
      <h2><i class="fa fa-trophy" style="color: var(--yellow-text);"></i> Prizes</h2>
    </div>
    <BlocksBlockContentRenderer
      v-if="blocks?.length"
      :blocks="(blocks as [string, Record<string, unknown>][])"
      class="cpub-prose cpub-md cpub-prizes-intro"
    />
    <CpubMarkdown v-else-if="description" :source="description" :format="format" class="cpub-prizes-intro" />
    <div v-if="prizes.length" class="cpub-prize-grid">
      <div
        v-for="(prize, i) in prizes"
        :key="i"
        class="cpub-prize-card"
        :class="`cpub-prize-${prizeColor(prize)}`"
      >
        <div class="cpub-prize-rank" :class="`cpub-prize-rank-${prizeColor(prize)}`">{{ prizeLabel(prize) }}</div>
        <div class="cpub-prize-icon" :class="`cpub-prize-icon-${prizeColor(prize)}`"><i class="fa-solid" :class="prizeIcon(prize)"></i></div>
        <div v-if="prize.value" class="cpub-prize-amount" :class="`cpub-prize-amount-${prizeColor(prize)}`">{{ prize.value }}</div>
        <div v-if="prize.title" class="cpub-prize-title">{{ prize.title }}</div>
        <div v-if="prize.description" class="cpub-prize-desc">{{ prize.description }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-prizes-section { }

.cpub-sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.cpub-sec-head h2 { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; }

.cpub-prizes-intro { margin-bottom: 16px; }
.cpub-prize-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px; }
.cpub-prize-card { border-radius: var(--radius); padding: 20px; text-align: center; background: var(--surface); border: var(--border-width-default) solid var(--border); box-shadow: var(--shadow-md); }
.cpub-prize-gold { box-shadow: var(--shadow-accent); }

.cpub-prize-rank { font-size: 11px; font-family: var(--font-mono); font-weight: 600; letter-spacing: .08em; margin-bottom: 8px; }
.cpub-prize-rank-gold { color: var(--yellow-text); }
.cpub-prize-rank-silver { color: var(--silver); }
.cpub-prize-rank-bronze { color: var(--bronze); }
.cpub-prize-rank-default { color: var(--text-dim); }

.cpub-prize-icon { font-size: 28px; margin-bottom: 8px; }
.cpub-prize-icon-gold { color: var(--yellow-text); }
.cpub-prize-icon-silver { color: var(--silver); }
.cpub-prize-icon-bronze { color: var(--bronze); }
.cpub-prize-icon-default { color: var(--text-dim); }

.cpub-prize-amount { font-size: 24px; font-weight: 800; font-family: var(--font-mono); margin-bottom: 4px; }
.cpub-prize-amount-gold { color: var(--yellow-text); }
.cpub-prize-amount-silver { color: var(--silver); }
.cpub-prize-amount-bronze { color: var(--bronze); }
.cpub-prize-amount-default { color: var(--text-dim); }

.cpub-prize-title { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
.cpub-prize-desc { font-size: 11px; color: var(--text-dim); line-height: 1.5; }

@media (max-width: 768px) { .cpub-prize-grid { grid-template-columns: 1fr; } }
</style>
