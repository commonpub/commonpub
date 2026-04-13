<script setup lang="ts">
defineProps<{
  prizes: Array<{ place: number; title: string; description?: string; value?: string }>;
}>();

function placeLabel(place: number): string {
  if (place === 1) return '1ST PLACE';
  if (place === 2) return '2ND PLACE';
  if (place === 3) return '3RD PLACE';
  return `${place}TH PLACE`;
}

function placeColor(place: number): string {
  if (place === 1) return 'gold';
  if (place === 2) return 'silver';
  if (place === 3) return 'bronze';
  return 'default';
}

function placeIcon(place: number): string {
  if (place === 1) return 'fa-trophy';
  if (place === 2) return 'fa-medal';
  if (place === 3) return 'fa-award';
  return 'fa-star';
}
</script>

<template>
  <div class="cpub-prizes-section">
    <div class="cpub-sec-head">
      <h2><i class="fa fa-trophy" style="color: var(--yellow);"></i> Prizes</h2>
    </div>
    <div class="cpub-prize-grid">
      <div
        v-for="prize in prizes"
        :key="prize.place"
        class="cpub-prize-card"
        :class="`cpub-prize-${placeColor(prize.place)}`"
      >
        <div class="cpub-prize-rank" :class="`cpub-prize-rank-${placeColor(prize.place)}`">{{ placeLabel(prize.place) }}</div>
        <div class="cpub-prize-icon" :class="`cpub-prize-icon-${placeColor(prize.place)}`"><i class="fa-solid" :class="placeIcon(prize.place)"></i></div>
        <div v-if="prize.value" class="cpub-prize-amount" :class="`cpub-prize-amount-${placeColor(prize.place)}`">{{ prize.value }}</div>
        <div class="cpub-prize-title">{{ prize.title }}</div>
        <div v-if="prize.description" class="cpub-prize-desc">{{ prize.description }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-prizes-section { --silver: var(--text-faint); --bronze: #a0724a; }

.cpub-sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.cpub-sec-head h2 { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; }

.cpub-prize-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px; }
.cpub-prize-card { border-radius: var(--radius); padding: 20px; text-align: center; background: var(--surface); border: var(--border-width-default) solid var(--border); box-shadow: var(--shadow-md); }
.cpub-prize-gold { box-shadow: var(--shadow-accent); }

.cpub-prize-rank { font-size: 11px; font-family: var(--font-mono); font-weight: 600; letter-spacing: .08em; margin-bottom: 8px; }
.cpub-prize-rank-gold { color: var(--yellow); }
.cpub-prize-rank-silver { color: var(--silver); }
.cpub-prize-rank-bronze { color: var(--bronze); }
.cpub-prize-rank-default { color: var(--text-dim); }

.cpub-prize-icon { font-size: 28px; margin-bottom: 8px; }
.cpub-prize-icon-gold { color: var(--yellow); }
.cpub-prize-icon-silver { color: var(--silver); }
.cpub-prize-icon-bronze { color: var(--bronze); }
.cpub-prize-icon-default { color: var(--text-dim); }

.cpub-prize-amount { font-size: 24px; font-weight: 800; font-family: var(--font-mono); margin-bottom: 4px; }
.cpub-prize-amount-gold { color: var(--yellow); }
.cpub-prize-amount-silver { color: var(--silver); }
.cpub-prize-amount-bronze { color: var(--bronze); }
.cpub-prize-amount-default { color: var(--text-dim); }

.cpub-prize-title { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
.cpub-prize-desc { font-size: 11px; color: var(--text-dim); line-height: 1.5; }

@media (max-width: 768px) { .cpub-prize-grid { grid-template-columns: 1fr; } }
</style>
