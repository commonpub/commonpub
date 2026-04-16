<script setup lang="ts">
import type { Serialized, ContestEntryItem, ContestEntryVoteInfo } from '@commonpub/server';

const props = defineProps<{
  entries: Serialized<ContestEntryItem>[];
  contestStatus?: string;
  contestSlug?: string;
  currentUserId?: string;
  communityVotingEnabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'withdraw', entryId: string): void;
}>();

const { isAuthenticated } = useAuth();
const toast = useToast();

// Vote state: entryId → { count, voted }
const voteMap = ref<Map<string, { count: number; voted: boolean }>>(new Map());
const votingEntry = ref<string | null>(null);

// Fetch vote data — always set up the fetch (server returns [] when voting is disabled).
// Cannot conditionally call useLazyFetch because props from useLazyFetch parent
// may still be undefined during setup.
if (props.contestSlug) {
  const { data: voteData } = useLazyFetch<ContestEntryVoteInfo[]>(
    `/api/contests/${props.contestSlug}/votes`,
  );
  watch(voteData, (data) => {
    if (!data) return;
    const map = new Map<string, { count: number; voted: boolean }>();
    for (const v of data) {
      map.set(v.entryId, { count: v.count, voted: v.voted });
    }
    voteMap.value = map;
  }, { immediate: true });
}

function getVoteCount(entryId: string): number {
  return voteMap.value.get(entryId)?.count ?? 0;
}

function hasVoted(entryId: string): boolean {
  return voteMap.value.get(entryId)?.voted ?? false;
}

async function toggleVote(entryId: string): Promise<void> {
  if (!isAuthenticated.value || !props.contestSlug || votingEntry.value) return;
  votingEntry.value = entryId;

  const currentlyVoted = hasVoted(entryId);
  const currentCount = getVoteCount(entryId);

  // Optimistic update
  voteMap.value.set(entryId, {
    count: currentlyVoted ? currentCount - 1 : currentCount + 1,
    voted: !currentlyVoted,
  });

  try {
    if (currentlyVoted) {
      await $fetch(`/api/contests/${props.contestSlug}/entries/${entryId}/vote`, { method: 'DELETE' });
    } else {
      await $fetch(`/api/contests/${props.contestSlug}/entries/${entryId}/vote`, { method: 'POST' });
    }
  } catch {
    // Revert optimistic update
    voteMap.value.set(entryId, { count: currentCount, voted: currentlyVoted });
    toast.error(currentlyVoted ? 'Failed to remove vote' : 'Failed to vote');
  } finally {
    votingEntry.value = null;
  }
}

function confirmWithdraw(entryId: string): void {
  if (confirm('Withdraw this entry? This cannot be undone.')) {
    emit('withdraw', entryId);
  }
}
</script>

<template>
  <div class="cpub-entries-section">
    <div class="cpub-sec-head">
      <h2><i class="fa fa-box-open" style="color: var(--teal);"></i> Submitted Entries</h2>
      <span class="cpub-sec-sub">{{ entries.length }} entries</span>
    </div>
    <div v-if="entries.length" class="cpub-entry-grid">
      <div
        v-for="(entry, i) in entries"
        :key="entry.id"
        class="cpub-entry-card"
      >
        <div class="cpub-entry-thumb" :class="i % 2 === 0 ? 'cpub-entry-bg-light' : 'cpub-entry-bg-dark'">
          <img v-if="entry.contentCoverImageUrl" :src="entry.contentCoverImageUrl" :alt="entry.contentTitle" class="cpub-entry-cover-img" />
          <template v-else>
            <div class="cpub-entry-grid-pat"></div>
            <div class="cpub-entry-icon"><i class="fa-solid fa-microchip"></i></div>
          </template>
          <span v-if="entry.rank" class="cpub-entry-rank" :class="`cpub-rank-${entry.rank <= 3 ? entry.rank : 'other'}`">#{{ entry.rank }}</span>
        </div>
        <div class="cpub-entry-body">
          <NuxtLink :to="`/u/${entry.authorUsername}/${entry.contentType}/${entry.contentSlug}`" class="cpub-entry-title">{{ entry.contentTitle || `Entry #${i + 1}` }}</NuxtLink>
          <div class="cpub-entry-author">
            <div class="cpub-entry-av">
              <img v-if="entry.authorAvatarUrl" :src="entry.authorAvatarUrl" :alt="entry.authorName || entry.authorUsername" class="cpub-entry-av-img" />
              <span v-else>{{ (entry.authorName || entry.authorUsername || '?').charAt(0).toUpperCase() }}</span>
            </div>
            <NuxtLink v-if="entry.authorUsername" :to="`/u/${entry.authorUsername}`" class="cpub-entry-author-link">{{ entry.authorName }}</NuxtLink>
            <span class="cpub-entry-meta">{{ new Date(entry.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}</span>
          </div>
          <div class="cpub-entry-footer">
            <span v-if="entry.score != null" class="cpub-entry-score">Score: {{ entry.score }}</span>
            <button
              v-if="communityVotingEnabled"
              class="cpub-entry-vote-btn"
              :class="{ voted: hasVoted(entry.id) }"
              :disabled="!isAuthenticated || votingEntry === entry.id"
              :aria-pressed="hasVoted(entry.id)"
              :aria-label="hasVoted(entry.id) ? 'Remove vote' : 'Vote for this entry'"
              @click.prevent="toggleVote(entry.id)"
            >
              <i :class="hasVoted(entry.id) ? 'fa-solid fa-heart' : 'fa-regular fa-heart'"></i>
              <span>{{ getVoteCount(entry.id) }}</span>
            </button>
            <button
              v-if="currentUserId && entry.userId === currentUserId && contestStatus === 'active'"
              class="cpub-withdraw-btn"
              @click.prevent="confirmWithdraw(entry.id)"
            ><i class="fa-solid fa-trash-can"></i> Withdraw</button>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="cpub-empty-state">
      <div class="cpub-empty-state-icon"><i class="fa-solid fa-box-open"></i></div>
      <p class="cpub-empty-state-title">No entries yet</p>
      <p v-if="contestStatus === 'active'" class="cpub-empty-state-desc">Be the first to submit an entry!</p>
      <p v-else-if="contestStatus === 'cancelled'" class="cpub-empty-state-desc">This contest was cancelled.</p>
      <p v-else-if="contestStatus === 'completed'" class="cpub-empty-state-desc">No entries were submitted.</p>
      <p v-else class="cpub-empty-state-desc">Submissions are not open yet.</p>
    </div>
  </div>
</template>

<style scoped>
.cpub-sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.cpub-sec-head h2 { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.cpub-sec-sub { font-size: 11px; color: var(--text-faint); margin-left: auto; font-family: var(--font-mono); }

.cpub-entry-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.cpub-entry-card { background: var(--surface); border: var(--border-width-default) solid var(--border); border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow-md); }
.cpub-entry-card:hover { box-shadow: var(--shadow-accent); }
.cpub-entry-thumb { height: 110px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.cpub-entry-bg-light { background: var(--surface2); }
.cpub-entry-bg-dark { background: var(--surface3); }
.cpub-entry-grid-pat { position: absolute; inset: 0; background-image: linear-gradient(var(--border2) 1px, transparent 1px), linear-gradient(90deg, var(--border2) 1px, transparent 1px); background-size: 20px 20px; opacity: .3; }
.cpub-entry-icon { position: relative; z-index: 1; font-size: 22px; opacity: .65; color: var(--accent); }
.cpub-entry-rank { position: absolute; top: 8px; left: 8px; z-index: 2; font-size: 10px; font-family: var(--font-mono); font-weight: 700; padding: 2px 7px; border-radius: var(--radius); }
.cpub-rank-1 { background: var(--yellow-bg); color: var(--yellow); border: var(--border-width-default) solid var(--yellow); }
.cpub-rank-2 { background: var(--surface2); color: var(--text-faint); border: var(--border-width-default) solid var(--text-faint); }
.cpub-rank-3 { background: var(--surface2); color: var(--bronze); border: var(--border-width-default) solid var(--bronze); }
.cpub-rank-other { background: var(--surface2); color: var(--text-dim); border: var(--border-width-default) solid var(--border); }
.cpub-entry-body { padding: 10px 12px; }
.cpub-entry-title { font-size: 12px; font-weight: 600; margin-bottom: 3px; line-height: 1.3; color: var(--text); text-decoration: none; }
.cpub-entry-title:hover { color: var(--accent); }
.cpub-entry-cover-img { width: 100%; height: 100%; object-fit: cover; }
.cpub-entry-av { width: 18px; height: 18px; border-radius: 50%; background: var(--surface3); border: var(--border-width-default) solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 7px; font-family: var(--font-mono); color: var(--text-faint); flex-shrink: 0; overflow: hidden; }
.cpub-entry-av-img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
.cpub-entry-author { font-size: 10px; color: var(--text-dim); font-family: var(--font-mono); margin-bottom: 6px; display: flex; align-items: center; gap: 5px; }
.cpub-entry-author-link { color: var(--text-dim); text-decoration: none; }
.cpub-entry-author-link:hover { color: var(--accent); }
.cpub-entry-meta { color: var(--text-faint); }
.cpub-entry-footer { display: flex; align-items: center; gap: 6px; }
.cpub-entry-score { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); display: flex; align-items: center; gap: 3px; }

.cpub-entry-vote-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-family: var(--font-mono); font-weight: 600;
  padding: 3px 8px; border: var(--border-width-default) solid var(--border2);
  background: var(--surface); color: var(--text-dim); cursor: pointer;
  transition: all 0.15s;
}
.cpub-entry-vote-btn:hover:not(:disabled) { border-color: var(--red); color: var(--red); }
.cpub-entry-vote-btn.voted { color: var(--red); border-color: var(--red); }
.cpub-entry-vote-btn:disabled { opacity: 0.4; cursor: default; }
.cpub-entry-vote-btn i { font-size: 10px; }

.cpub-withdraw-btn { display: flex; align-items: center; gap: 4px; font-size: 10px; font-family: var(--font-mono); padding: 3px 8px; border-radius: var(--radius); border: var(--border-width-default) solid var(--red-border); background: var(--surface); color: var(--red); cursor: pointer; margin-left: auto; }
.cpub-withdraw-btn:hover { background: var(--red-bg); }

.cpub-empty-state { text-align: center; padding: 32px 0; }
.cpub-empty-state-icon { font-size: 24px; color: var(--text-faint); margin-bottom: 8px; }
.cpub-empty-state-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.cpub-empty-state-desc { font-size: 12px; color: var(--text-dim); }

@media (max-width: 768px) { .cpub-entry-grid { grid-template-columns: 1fr; } }
</style>
