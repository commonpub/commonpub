<script setup lang="ts">
import type { ContestStakeholderItem } from '@commonpub/server';
import type { StakeholderRole } from '@commonpub/schema';

const props = defineProps<{ contestSlug: string }>();

const toast = useToast();
const { data: stakeholders, refresh } = useLazyFetch<ContestStakeholderItem[]>(
  `/api/contests/${props.contestSlug}/stakeholders`,
);

const searchQuery = ref('');
const searchResults = ref<Array<{ id: string; username: string; displayName: string | null; avatarUrl: string | null }>>([]);
const searching = ref(false);
const adding = ref(false);
// Role applied to the next person added.
const addRole = ref<StakeholderRole>('reviewer');
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

const roleLabel = (r: StakeholderRole): string => (r === 'editor' ? 'Editor' : 'Reviewer');

function handleSearch(): void {
  if (searchTimeout) clearTimeout(searchTimeout);
  if (!searchQuery.value || searchQuery.value.length < 2) { searchResults.value = []; return; }
  searchTimeout = setTimeout(async () => {
    searching.value = true;
    try {
      // Contest-scoped, non-admin user search (public fields only).
      const data = await ($fetch as Function)(`/api/contests/${props.contestSlug}/user-search`, { query: { q: searchQuery.value, limit: 8 } }) as Array<{ id: string; username: string; displayName: string | null; avatarUrl: string | null }>;
      const existing = new Set((stakeholders.value ?? []).map((s) => s.userId));
      searchResults.value = data.filter((u) => !existing.has(u.id));
    } catch {
      searchResults.value = [];
    } finally {
      searching.value = false;
    }
  }, 300);
}

async function grant(userId: string, role: StakeholderRole): Promise<void> {
  adding.value = true;
  try {
    await ($fetch as Function)(`/api/contests/${props.contestSlug}/stakeholders`, { method: 'POST', body: { userId, role } });
    toast.success(`${roleLabel(role)} added`);
    searchQuery.value = '';
    searchResults.value = [];
    await refresh();
  } catch {
    toast.error(`Failed to add ${roleLabel(role).toLowerCase()}`);
  } finally {
    adding.value = false;
  }
}

async function changeRole(userId: string, role: StakeholderRole): Promise<void> {
  try {
    await ($fetch as Function)(`/api/contests/${props.contestSlug}/stakeholders`, { method: 'POST', body: { userId, role } });
    toast.success(`Role changed to ${roleLabel(role)}`);
    await refresh();
  } catch {
    toast.error('Failed to change role');
  }
}

async function removeStakeholder(userId: string): Promise<void> {
  if (!confirm('Remove this person’s access to the contest?')) return;
  try {
    await ($fetch as Function)(`/api/contests/${props.contestSlug}/stakeholders/${userId}`, { method: 'DELETE' });
    toast.success('Access removed');
    await refresh();
  } catch {
    toast.error('Failed to remove access');
  }
}
</script>

<template>
  <div class="cpub-sh">
    <p class="cpub-sh-hint">Reviewers can view this contest (even while private/unpublished) but can't edit or judge. Editors can fully edit this contest. Neither gets any access to the rest of the site.</p>
    <div v-if="stakeholders?.length" class="cpub-sh-list">
      <div v-for="s in stakeholders" :key="s.id" class="cpub-sh-row">
        <NuxtLink :to="`/u/${s.userUsername}`" class="cpub-sh-link">
          <span class="cpub-sh-av">
            <img v-if="s.userAvatar" :src="s.userAvatar" :alt="s.userName" />
            <span v-else>{{ s.userName.charAt(0) }}</span>
          </span>
          <span class="cpub-sh-name">{{ s.userName }}</span>
        </NuxtLink>
        <select
          class="cpub-sh-role"
          :value="s.role"
          :aria-label="`Role for ${s.userName}`"
          @change="changeRole(s.userId, ($event.target as HTMLSelectElement).value as StakeholderRole)"
        >
          <option value="reviewer">Reviewer</option>
          <option value="editor">Editor</option>
        </select>
        <button class="cpub-sh-remove" :aria-label="`Remove ${s.userName}`" @click="removeStakeholder(s.userId)">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
    <p v-else class="cpub-sh-empty">No collaborators yet.</p>

    <div class="cpub-sh-search">
      <div class="cpub-sh-search-row">
        <input
          v-model="searchQuery"
          class="cpub-sh-input"
          placeholder="Search users by name or username..."
          aria-label="Search users to add as a collaborator"
          @input="handleSearch"
        />
        <select v-model="addRole" class="cpub-sh-role" aria-label="Role to grant">
          <option value="reviewer">Reviewer</option>
          <option value="editor">Editor</option>
        </select>
      </div>
      <div v-if="searchResults.length" class="cpub-sh-dropdown">
        <button v-for="u in searchResults" :key="u.id" class="cpub-sh-option" :disabled="adding" @click="grant(u.id, addRole)">
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
.cpub-sh-role { font-size: 11px; padding: 4px 6px; border: var(--border-width-default) solid var(--border); background: var(--bg); color: var(--text); outline: none; flex-shrink: 0; }
.cpub-sh-role:focus { border-color: var(--accent); }
.cpub-sh-remove { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 12px; padding: 6px; min-height: 28px; }
.cpub-sh-remove:hover { color: var(--red); }
.cpub-sh-empty { font-size: 12px; color: var(--text-faint); font-style: italic; margin-bottom: 12px; }
.cpub-sh-search { position: relative; }
.cpub-sh-search-row { display: flex; gap: 8px; }
.cpub-sh-input { font-size: 12px; padding: 8px 10px; border: var(--border-width-default) solid var(--border); background: var(--bg); color: var(--text); outline: none; flex: 1; min-width: 0; }
.cpub-sh-input:focus { border-color: var(--accent); }
.cpub-sh-dropdown { position: absolute; top: 100%; left: 0; right: 0; z-index: 10; background: var(--surface); border: var(--border-width-default) solid var(--border); box-shadow: var(--shadow-md); margin-top: 2px; max-height: 200px; overflow-y: auto; }
.cpub-sh-option { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: none; border: none; width: 100%; text-align: left; cursor: pointer; }
.cpub-sh-option:hover { background: var(--surface2); }
.cpub-sh-option:disabled { opacity: 0.5; cursor: default; }
.cpub-sh-opt-name { font-size: 12px; font-weight: 600; color: var(--text); }
.cpub-sh-opt-handle { font-size: 11px; color: var(--text-faint); margin-left: auto; }
.cpub-sh-dropdown-empty { display: block; padding: 8px 12px; font-size: 11px; color: var(--text-faint); }
</style>
