<script setup lang="ts">
import type { Serialized, ContestEntryItem, ContestJudgeItem } from '@commonpub/server';

const route = useRoute();
const slug = route.params.slug as string;
const toast = useToast();
const { extract: extractError } = useApiError();
const { isAuthenticated, isAdmin, user } = useAuth();

const { data: contest } = useLazyFetch(`/api/contests/${slug}`);
const { data: apiEntriesData, refresh: refreshEntries } = useLazyFetch<{ items: Serialized<ContestEntryItem>[]; total: number }>(`/api/contests/${slug}/entries`);
const { data: judgesData, refresh: refreshJudges } = useLazyFetch<ContestJudgeItem[]>(`/api/contests/${slug}/judges`);

useSeoMeta({
  title: () => `${contest.value?.title || 'Contest'} — ${useSiteName()}`,
  ogTitle: () => `${contest.value?.title || 'Contest'} — ${useSiteName()}`,
  ogImage: () => contest.value?.bannerUrl || '/og-default.png',
});

const c = computed(() => contest.value);
const entries = computed(() => apiEntriesData.value?.items ?? []);
const judges = computed<ContestJudgeItem[]>(() => judgesData.value ?? []);
const isOwner = computed(() => isAdmin.value || !!(user.value?.id && c.value?.createdById === user.value.id));

// Judge state derives entirely from the contest_judges table (single source of
// truth) — not the legacy `judges` jsonb column.
const myJudge = computed(() => judges.value.find((j) => j.userId === user.value?.id) ?? null);
const pendingInvite = computed(() => !!myJudge.value && !myJudge.value.acceptedAt);
const canJudge = computed(() => !!myJudge.value && !!myJudge.value.acceptedAt && myJudge.value.role !== 'guest');

// Unique entrants (the people), distinct from entries (the submissions).
interface Participant { username: string; name: string; avatar: string | null; count: number }
const participants = computed<Participant[]>(() => {
  const map = new Map<string, Participant>();
  for (const e of entries.value) {
    const cur = map.get(e.authorUsername);
    if (cur) cur.count++;
    else map.set(e.authorUsername, { username: e.authorUsername, name: e.authorName, avatar: e.authorAvatarUrl, count: 1 });
  }
  return [...map.values()];
});

// Visibility banner shown to those who can see a non-public contest.
const visibilityNote = computed(() => {
  if (!c.value || c.value.visibility === 'public') return null;
  if (c.value.visibility === 'unlisted') return { icon: 'fa-link', text: 'Unlisted — visible by direct link only, hidden from listings.' };
  return { icon: 'fa-lock', text: 'Private — visible only to you, reviewers, judges, and allowed roles.' };
});

// Tabs ----------------------------------------------------------------------
interface Tab { key: string; label: string; icon: string; count?: number }
const tabs = computed<Tab[]>(() => {
  const t: Tab[] = [{ key: 'overview', label: 'Overview', icon: 'fa-circle-info' }];
  if (c.value?.rules) t.push({ key: 'rules', label: 'Rules', icon: 'fa-file-lines' });
  if (c.value?.prizes?.length || c.value?.prizesDescription) t.push({ key: 'prizes', label: 'Prizes', icon: 'fa-trophy' });
  t.push({ key: 'entries', label: 'Entries', icon: 'fa-box-open', count: c.value?.entryCount ?? entries.value.length });
  if (participants.value.length) t.push({ key: 'participants', label: 'Participants', icon: 'fa-users', count: participants.value.length });
  if (judges.value.length || isOwner.value) t.push({ key: 'judges', label: 'Judges', icon: 'fa-gavel', count: judges.value.length || undefined });
  return t;
});
const activeTab = ref('overview');
watch(tabs, (list) => {
  if (!list.some((t) => t.key === activeTab.value)) activeTab.value = 'overview';
});

// WAI-ARIA tabs keyboard pattern (arrow keys + Home/End, roving focus).
function focusTab(key: string): void {
  activeTab.value = key;
  nextTick(() => {
    if (typeof document !== 'undefined') document.getElementById(`cpub-tab-${key}`)?.focus();
  });
}
function onTabKey(e: KeyboardEvent, key: string): void {
  const keys = tabs.value.map((t) => t.key);
  const i = keys.indexOf(key);
  if (i < 0) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); focusTab(keys[(i + 1) % keys.length]!); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); focusTab(keys[(i - 1 + keys.length) % keys.length]!); }
  else if (e.key === 'Home') { e.preventDefault(); focusTab(keys[0]!); }
  else if (e.key === 'End') { e.preventDefault(); focusTab(keys[keys.length - 1]!); }
}

// Admin contest management
const transitioning = ref(false);
async function transitionStatus(newStatus: string): Promise<void> {
  if (newStatus === 'cancelled' && !confirm('Cancel this contest? This cannot be undone.')) return;
  transitioning.value = true;
  try {
    await $fetch(`/api/contests/${slug}/transition`, { method: 'POST', body: { status: newStatus } });
    toast.success(`Contest ${newStatus}`);
    refreshNuxtData();
  } catch {
    toast.error(`Failed to transition to ${newStatus}`);
  } finally {
    transitioning.value = false;
  }
}

// Judge invite acceptance
const accepting = ref(false);
async function acceptInvite(): Promise<void> {
  accepting.value = true;
  try {
    await $fetch(`/api/contests/${slug}/judges/accept`, { method: 'POST' });
    toast.success('You are now a judge for this contest');
    await refreshJudges();
  } catch {
    toast.error('Failed to accept invitation');
  } finally {
    accepting.value = false;
  }
}

// Entry submission
const showSubmitDialog = ref(false);
const submitDialogRef = ref<HTMLElement | null>(null);
useFocusTrap(submitDialogRef, () => showSubmitDialog.value, () => { showSubmitDialog.value = false; });
const submitContentId = ref('');
const submitting = ref(false);
const { data: userContent } = useFetch('/api/content', {
  query: { status: 'published', limit: 50 },
  immediate: isAuthenticated.value,
});
const enteredContentIds = computed(() => new Set(entries.value.map((e) => e.contentId)));

// Restrict the submit picker to the contest's eligible content types (if set).
const eligibleTypes = computed<string[]>(() => (c.value?.eligibleContentTypes as string[] | undefined) ?? []);
const submittableContent = computed(() => {
  const items = (userContent.value?.items ?? []) as Array<{ id: string; title: string; type: string; coverImageUrl?: string | null }>;
  if (eligibleTypes.value.length === 0) return items;
  return items.filter((i) => eligibleTypes.value.includes(i.type));
});

// "Create a new project for this contest" — lands in the editor with the contest
// association in the URL; on publish it auto-enters (server pending-entry hook).
const newProjectType = computed(() => (eligibleTypes.value[0] ?? 'project'));
const createForContestLink = computed(() =>
  user.value?.username
    ? `/u/${user.value.username}/${newProjectType.value}/new/edit?contest=${slug}`
    : `/auth/login?redirect=/contests/${slug}`,
);

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
    await $fetch(`/api/contests/${slug}/entries`, { method: 'POST', body: { contentId: submitContentId.value } });
    showSubmitDialog.value = false;
    submitContentId.value = '';
    toast.success('Entry submitted!');
    refreshNuxtData();
  } catch (err: unknown) {
    toast.error(extractError(err));
  } finally {
    submitting.value = false;
  }
}

async function withdrawEntry(entryId: string): Promise<void> {
  try {
    await $fetch(`/api/contests/${slug}/entries/${entryId}`, { method: 'DELETE' });
    toast.success('Entry withdrawn');
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
      <div ref="submitDialogRef" class="cpub-submit-dialog" role="dialog" aria-modal="true" aria-label="Submit entry">
        <div class="cpub-submit-header">
          <h2>Submit Entry</h2>
          <button class="cpub-submit-close" aria-label="Close" @click="showSubmitDialog = false"><i class="fa-solid fa-times"></i></button>
        </div>
        <div class="cpub-submit-body">
          <p class="cpub-submit-hint">
            Pick one of your published projects to enter — or start a new one.
            <template v-if="eligibleTypes.length"> This contest accepts: {{ eligibleTypes.join(', ') }}.</template>
          </p>
          <div class="cpub-submit-gallery" role="radiogroup" aria-label="Select a project to submit">
            <NuxtLink :to="createForContestLink" class="cpub-submit-new" @click="showSubmitDialog = false">
              <div class="cpub-submit-new-icon"><i class="fa-solid fa-plus"></i></div>
              <span>Create a new {{ newProjectType }}</span>
              <small>Enters automatically when you publish it</small>
            </NuxtLink>
            <button
              v-for="item in submittableContent"
              :key="item.id"
              type="button"
              role="radio"
              :aria-checked="submitContentId === item.id"
              class="cpub-submit-tile"
              :class="{ selected: submitContentId === item.id, entered: enteredContentIds.has(item.id) }"
              :disabled="enteredContentIds.has(item.id)"
              @click="submitContentId = item.id"
            >
              <span class="cpub-submit-tile-thumb">
                <img v-if="item.coverImageUrl" :src="item.coverImageUrl" :alt="item.title" />
                <i v-else class="fa-solid fa-cube"></i>
                <span v-if="enteredContentIds.has(item.id)" class="cpub-submit-tile-badge">Entered</span>
                <span v-else-if="submitContentId === item.id" class="cpub-submit-tile-check"><i class="fa-solid fa-check"></i></span>
              </span>
              <span class="cpub-submit-tile-title">{{ item.title }}</span>
              <span class="cpub-submit-tile-type">{{ item.type }}</span>
            </button>
          </div>
          <p v-if="submittableContent.length === 0" class="cpub-submit-hint" style="margin-top: 10px; margin-bottom: 0;">
            No eligible published content yet — use “Create a new {{ newProjectType }}” above to start one.
          </p>
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
        <div class="cpub-contest-body">
          <!-- Judge invite banner -->
          <div v-if="pendingInvite" class="cpub-invite-banner">
            <div class="cpub-invite-text">
              <i class="fa-solid fa-gavel"></i>
              <span>You've been invited to judge this contest.</span>
            </div>
            <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="accepting" @click="acceptInvite">
              {{ accepting ? 'Accepting...' : 'Accept invitation' }}
            </button>
          </div>

          <!-- Visibility banner (non-public contests, shown to those who can see it) -->
          <div v-if="visibilityNote" class="cpub-visibility-banner">
            <i class="fa-solid" :class="visibilityNote.icon"></i>
            <span>{{ visibilityNote.text }}</span>
          </div>

          <!-- Tab bar -->
          <div class="cpub-tabbar" role="tablist" aria-label="Contest sections">
            <button
              v-for="tab in tabs"
              :id="`cpub-tab-${tab.key}`"
              :key="tab.key"
              role="tab"
              type="button"
              class="cpub-tab"
              :class="{ 'cpub-tab-active': activeTab === tab.key }"
              :aria-selected="activeTab === tab.key"
              :aria-controls="`cpub-panel-${tab.key}`"
              :tabindex="activeTab === tab.key ? 0 : -1"
              @click="activeTab = tab.key"
              @keydown="onTabKey($event, tab.key)"
            >
              <i class="fa-solid" :class="tab.icon"></i> {{ tab.label }}
              <span v-if="tab.count != null" class="cpub-tab-count">{{ tab.count }}</span>
            </button>
          </div>

          <!-- OVERVIEW -->
          <div v-show="activeTab === 'overview'" id="cpub-panel-overview" role="tabpanel" aria-labelledby="cpub-tab-overview" tabindex="0">
            <div class="cpub-about-section">
              <div class="cpub-sec-head"><h2><i class="fa fa-circle-info" style="color: var(--accent);"></i> About This Contest</h2></div>
              <div class="cpub-about-card">
                <CpubMarkdown v-if="c?.description" :source="c.description" />
                <p v-else>No description available for this contest.</p>
              </div>
            </div>
            <ContestJudgingCriteria v-if="c?.judgingCriteria?.length" :criteria="c.judgingCriteria" />
          </div>

          <!-- RULES -->
          <div v-show="activeTab === 'rules'" id="cpub-panel-rules" role="tabpanel" aria-labelledby="cpub-tab-rules" tabindex="0">
            <ContestRules v-if="c?.rules" :rules="c.rules" />
          </div>

          <!-- PRIZES -->
          <div v-show="activeTab === 'prizes'" id="cpub-panel-prizes" role="tabpanel" aria-labelledby="cpub-tab-prizes" tabindex="0">
            <ContestPrizes v-if="c?.prizes?.length || c?.prizesDescription" :prizes="c?.prizes ?? []" :description="c?.prizesDescription" />
          </div>

          <!-- ENTRIES -->
          <div v-show="activeTab === 'entries'" id="cpub-panel-entries" role="tabpanel" aria-labelledby="cpub-tab-entries" tabindex="0">
            <div v-if="c?.status === 'active'" class="cpub-entries-cta">
              <div class="cpub-entries-cta-text">
                <p class="cpub-entries-cta-title"><i class="fa-solid fa-trophy"></i> Enter this contest</p>
                <p class="cpub-entries-cta-sub">Submit one of your published projects — or start a new one.</p>
              </div>
              <button v-if="isAuthenticated" class="cpub-btn cpub-btn-primary cpub-btn-lg" @click="showSubmitDialog = true">
                <i class="fa-solid fa-upload"></i> Submit Entry
              </button>
              <NuxtLink v-else :to="`/auth/login?redirect=/contests/${slug}`" class="cpub-btn cpub-btn-primary cpub-btn-lg">
                <i class="fa-solid fa-right-to-bracket"></i> Log in to enter
              </NuxtLink>
            </div>
            <ContestEntries
              :entries="entries"
              :contest-status="c?.status"
              :contest-slug="slug"
              :current-user-id="user?.id"
              :community-voting-enabled="c?.communityVotingEnabled"
              @withdraw="withdrawEntry"
            />
          </div>

          <!-- PARTICIPANTS -->
          <div v-show="activeTab === 'participants'" id="cpub-panel-participants" role="tabpanel" aria-labelledby="cpub-tab-participants" tabindex="0">
            <div class="cpub-sec-head"><h2><i class="fa-solid fa-users" style="color: var(--accent);"></i> Participants</h2><span class="cpub-sec-sub">{{ participants.length }}</span></div>
            <div class="cpub-participant-grid">
              <NuxtLink v-for="p in participants" :key="p.username" :to="`/u/${p.username}`" class="cpub-participant">
                <span class="cpub-participant-av">
                  <img v-if="p.avatar" :src="p.avatar" :alt="p.name" />
                  <span v-else>{{ (p.name || p.username || '?').charAt(0).toUpperCase() }}</span>
                </span>
                <span class="cpub-participant-info">
                  <span class="cpub-participant-name">{{ p.name }}</span>
                  <span class="cpub-participant-meta">{{ p.count }} {{ p.count === 1 ? 'entry' : 'entries' }}</span>
                </span>
              </NuxtLink>
            </div>
          </div>

          <!-- JUDGES -->
          <div v-show="activeTab === 'judges'" id="cpub-panel-judges" role="tabpanel" aria-labelledby="cpub-tab-judges" tabindex="0">
            <ContestJudges :judges="judges" />
            <ContestJudgeManager v-if="isOwner && c" :contest-slug="slug" :is-owner="isOwner" @changed="refreshJudges" />
          </div>
        </div>

        <ContestSidebar :contest="c" :is-owner="isOwner" :can-judge="canJudge" @copy-link="copyLink" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* SUBMIT DIALOG */
.cpub-submit-overlay { position: fixed; inset: 0; z-index: 200; background: var(--color-surface-overlay-light); display: flex; align-items: center; justify-content: center; }
.cpub-submit-dialog { background: var(--surface); border: var(--border-width-default) solid var(--border); box-shadow: var(--shadow-xl); width: 560px; max-width: 92vw; }
.cpub-submit-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: var(--border-width-default) solid var(--border); }
.cpub-submit-header h2 { font-size: 14px; font-weight: 700; }
.cpub-submit-close { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 14px; }
.cpub-submit-body { padding: 16px; }
.cpub-submit-hint { font-size: 12px; color: var(--text-dim); margin-bottom: 12px; }
/* Gallery picker (replaces the old <select>): scrollable grid of content tiles. */
.cpub-submit-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; max-height: 50vh; overflow-y: auto; padding: 2px; }
.cpub-submit-new { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-align: center; min-height: 150px; border: var(--border-width-default) dashed var(--accent-border); background: var(--accent-bg); color: var(--accent); text-decoration: none; padding: 10px; }
.cpub-submit-new:hover { border-color: var(--accent); }
.cpub-submit-new-icon { font-size: 20px; }
.cpub-submit-new span { font-size: 12px; font-weight: 600; }
.cpub-submit-new small { font-size: 10px; color: var(--text-dim); line-height: 1.3; }
.cpub-submit-tile { display: flex; flex-direction: column; text-align: left; padding: 0; border: var(--border-width-default) solid var(--border); background: var(--surface); cursor: pointer; overflow: hidden; }
.cpub-submit-tile:hover:not(:disabled) { border-color: var(--accent); }
.cpub-submit-tile.selected { border-color: var(--accent); box-shadow: var(--shadow-accent); }
.cpub-submit-tile.entered { opacity: 0.5; cursor: not-allowed; }
.cpub-submit-tile-thumb { position: relative; aspect-ratio: 4 / 3; background: var(--surface2); display: flex; align-items: center; justify-content: center; color: var(--text-faint); overflow: hidden; }
.cpub-submit-tile-thumb img { width: 100%; height: 100%; object-fit: cover; }
.cpub-submit-tile-badge { position: absolute; top: 4px; right: 4px; font-size: 9px; font-family: var(--font-mono); text-transform: uppercase; background: var(--surface); border: var(--border-width-default) solid var(--border); padding: 1px 5px; color: var(--text-dim); }
.cpub-submit-tile-check { position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: var(--accent); color: var(--color-text-inverse); font-size: 10px; }
.cpub-submit-tile-title { font-size: 12px; font-weight: 600; padding: 6px 8px 2px; line-height: 1.3; }
.cpub-submit-tile-type { font-size: 9px; font-family: var(--font-mono); text-transform: uppercase; color: var(--text-faint); padding: 0 8px 8px; }
.cpub-submit-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: var(--border-width-default) solid var(--border); }

/* LAYOUT */
.cpub-contest-main { max-width: 1100px; margin: 0 auto; padding: 32px; }

.cpub-entries-cta { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 16px 20px; margin-bottom: 18px; background: var(--accent-bg); border: var(--border-width-default) solid var(--accent-border); }
.cpub-entries-cta-title { font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 8px; margin: 0; }
.cpub-entries-cta-title i { color: var(--accent); }
.cpub-entries-cta-sub { font-size: 12px; color: var(--text-dim); margin: 2px 0 0; }
.cpub-contest-layout { display: grid; grid-template-columns: 1fr 300px; gap: 28px; align-items: start; }
.cpub-contest-body { min-width: 0; }

/* INVITE BANNER */
.cpub-invite-banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 16px; margin-bottom: 18px; background: var(--accent-bg); border: var(--border-width-default) solid var(--accent-border); }
.cpub-invite-text { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--text); }
.cpub-invite-text i { color: var(--accent); }

/* TABS */
.cpub-tabbar { display: flex; gap: 2px; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; border-bottom: var(--border-width-default) solid var(--border); margin-bottom: 20px; }
.cpub-tabbar::-webkit-scrollbar { display: none; }
.cpub-tab { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; min-height: 40px; flex-shrink: 0; white-space: nowrap; background: none; border: none; border-bottom: 2px solid transparent; margin-bottom: -1px; font-family: var(--font-mono); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--text-faint); cursor: pointer; }
.cpub-tab:hover { color: var(--text-dim); }
.cpub-tab-active { color: var(--accent); border-bottom-color: var(--accent); }
.cpub-tab i { font-size: 11px; }
.cpub-tab-count { font-size: 9px; padding: 1px 6px; background: var(--surface2); border: var(--border-width-default) solid var(--border2); color: var(--text-dim); }
.cpub-tab-active .cpub-tab-count { background: var(--accent-bg); border-color: var(--accent-border); color: var(--accent); }

[role="tabpanel"]:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }

/* VISIBILITY BANNER */
.cpub-visibility-banner { display: flex; align-items: center; gap: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; color: var(--text-dim); background: var(--surface2); border: var(--border-width-default) solid var(--border); }
.cpub-visibility-banner i { color: var(--accent); }

/* SECTION HEADERS */
.cpub-sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.cpub-sec-head h2 { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.cpub-sec-sub { font-size: 11px; color: var(--text-faint); margin-left: auto; font-family: var(--font-mono); }

/* PARTICIPANTS */
.cpub-participant-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.cpub-participant { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--surface); border: var(--border-width-default) solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-md); text-decoration: none; }
.cpub-participant:hover { box-shadow: var(--shadow-accent); }
.cpub-participant-av { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; font-family: var(--font-mono); border: var(--border-width-default) solid var(--border); background: var(--surface3); color: var(--text-dim); overflow: hidden; }
.cpub-participant-av img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
.cpub-participant-info { display: flex; flex-direction: column; min-width: 0; }
.cpub-participant-name { font-size: 12px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cpub-participant-meta { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }
@media (max-width: 480px) { .cpub-participant-grid { grid-template-columns: 1fr; } }

/* ABOUT */
.cpub-about-section { margin-bottom: 20px; }
.cpub-about-card { background: var(--surface); border: var(--border-width-default) solid var(--border); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow-md); font-size: 12px; color: var(--text-dim); line-height: 1.7; }
.cpub-about-card p { margin: 0; white-space: pre-line; }

@media (max-width: 768px) {
  .cpub-contest-main { padding: 20px 16px; }
  .cpub-contest-layout { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
  .cpub-contest-main { padding: 16px 12px; }
}
</style>
