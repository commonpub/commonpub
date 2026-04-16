<script setup lang="ts">
import type { ContestJudgeItem } from '@commonpub/server';

const props = defineProps<{
  contestSlug: string;
  isOwner: boolean;
}>();

const toast = useToast();
const { data: judges, refresh } = useLazyFetch<ContestJudgeItem[]>(
  `/api/contests/${props.contestSlug}/judges`,
);

// User search for adding judges
const searchQuery = ref('');
const searchResults = ref<Array<{ id: string; username: string; displayName: string | null; avatarUrl: string | null }>>([]);
const searching = ref(false);
const newJudgeRole = ref<'lead' | 'judge' | 'guest'>('judge');
const adding = ref(false);
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

function handleSearch(): void {
  if (searchTimeout) clearTimeout(searchTimeout);
  if (!searchQuery.value || searchQuery.value.length < 2) {
    searchResults.value = [];
    return;
  }
  searchTimeout = setTimeout(async () => {
    searching.value = true;
    try {
      const data = await ($fetch as Function)('/api/admin/users', {
        query: { search: searchQuery.value, limit: 8 },
      }) as { items: Array<{ id: string; username: string; displayName: string | null; avatarUrl: string | null }> };
      // Filter out users who are already judges
      const judgeIds = new Set((judges.value ?? []).map((j: ContestJudgeItem) => j.userId));
      searchResults.value = data.items.filter((u: { id: string }) => !judgeIds.has(u.id));
    } catch {
      searchResults.value = [];
    } finally {
      searching.value = false;
    }
  }, 300);
}

async function addJudge(userId: string): Promise<void> {
  adding.value = true;
  try {
    await ($fetch as Function)(`/api/contests/${props.contestSlug}/judges`, {
      method: 'POST',
      body: { userId, role: newJudgeRole.value },
    });
    toast.success('Judge added');
    searchQuery.value = '';
    searchResults.value = [];
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
    await ($fetch as Function)(`/api/contests/${props.contestSlug}/judges/${userId}`, { method: 'DELETE' });
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
    <h3 class="cpub-judges-title">Judge Management</h3>

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
      <div class="cpub-judges-search-wrapper">
        <div class="cpub-judges-search-row">
          <input
            v-model="searchQuery"
            class="cpub-judges-input"
            placeholder="Search by name or username..."
            @input="handleSearch"
          />
          <select v-model="newJudgeRole" class="cpub-judges-input cpub-judges-select">
            <option value="lead">Lead</option>
            <option value="judge">Judge</option>
            <option value="guest">Guest</option>
          </select>
        </div>
        <div v-if="searchResults.length" class="cpub-judges-dropdown">
          <button
            v-for="user in searchResults"
            :key="user.id"
            class="cpub-judges-dropdown-item"
            :disabled="adding"
            @click="addJudge(user.id)"
          >
            <span class="cpub-judge-avatar cpub-judge-avatar-sm">
              <img v-if="user.avatarUrl" :src="user.avatarUrl" :alt="user.displayName || user.username" />
              <span v-else>{{ (user.displayName || user.username).charAt(0) }}</span>
            </span>
            <span class="cpub-judges-dropdown-name">{{ user.displayName || user.username }}</span>
            <span class="cpub-judges-dropdown-handle">@{{ user.username }}</span>
          </button>
        </div>
        <div v-else-if="searching" class="cpub-judges-dropdown">
          <span class="cpub-judges-dropdown-empty">Searching...</span>
        </div>
        <div v-else-if="searchQuery.length >= 2 && !searchResults.length" class="cpub-judges-dropdown">
          <span class="cpub-judges-dropdown-empty">No users found</span>
        </div>
      </div>
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
.cpub-judge-avatar-sm { width: 20px; height: 20px; font-size: 8px; }
.cpub-judge-name { font-size: 12px; font-weight: 600; }
.cpub-judge-role { font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; color: var(--text-faint); }
.cpub-judge-pending { font-family: var(--font-mono); font-size: 9px; color: var(--yellow, var(--text-faint)); }
.cpub-judge-remove { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 10px; padding: 4px; }
.cpub-judge-remove:hover { color: var(--red); }

.cpub-judges-empty { font-size: 12px; color: var(--text-faint); font-style: italic; margin-bottom: 12px; }

.cpub-judges-add { margin-top: 8px; }
.cpub-judges-search-wrapper { position: relative; }
.cpub-judges-search-row { display: flex; gap: 6px; }
.cpub-judges-input { font-size: 12px; padding: 6px 10px; border: var(--border-width-default) solid var(--border); background: var(--bg); color: var(--text); outline: none; flex: 1; }
.cpub-judges-input:focus { border-color: var(--accent); }
.cpub-judges-select { max-width: 100px; flex: none; }

.cpub-judges-dropdown {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 10;
  background: var(--surface); border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-md); margin-top: 2px; max-height: 200px; overflow-y: auto;
}
.cpub-judges-dropdown-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  background: none; border: none; width: 100%; text-align: left;
  cursor: pointer; font-family: inherit; transition: background 0.1s;
}
.cpub-judges-dropdown-item:hover { background: var(--surface2); }
.cpub-judges-dropdown-item:disabled { opacity: 0.5; cursor: default; }
.cpub-judges-dropdown-name { font-size: 12px; font-weight: 600; color: var(--text); }
.cpub-judges-dropdown-handle { font-size: 11px; color: var(--text-faint); margin-left: auto; }
.cpub-judges-dropdown-empty { display: block; padding: 8px 12px; font-size: 11px; color: var(--text-faint); }
</style>
