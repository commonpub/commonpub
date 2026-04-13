<script setup lang="ts">
const props = defineProps<{
  judgeIds: string[];
}>();

interface JudgeInfo {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

const { data: judgesData } = useLazyFetch<{ items: JudgeInfo[] }>('/api/users', {
  query: computed(() => ({ ids: props.judgeIds.join(','), limit: 50 })),
  immediate: props.judgeIds.length > 0,
});

const judges = computed<JudgeInfo[]>(() => judgesData.value?.items ?? []);
</script>

<template>
  <div v-if="judgeIds.length > 0" class="cpub-judges-section">
    <div class="cpub-sec-head">
      <h2><i class="fa-solid fa-gavel" style="color: var(--accent);"></i> Judges</h2>
    </div>
    <div class="cpub-judges-grid">
      <div v-for="judge in judges" :key="judge.id" class="cpub-judge-card">
        <div class="cpub-judge-av">
          <img v-if="judge.avatarUrl" :src="judge.avatarUrl" :alt="judge.displayName || judge.username" class="cpub-judge-av-img" />
          <span v-else>{{ (judge.displayName || judge.username || '?').charAt(0).toUpperCase() }}</span>
        </div>
        <NuxtLink :to="`/u/${judge.username}`" class="cpub-judge-name">{{ judge.displayName || judge.username }}</NuxtLink>
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
.cpub-judge-name { font-size: 11px; font-weight: 600; color: var(--text); text-decoration: none; }
.cpub-judge-name:hover { color: var(--accent); }

@media (max-width: 768px) { .cpub-judges-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 480px) { .cpub-judges-grid { grid-template-columns: 1fr; } }
</style>
