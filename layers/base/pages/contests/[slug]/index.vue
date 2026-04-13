<script setup lang="ts">
import type { Serialized, ContestEntryItem } from '@commonpub/server';

const route = useRoute();
const slug = route.params.slug as string;
const toast = useToast();
const { isAuthenticated, isAdmin, user } = useAuth();

const { data: contest } = useLazyFetch(`/api/contests/${slug}`);
const { data: apiEntriesData, refresh: refreshEntries } = useLazyFetch<{ items: Serialized<ContestEntryItem>[]; total: number }>(`/api/contests/${slug}/entries`);

useSeoMeta({
  title: () => `${contest.value?.title || 'Contest'} — ${useSiteName()}`,
  ogTitle: () => `${contest.value?.title || 'Contest'} — ${useSiteName()}`,
  ogImage: '/og-default.png',
});

const c = computed(() => contest.value);
const entries = computed(() => apiEntriesData.value?.items ?? []);

// Admin contest management
const transitioning = ref(false);

async function transitionStatus(newStatus: string): Promise<void> {
  if (newStatus === 'cancelled' && !confirm('Cancel this contest? This cannot be undone.')) return;
  transitioning.value = true;
  try {
    await $fetch(`/api/contests/${slug}/transition`, {
      method: 'POST',
      body: { status: newStatus },
    });
    toast.success(`Contest ${newStatus}`);
    refreshNuxtData();
  } catch {
    toast.error(`Failed to transition to ${newStatus}`);
  } finally {
    transitioning.value = false;
  }
}

// Entry submission
const showSubmitDialog = ref(false);
const submitContentId = ref('');
const submitting = ref(false);
const { data: userContent } = useFetch('/api/content', {
  query: { status: 'published', limit: 50 },
  immediate: isAuthenticated.value,
});

function copyLink(): void {
  if (typeof window !== 'undefined' && window.navigator?.clipboard) {
    window.navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied');
  }
}

async function submitEntry(): Promise<void> {
  if (!submitContentId.value) return;
  submitting.value = true;
  try {
    await $fetch(`/api/contests/${slug}/entries`, {
      method: 'POST',
      body: { contentId: submitContentId.value },
    });
    showSubmitDialog.value = false;
    submitContentId.value = '';
    toast.success('Entry submitted!');
    refreshNuxtData();
  } catch {
    toast.error('Failed to submit entry');
  } finally {
    submitting.value = false;
  }
}

async function withdrawEntry(entryId: string): Promise<void> {
  try {
    await $fetch(`/api/contests/${slug}/entries/${entryId}`, { method: 'DELETE' });
    toast.success('Entry withdrawn');
    await refreshEntries();
    refreshNuxtData();
  } catch {
    toast.error('Failed to withdraw entry');
  }
}
</script>

<template>
  <div class="cpub-contest">
    <ContestHero
      :contest="c"
      :is-admin="isAdmin"
      :is-authenticated="isAuthenticated"
      :transitioning="transitioning"
      @submit-entry="showSubmitDialog = true"
      @transition="transitionStatus"
      @copy-link="copyLink"
    />

    <!-- SUBMIT ENTRY DIALOG -->
    <div v-if="showSubmitDialog" class="cpub-submit-overlay" @click.self="showSubmitDialog = false">
      <div class="cpub-submit-dialog" role="dialog" aria-label="Submit entry">
        <div class="cpub-submit-header">
          <h2>Submit Entry</h2>
          <button class="cpub-submit-close" @click="showSubmitDialog = false"><i class="fa-solid fa-times"></i></button>
        </div>
        <div class="cpub-submit-body">
          <p class="cpub-submit-hint">Select one of your published projects to submit as an entry.</p>
          <select v-model="submitContentId" class="cpub-submit-select">
            <option value="">Select a project...</option>
            <option v-for="item in (userContent?.items ?? [])" :key="item.id" :value="item.id">
              {{ item.title }} ({{ item.type }})
            </option>
          </select>
        </div>
        <div class="cpub-submit-footer">
          <button class="cpub-btn cpub-btn-sm" @click="showSubmitDialog = false">Cancel</button>
          <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="!submitContentId || submitting" @click="submitEntry">
            {{ submitting ? 'Submitting...' : 'Submit' }}
          </button>
        </div>
      </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="cpub-contest-main">
      <div class="cpub-contest-layout">
        <div>
          <!-- ABOUT -->
          <div class="cpub-about-section">
            <div class="cpub-sec-head">
              <h2><i class="fa fa-circle-info" style="color: var(--accent);"></i> About This Contest</h2>
            </div>
            <div class="cpub-about-card">
              <p>{{ c?.description || 'No description available for this contest.' }}</p>
            </div>
          </div>

          <ContestRules v-if="c?.rules" :rules="c.rules" />
          <ContestPrizes v-if="c?.prizes?.length" :prizes="c.prizes" />
          <ContestJudges v-if="c?.judges?.length" :judge-ids="c.judges" />
          <ContestEntries
            :entries="entries"
            :contest-status="c?.status"
            :current-user-id="user?.id"
            @withdraw="withdrawEntry"
          />
        </div>

        <ContestSidebar :contest="c" @copy-link="copyLink" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* SUBMIT DIALOG */
.cpub-submit-overlay { position: fixed; inset: 0; z-index: 200; background: var(--color-surface-overlay-light); display: flex; align-items: center; justify-content: center; }
.cpub-submit-dialog { background: var(--surface); border: var(--border-width-default) solid var(--border); box-shadow: var(--shadow-xl); width: 420px; max-width: 90vw; }
.cpub-submit-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: var(--border-width-default) solid var(--border); }
.cpub-submit-header h2 { font-size: 14px; font-weight: 700; }
.cpub-submit-close { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 14px; }
.cpub-submit-body { padding: 16px; }
.cpub-submit-hint { font-size: 12px; color: var(--text-dim); margin-bottom: 12px; }
.cpub-submit-select { width: 100%; padding: 8px 10px; border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; }
.cpub-submit-select:focus { border-color: var(--accent); outline: none; }
.cpub-submit-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: var(--border-width-default) solid var(--border); }

/* LAYOUT */
.cpub-contest-main { max-width: 1100px; margin: 0 auto; padding: 32px; }
.cpub-contest-layout { display: grid; grid-template-columns: 1fr 300px; gap: 28px; align-items: start; }

/* SECTION HEADERS */
.cpub-sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.cpub-sec-head h2 { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; }

/* ABOUT */
.cpub-about-section { margin-bottom: 20px; }
.cpub-about-card { background: var(--surface); border: var(--border-width-default) solid var(--border); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow-md); font-size: 12px; color: var(--text-dim); line-height: 1.7; }
.cpub-about-card p { margin: 0; }

@media (max-width: 768px) {
  .cpub-contest-main { padding: 20px 16px; }
  .cpub-contest-layout { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
  .cpub-contest-main { padding: 16px 12px; }
}
</style>
