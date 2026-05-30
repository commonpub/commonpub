<script setup lang="ts">
import type { ContestStakeholderItem } from '@commonpub/server';

const props = defineProps<{ contestSlug: string }>();

const toast = useToast();
const { data: stakeholders, refresh } = useLazyFetch<ContestStakeholderItem[]>(
  `/api/contests/${props.contestSlug}/stakeholders`,
);

const searchQuery = ref('');
const searchResults = ref<Array<{ id: string; username: string; displayName: string | null; avatarUrl: string | null }>>([]);
const searching = ref(false);
const adding = ref(false);
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

function handleSearch(): void {
  if (searchTimeout) clearTimeout(searchTimeout);
  if (!searchQuery.value || searchQuery.value.length < 2) { searchResults.value = []; return; }
  searchTimeout = setTimeout(async () => {
    searching.value = true;
    try {
      const data = await ($fetch as Function)('/api/admin/users', { query: { search: searchQuery.value, limit: 8 } }) as { items: Array<{ id: string; username: string; displayName: string | null; avatarUrl: string | null }> };
      const existing = new Set((stakeholders.value ?? []).map((s) => s.userId));
      searchResults.value = data.items.filter((u) => !existing.has(u.id));
    } catch {
      searchResults.value = [];
    } finally {
      searching.value = false;
    }
  }, 300);
}

async function addStakeholder(userId: string): Promise<void> {
  adding.value = true;
  try {
    await ($fetch as Function)(`/api/contests/${props.contestSlug}/stakeholders`, { method: 'POST', body: { userId } });
    toast.success('Reviewer added');
    searchQuery.value = '';
    searchResults.value = [];
    await refresh();
  } catch {
    toast.error('Failed to add reviewer');
  } finally {
    adding.value = false;
  }
}

async function removeStakeholder(userId: string): Promise<void> {
  if (!confirm('Remove this reviewer’s access?')) return;
  try {
    await ($fetch as Function)(`/api/contests/${props.contestSlug}/stakeholders/${userId}`, { method: 'DELETE' });
    toast.success('Reviewer removed');
    await refresh();
  } catch {
    toast.error('Failed to remove reviewer');
  }
}
</script>

<template>
  <div class="cpub-sh">
    <p class="cpub-sh-hint">Reviewers can view this contest (even while private/unpublished) but can't edit it or judge.</p>
    <div v-if="stakeholders?.length" class="cpub-sh-list">
      <div v-for="s in stakeholders" :key="s.id" class="cpub-sh-row">
        <NuxtLink :to="`/u/${s.userUsername}`" class="cpub-sh-link">
          <span class="cpub-sh-av">
            <img v-if="s.userAvatar" :src="s.userAvatar" :alt="s.userName" />
            <span v-else>{{ s.userName.charAt(0) }}</span>
          </span>
          <span class="cpub-sh-name">{{ s.userName }}</span>
        </NuxtLink>
        <button class="cpub-sh-remove" :aria-label="`Remove ${s.userName}`" @click="removeStakeholder(s.userId)">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
    <p v-else class="cpub-sh-empty">No reviewers yet.</p>

    <div class="cpub-sh-search">
      <input
        v-model="searchQuery"
        class="cpub-sh-input"
        placeholder="Search users by name or username..."
        aria-label="Search users to add as reviewers"
        @input="handleSearch"
      />
      <div v-if="searchResults.length" class="cpub-sh-dropdown">
        <button v-for="u in searchResults" :key="u.id" class="cpub-sh-option" :disabled="adding" @click="addStakeholder(u.id)">
          <span class="cpub-sh-av cpub-sh-av-sm">
            <img v-if="u.avatarUrl" :src="u.avatarUrl" :alt="u.displayName || u.username" />
            <span v-else>{{ (u.displayName || u.username).charAt(0) }}</span>
          </span>
          <span class="cpub-sh-opt-name">{{ u.displayName || u.username }}</span>
          <span class="cpub-sh-opt-handle">@{{ u.username }}</span>
        </button>
      </div>
      <div v-else-if="searching" class="cpub-sh-dropdown"><span class="cpub-sh-dropdown-empty">Searching...</span></div>
      <div v-else-if="searchQuery.length >= 2" class="cpub-sh-dropdown"><span class="cpub-sh-dropdown-empty">No users found</span></div>
    </div>
  </div>
</template>

<style scoped>
.cpub-sh-hint { font-size: 11px; color: var(--text-faint); margin: 0 0 12px; line-height: 1.5; }
.cpub-sh-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.cpub-sh-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.cpub-sh-link { display: flex; align-items: center; gap: 8px; text-decoration: none; color: var(--text); flex: 1; min-width: 0; }
.cpub-sh-av { width: 24px; height: 24px; border-radius: 50%; background: var(--surface2); border: var(--border-width-default) solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; overflow: hidden; flex-shrink: 0; }
.cpub-sh-av img { width: 100%; height: 100%; object-fit: cover; }
.cpub-sh-av-sm { width: 20px; height: 20px; font-size: 8px; }
.cpub-sh-name { font-size: 12px; font-weight: 600; }
.cpub-sh-remove { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 12px; padding: 6px; min-height: 28px; }
.cpub-sh-remove:hover { color: var(--red); }
.cpub-sh-empty { font-size: 12px; color: var(--text-faint); font-style: italic; margin-bottom: 12px; }
.cpub-sh-search { position: relative; }
.cpub-sh-input { font-size: 12px; padding: 8px 10px; border: var(--border-width-default) solid var(--border); background: var(--bg); color: var(--text); outline: none; width: 100%; }
.cpub-sh-input:focus { border-color: var(--accent); }
.cpub-sh-dropdown { position: absolute; top: 100%; left: 0; right: 0; z-index: 10; background: var(--surface); border: var(--border-width-default) solid var(--border); box-shadow: var(--shadow-md); margin-top: 2px; max-height: 200px; overflow-y: auto; }
.cpub-sh-option { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: none; border: none; width: 100%; text-align: left; cursor: pointer; }
.cpub-sh-option:hover { background: var(--surface2); }
.cpub-sh-option:disabled { opacity: 0.5; cursor: default; }
.cpub-sh-opt-name { font-size: 12px; font-weight: 600; color: var(--text); }
.cpub-sh-opt-handle { font-size: 11px; color: var(--text-faint); margin-left: auto; }
.cpub-sh-dropdown-empty { display: block; padding: 8px 12px; font-size: 11px; color: var(--text-faint); }
</style>
