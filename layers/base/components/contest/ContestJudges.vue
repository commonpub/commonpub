<script setup lang="ts">
import type { ContestJudgeItem } from '@commonpub/server';

defineProps<{
  judges: ContestJudgeItem[];
}>();

const roleLabels: Record<string, string> = {
  lead: 'Lead Judge',
  judge: 'Judge',
  guest: 'Guest Judge',
};
</script>

<template>
  <div v-if="judges.length > 0" class="cpub-judges-section">
    <div class="cpub-sec-head">
      <h2><i class="fa-solid fa-gavel" style="color: var(--accent);"></i> Judges</h2>
    </div>
    <div class="cpub-judges-grid">
      <div v-for="judge in judges" :key="judge.id" class="cpub-judge-card">
        <div class="cpub-judge-av">
          <img v-if="judge.userAvatar" :src="judge.userAvatar" :alt="judge.userName" class="cpub-judge-av-img" />
          <span v-else>{{ (judge.userName || '?').charAt(0).toUpperCase() }}</span>
        </div>
        <NuxtLink :to="`/u/${judge.userUsername}`" class="cpub-judge-name">{{ judge.userName }}</NuxtLink>
        <div class="cpub-judge-role">{{ roleLabels[judge.role] || judge.role }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.cpub-sec-head h2 { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; }

.cpub-judges-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
.cpub-judge-card { background: var(--surface); border: var(--border-width-default) solid var(--border); border-radius: var(--radius); padding: 14px; text-align: center; box-shadow: var(--shadow-md); }
.cpub-judge-av { width: 44px; height: 44px; border-radius: 50%; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; font-family: var(--font-mono); border: var(--border-width-default) solid var(--border); background: var(--surface3); color: var(--text-dim); overflow: hidden; }
.cpub-judge-av-img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
.cpub-judge-name { font-size: 11px; font-weight: 600; color: var(--text); text-decoration: none; display: block; }
.cpub-judge-name:hover { color: var(--accent); }
.cpub-judge-role { font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-faint); margin-top: 3px; }

@media (max-width: 768px) { .cpub-judges-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 480px) { .cpub-judges-grid { grid-template-columns: 1fr; } }
</style>
