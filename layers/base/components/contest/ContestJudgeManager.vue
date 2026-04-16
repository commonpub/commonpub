<script setup lang="ts">
import type { ContestJudgeItem } from '@commonpub/server';

const props = defineProps<{
  contestSlug: string;
  isOwner: boolean;
}>();

const toast = useToast();
const { data: judges, refresh } = await useFetch<ContestJudgeItem[]>(
  `/api/contests/${props.contestSlug}/judges`,
);

const newJudgeId = ref('');
const newJudgeRole = ref<'lead' | 'judge' | 'guest'>('judge');
const adding = ref(false);

async function addJudge(): Promise<void> {
  if (!newJudgeId.value) return;
  adding.value = true;
  try {
    await $fetch(`/api/contests/${props.contestSlug}/judges`, {
      method: 'POST',
      body: { userId: newJudgeId.value, role: newJudgeRole.value },
    });
    toast.success('Judge added');
    newJudgeId.value = '';
    await refresh();
  } catch {
    toast.error('Failed to add judge');
  } finally {
    adding.value = false;
  }
}

async function removeJudge(userId: string): Promise<void> {
  if (!confirm('Remove this judge?')) return;
  try {
    await $fetch(`/api/contests/${props.contestSlug}/judges/${userId}`, { method: 'DELETE' });
    toast.success('Judge removed');
    await refresh();
  } catch {
    toast.error('Failed to remove judge');
  }
}

const roleLabels: Record<string, string> = {
  lead: 'Lead Judge',
  judge: 'Judge',
  guest: 'Guest Judge',
};
</script>

<template>
  <div class="cpub-contest-judges">
    <h3 class="cpub-judges-title">Judges</h3>

    <div v-if="judges?.length" class="cpub-judges-list">
      <div v-for="judge in judges" :key="judge.id" class="cpub-judge-row">
        <NuxtLink :to="`/u/${judge.userUsername}`" class="cpub-judge-link">
          <span class="cpub-judge-avatar">
            <img v-if="judge.userAvatar" :src="judge.userAvatar" :alt="judge.userName" />
            <span v-else>{{ judge.userName.charAt(0) }}</span>
          </span>
          <span class="cpub-judge-name">{{ judge.userName }}</span>
        </NuxtLink>
        <span class="cpub-judge-role">{{ roleLabels[judge.role] || judge.role }}</span>
        <span v-if="!judge.acceptedAt" class="cpub-judge-pending">Pending</span>
        <button v-if="isOwner" class="cpub-judge-remove" :aria-label="`Remove ${judge.userName} from judges`" @click="removeJudge(judge.userId)">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
    <p v-else class="cpub-judges-empty">No judges assigned yet.</p>

    <div v-if="isOwner" class="cpub-judges-add">
      <input v-model="newJudgeId" class="cpub-judges-input" placeholder="User ID" />
      <select v-model="newJudgeRole" class="cpub-judges-input cpub-judges-select">
        <option value="lead">Lead</option>
        <option value="judge">Judge</option>
        <option value="guest">Guest</option>
      </select>
      <button class="cpub-btn cpub-btn-sm" :disabled="adding || !newJudgeId" @click="addJudge">
        <i class="fa-solid fa-plus"></i> Add
      </button>
    </div>
  </div>
</template>

<style scoped>
.cpub-judges-title { font-family: var(--font-mono); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-faint); margin: 0 0 12px; }

.cpub-judges-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.cpub-judge-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
.cpub-judge-link { display: flex; align-items: center; gap: 8px; text-decoration: none; color: var(--text); flex: 1; min-width: 0; }
.cpub-judge-avatar { width: 24px; height: 24px; border-radius: 50%; background: var(--surface2); border: var(--border-width-default) solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; overflow: hidden; flex-shrink: 0; }
.cpub-judge-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cpub-judge-name { font-size: 12px; font-weight: 600; }
.cpub-judge-role { font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; color: var(--text-faint); }
.cpub-judge-pending { font-family: var(--font-mono); font-size: 9px; color: var(--yellow, var(--text-faint)); }
.cpub-judge-remove { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 10px; padding: 4px; }
.cpub-judge-remove:hover { color: var(--red); }

.cpub-judges-empty { font-size: 12px; color: var(--text-faint); font-style: italic; margin-bottom: 12px; }

.cpub-judges-add { display: flex; gap: 6px; align-items: center; }
.cpub-judges-input { font-size: 12px; padding: 4px 8px; border: var(--border-width-default) solid var(--border); background: var(--bg); color: var(--text); outline: none; }
.cpub-judges-input:focus { border-color: var(--accent); }
.cpub-judges-select { max-width: 100px; }
</style>
