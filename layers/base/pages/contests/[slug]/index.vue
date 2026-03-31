<script setup lang="ts">
const route = useRoute();
const slug = route.params.slug as string;

const { data: contest } = useLazyFetch(`/api/contests/${slug}`);

useSeoMeta({
  title: () => `${contest.value?.title || 'Contest'} — CommonPub`,
  ogTitle: () => `${contest.value?.title || 'Contest'} — CommonPub`,
  ogImage: '/og-default.png',
});

// Fetch entries from API
const { data: apiEntriesData } = useLazyFetch<{ items: any[]; total: number }>(`/api/contests/${slug}/entries`);

const c = computed(() => contest.value);

// Countdown timer
const countdown = ref({ days: '00', hours: '00', mins: '00', secs: '00' });
let countdownInterval: ReturnType<typeof setInterval> | null = null;

function pad(n: number): string { return String(n).padStart(2, '0'); }

function updateCountdown(): void {
  const target = c.value?.endDate ? new Date(c.value.endDate) : new Date();
  const now = new Date();
  let diff = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const days = Math.floor(diff / 86400); diff %= 86400;
  const hours = Math.floor(diff / 3600); diff %= 3600;
  const mins = Math.floor(diff / 60);
  const secs = diff % 60;
  countdown.value = { days: pad(days), hours: pad(hours), mins: pad(mins), secs: pad(secs) };
}

onMounted(() => {
  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
});

onUnmounted(() => {
  if (countdownInterval) clearInterval(countdownInterval);
});

// FAQ accordion
const openFaq = ref<number>(0);
function toggleFaq(i: number): void {
  openFaq.value = openFaq.value === i ? -1 : i;
}

// Vote state
const toast = useToast();
const votedEntries = ref<Set<string>>(new Set());
async function toggleVote(entryId: string): Promise<void> {
  if (!isAuthenticated.value) {
    toast.error('Log in to vote');
    return;
  }
  try {
    await $fetch('/api/social/like', {
      method: 'POST',
      body: { targetId: entryId, targetType: 'contestEntry' },
    });
    if (votedEntries.value.has(entryId)) votedEntries.value.delete(entryId);
    else votedEntries.value.add(entryId);
  } catch {
    toast.error('Failed to vote');
  }
}

const entries = computed(() => {
  return apiEntriesData.value?.items ?? [];
});

const entryFilter = ref('all');
const filters = ['all', 'newest'];

// Admin contest management
const { isAuthenticated, isAdmin } = useAuth();
const transitioning = ref(false);

async function transitionStatus(newStatus: string): Promise<void> {
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
</script>

<template>
  <div class="cpub-contest">

    <!-- HERO -->
    <div class="cpub-hero">
      <div class="cpub-hero-pattern">
        <div class="cpub-hero-dots"></div>
        <div class="cpub-hero-lines"></div>
      </div>

      <div class="cpub-hero-inner">
        <div class="cpub-hero-eyebrow">
          <span class="cpub-contest-badge"><i class="fa fa-trophy" style="margin-right:5px;font-size:8px;"></i>Contest</span>
          <span class="cpub-hero-host">
            Hosted by
            <span class="cpub-av cpub-av-sm" style="background:var(--accent-bg);border-color:var(--accent);color:var(--accent);">CP</span>
            <strong style="color:var(--hero-text);">CommonPub</strong>
          </span>
        </div>

        <div class="cpub-hero-title">{{ c?.title || 'Contest' }}</div>
        <div class="cpub-hero-tagline">
          {{ c?.description || 'No description available.' }}
        </div>

        <div class="cpub-hero-meta">
          <span v-if="c?.startDate || c?.endDate" class="cpub-hero-meta-item"><i class="fa fa-calendar"></i> {{ c?.startDate ? new Date(c.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '' }}{{ c?.startDate && c?.endDate ? ' — ' : '' }}{{ c?.endDate ? new Date(c.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '' }}</span>
          <span v-if="c?.startDate || c?.endDate" class="cpub-hero-meta-sep">|</span>
          <span class="cpub-hero-meta-item"><i class="fa fa-folder-open"></i> {{ c?.entryCount ?? 0 }} entries</span>
        </div>

        <!-- COUNTDOWN -->
        <div class="cpub-countdown-section">
          <div class="cpub-countdown-label"><i class="fa fa-clock" style="margin-right:4px;color:var(--accent);"></i>{{ c?.status === 'judging' ? 'Judging ends in' : c?.status === 'completed' ? 'Contest ended' : 'Submissions close in' }}</div>
          <div class="cpub-countdown-row">
            <div class="cpub-countdown-block">
              <div class="cpub-countdown-val">{{ countdown.days }}</div>
              <div class="cpub-countdown-unit">Days</div>
            </div>
            <div class="cpub-countdown-sep">:</div>
            <div class="cpub-countdown-block">
              <div class="cpub-countdown-val">{{ countdown.hours }}</div>
              <div class="cpub-countdown-unit">Hours</div>
            </div>
            <div class="cpub-countdown-sep">:</div>
            <div class="cpub-countdown-block">
              <div class="cpub-countdown-val">{{ countdown.mins }}</div>
              <div class="cpub-countdown-unit">Minutes</div>
            </div>
            <div class="cpub-countdown-sep">:</div>
            <div class="cpub-countdown-block">
              <div class="cpub-countdown-val">{{ countdown.secs }}</div>
              <div class="cpub-countdown-unit">Seconds</div>
            </div>
          </div>
        </div>

        <div class="cpub-hero-cta">
          <button v-if="isAuthenticated && c?.status === 'active'" class="cpub-btn cpub-btn-primary cpub-btn-lg" @click="showSubmitDialog = true"><i class="fa fa-upload"></i> Submit Entry</button>
          <button class="cpub-btn cpub-btn-lg cpub-btn-dark"><i class="fa fa-file-lines"></i> View Rules</button>
          <button class="cpub-btn cpub-btn-sm cpub-btn-dark" style="margin-left:4px;"><i class="fa fa-bell"></i> Notify Me</button>
        </div>

        <!-- Admin controls -->
        <div v-if="isAdmin && c" class="cpub-admin-controls">
          <span class="cpub-admin-controls-label"><i class="fa-solid fa-shield-halved"></i> Admin</span>
          <button v-if="c.status === 'upcoming'" class="cpub-btn cpub-btn-sm" :disabled="transitioning" @click="transitionStatus('active')"><i class="fa-solid fa-play"></i> Activate</button>
          <button v-if="c.status === 'active'" class="cpub-btn cpub-btn-sm" :disabled="transitioning" @click="transitionStatus('judging')"><i class="fa-solid fa-gavel"></i> Start Judging</button>
          <button v-if="c.status === 'judging'" class="cpub-btn cpub-btn-sm" :disabled="transitioning" @click="transitionStatus('completed')"><i class="fa-solid fa-check"></i> Complete</button>
          <span class="cpub-admin-status">Status: <strong>{{ c.status }}</strong></span>
        </div>

        <div class="cpub-hero-stats">
          <div class="cpub-hero-stat">
            <div class="cpub-hero-stat-val">{{ c?.entryCount ?? 0 }}</div>
            <div class="cpub-hero-stat-label">Entries</div>
          </div>
          <div class="cpub-hero-stat">
            <div class="cpub-hero-stat-val">{{ c?.status ?? 'draft' }}</div>
            <div class="cpub-hero-stat-label">Status</div>
          </div>
        </div>
      </div>
    </div>

    <!-- SUBMIT ENTRY DIALOG -->
    <div v-if="showSubmitDialog" class="cpub-submit-overlay" @click.self="showSubmitDialog = false">
      <div class="cpub-submit-dialog" role="dialog" aria-label="Submit entry">
        <div class="cpub-submit-header">
          <h2 style="font-size: 14px; font-weight: 700;">Submit Entry</h2>
          <button style="background:none;border:none;color:var(--text-faint);cursor:pointer;font-size:14px;" @click="showSubmitDialog = false"><i class="fa-solid fa-times"></i></button>
        </div>
        <div class="cpub-submit-body">
          <p style="font-size: 12px; color: var(--text-dim); margin-bottom: 12px;">Select one of your published projects to submit as an entry.</p>
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

        <!-- MAIN COLUMN -->
        <div>

          <!-- ABOUT -->
          <div style="margin-bottom:20px;">
            <div class="cpub-sec-head">
              <h2><i class="fa fa-circle-info" style="color:var(--accent);margin-right:6px;"></i>About This Contest</h2>
            </div>
            <div class="cpub-about-card">
              <div class="cpub-about-body">
                <p>{{ c?.description || 'No description available for this contest.' }}</p>
              </div>
            </div>
          </div>

          <!-- RULES -->
          <div v-if="c?.rules" style="margin-bottom:20px;">
            <div class="cpub-sec-head">
              <h2><i class="fa fa-file-lines" style="color:var(--purple);margin-right:6px;"></i>Rules</h2>
            </div>
            <div class="cpub-rules-card">
              <div class="cpub-about-body" style="white-space: pre-line;">{{ c.rules }}</div>
            </div>
          </div>

          <!-- ENTRIES -->
          <div style="margin-bottom:20px;">
            <div class="cpub-sec-head">
              <h2><i class="fa fa-box-open" style="color:var(--teal);margin-right:6px;"></i>Submitted Entries</h2>
              <span class="cpub-sec-sub">{{ c?.entryCount ?? entries.length }} entries</span>
            </div>
            <div v-if="entries.length" class="cpub-entry-grid">
              <div
                v-for="(entry, i) in entries"
                :key="entry.id"
                class="cpub-entry-card"
              >
                <div class="cpub-entry-thumb" :class="i % 2 === 0 ? 'cpub-entry-bg-light' : 'cpub-entry-bg-dark'">
                  <div class="cpub-entry-grid-pat"></div>
                  <div class="cpub-entry-icon" style="color: var(--accent)"><i class="fa-solid fa-microchip"></i></div>
                  <span v-if="entry.rank" class="cpub-entry-rank" :class="`cpub-rank-${entry.rank}`">#{{ entry.rank }}</span>
                </div>
                <div class="cpub-entry-body">
                  <NuxtLink :to="`/${entry.contentType}/${entry.contentSlug}`" class="cpub-entry-title">{{ entry.contentTitle || `Entry #${i + 1}` }}</NuxtLink>
                  <div class="cpub-entry-author">
                    <NuxtLink v-if="entry.authorUsername" :to="`/u/${entry.authorUsername}`" style="color: var(--text-dim); text-decoration: none;">{{ entry.authorName }}</NuxtLink>
                    <span class="cpub-entry-meta">{{ new Date(entry.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}</span>
                  </div>
                  <div class="cpub-entry-footer">
                    <button
                      class="cpub-vote-btn"
                      :class="{ 'cpub-voted': votedEntries.has(entry.id) }"
                      @click.prevent="toggleVote(entry.id)"
                    ><i class="fa fa-arrow-up"></i> Vote</button>
                    <span v-if="entry.score != null" class="cpub-entry-views">Score: {{ entry.score }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="cpub-empty-state" style="padding: 32px 0;">
              <div class="cpub-empty-state-icon"><i class="fa-solid fa-box-open"></i></div>
              <p class="cpub-empty-state-title">No entries yet</p>
              <p class="cpub-empty-state-desc">Be the first to submit an entry!</p>
            </div>
          </div>

        </div>

        <!-- SIDEBAR -->
        <div>

          <!-- STATUS -->
          <div class="cpub-sb-card">
            <div class="cpub-sb-title"><i class="fa-solid fa-circle-info" style="margin-right:5px;"></i>Status</div>
            <div style="font-size: 12px; color: var(--text-dim); display: flex; flex-direction: column; gap: 8px;">
              <div><strong>Status:</strong> {{ c?.status ?? 'unknown' }}</div>
              <div v-if="c?.startDate"><strong>Starts:</strong> {{ new Date(c.startDate).toLocaleDateString() }}</div>
              <div v-if="c?.endDate"><strong>Ends:</strong> {{ new Date(c.endDate).toLocaleDateString() }}</div>
              <div><strong>Entries:</strong> {{ c?.entryCount ?? 0 }}</div>
            </div>
          </div>

          <!-- SHARE -->
          <div class="cpub-sb-card">
            <div class="cpub-sb-title"><i class="fa-solid fa-share-nodes" style="margin-right:5px;"></i>Share This Contest</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="cpub-btn cpub-btn-sm" style="flex:1;justify-content:center;" @click="copyLink()"><i class="fa fa-link"></i> Copy Link</button>
            </div>
          </div>

          <NuxtLink to="/contests" class="cpub-btn" style="width: 100%; text-align: center; display: block; margin-top: 12px;"><i class="fa fa-arrow-left"></i> All Contests</NuxtLink>
        </div>

      </div>
    </div>

  </div>
</template>

<style scoped>
/* Hero uses a dark context — local custom properties for dark-bg values */
.cpub-hero {
  --hero-bg: var(--text);
  --hero-text: var(--color-text-inverse);
  --hero-text-dim: var(--text-faint);
  --hero-border: rgba(255, 255, 255, 0.15);
  --hero-surface: rgba(255, 255, 255, 0.06);
}

/* Metallic prize colors — no token equivalents */
.cpub-contest {
  --silver: var(--text-faint);
  --bronze: #a0724a;
}

/* SUBMIT DIALOG */
.cpub-submit-overlay { position: fixed; inset: 0; z-index: 200; background: var(--color-surface-overlay-light); display: flex; align-items: center; justify-content: center; }
.cpub-submit-dialog { background: var(--surface); border: 2px solid var(--border); box-shadow: var(--shadow-xl); width: 420px; max-width: 90vw; }
.cpub-submit-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 2px solid var(--border); }
.cpub-submit-body { padding: 16px; }
.cpub-submit-select { width: 100%; padding: 8px 10px; border: 2px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; }
.cpub-submit-select:focus { border-color: var(--accent); outline: none; }
.cpub-submit-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 2px solid var(--border); }

/* HERO */
.cpub-hero { position: relative; overflow: hidden; background: var(--hero-bg); padding: 56px 0 48px; }
.cpub-hero-pattern { position: absolute; inset: 0; }
.cpub-hero-dots { position: absolute; inset: 0; background-image: radial-gradient(var(--accent-border) 1.5px, transparent 1.5px); background-size: 28px 28px; opacity: .3; }
.cpub-hero-lines { position: absolute; inset: 0; background-image: linear-gradient(var(--accent-bg) 1px, transparent 1px), linear-gradient(90deg, var(--accent-bg) 1px, transparent 1px); background-size: 56px 56px; }
.cpub-hero-inner { max-width: 1100px; margin: 0 auto; padding: 0 32px; position: relative; z-index: 1; }
.cpub-hero-eyebrow { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.cpub-contest-badge { font-size: 9px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; font-family: var(--font-mono); color: var(--accent); background: var(--accent-bg); border: 2px solid var(--accent); padding: 3px 10px; border-radius: var(--radius); }
.cpub-hero-host { font-size: 11px; color: var(--hero-text-dim); font-family: var(--font-mono); display: flex; align-items: center; gap: 6px; }
.cpub-hero-title { font-size: 36px; font-weight: 800; letter-spacing: -.03em; line-height: 1.1; margin-bottom: 10px; color: var(--hero-text); }
.cpub-hero-highlight { color: var(--accent); }
.cpub-hero-tagline { font-size: 14px; color: var(--hero-text-dim); line-height: 1.55; max-width: 580px; margin-bottom: 28px; }
.cpub-hero-meta { display: flex; align-items: center; gap: 20px; font-size: 11px; color: var(--hero-text-dim); font-family: var(--font-mono); margin-bottom: 28px; }
.cpub-hero-meta-item { display: flex; align-items: center; gap: 5px; }
.cpub-hero-meta-sep { color: var(--hero-border); }

/* COUNTDOWN */
.cpub-countdown-section { margin-bottom: 28px; }
.cpub-countdown-label { font-size: 10px; font-family: var(--font-mono); color: var(--hero-text-dim); letter-spacing: .1em; text-transform: uppercase; margin-bottom: 10px; }
.cpub-countdown-row { display: flex; align-items: center; gap: 8px; }
.cpub-countdown-block { display: flex; flex-direction: column; align-items: center; background: var(--hero-surface); border: 2px solid var(--hero-border); border-radius: var(--radius); padding: 10px 16px; min-width: 60px; box-shadow: 4px 4px 0 var(--hero-surface); }
.cpub-countdown-val { font-size: 26px; font-weight: 700; font-family: var(--font-mono); color: var(--hero-text); line-height: 1; margin-bottom: 4px; }
.cpub-countdown-unit { font-size: 9px; text-transform: uppercase; letter-spacing: .1em; color: var(--hero-text-dim); font-family: var(--font-mono); }
.cpub-countdown-sep { font-size: 20px; font-weight: 700; color: var(--hero-border); margin-top: -8px; font-family: var(--font-mono); }

/* HERO CTA & STATS */
.cpub-hero-cta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.cpub-total-prize { font-size: 12px; color: var(--hero-text-dim); font-family: var(--font-mono); display: flex; align-items: center; gap: 6px; padding-left: 10px; border-left: 2px solid var(--hero-border); }
.cpub-total-prize strong { color: var(--yellow); font-size: 15px; }
.cpub-hero-stats { display: flex; gap: 24px; margin-top: 28px; padding-top: 24px; border-top: 2px solid var(--hero-border); }
.cpub-hero-stat { display: flex; flex-direction: column; }
.cpub-hero-stat-val { font-size: 20px; font-weight: 700; font-family: var(--font-mono); color: var(--hero-text); }
.cpub-hero-stat-label { font-size: 10px; color: var(--hero-text-dim); text-transform: uppercase; letter-spacing: .1em; font-family: var(--font-mono); }

/* BUTTONS (page-specific) */
.cpub-btn-lg { padding: 10px 22px; font-size: 13px; }
.cpub-btn-dark { background: var(--hero-surface); color: var(--hero-text); border-color: var(--hero-border); }
.cpub-btn-dark:hover { background: var(--hero-surface); }

/* AVATARS */
.cpub-av { display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 600; font-family: var(--font-mono); flex-shrink: 0; background: var(--surface3); border: 2px solid var(--border); color: var(--text-dim); }
.cpub-av-sm { width: 24px; height: 24px; font-size: 9px; }

/* LAYOUT */
.cpub-contest-main { max-width: 1100px; margin: 0 auto; padding: 32px; }
.cpub-contest-layout { display: grid; grid-template-columns: 1fr 300px; gap: 28px; align-items: start; }

/* SECTION HEADERS (page-specific) */
.cpub-sec-sub { font-size: 11px; color: var(--text-faint); margin-left: auto; font-family: var(--font-mono); }

/* ABOUT */
.cpub-about-card { background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius); padding: 20px; margin-bottom: 20px; box-shadow: var(--shadow-md); }
.cpub-about-body { font-size: 12px; color: var(--text-dim); line-height: 1.7; }
.cpub-about-body p { margin-bottom: 10px; }
.cpub-about-body p:last-child { margin-bottom: 0; }
.cpub-highlight-box { background: var(--accent-bg); border: 2px solid var(--accent); border-radius: var(--radius); padding: 12px 14px; margin: 12px 0; font-size: 11px; color: var(--text-dim); }
.cpub-highlight-box strong { color: var(--accent); }

/* PRIZES */
.cpub-prize-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
.cpub-prize-card { border-radius: var(--radius); padding: 20px; position: relative; overflow: hidden; text-align: center; background: var(--surface); border: 2px solid var(--border); }
.cpub-prize-gold { box-shadow: var(--shadow-accent); }
.cpub-prize-silver { box-shadow: var(--shadow-md); }
.cpub-prize-bronze { box-shadow: var(--shadow-md); }
.cpub-prize-rank { font-size: 11px; font-family: var(--font-mono); font-weight: 600; letter-spacing: .08em; margin-bottom: 8px; position: relative; z-index: 1; }
.cpub-prize-rank-gold { color: var(--yellow); }
.cpub-prize-rank-silver { color: var(--silver); }
.cpub-prize-rank-bronze { color: var(--bronze); }
.cpub-prize-icon { font-size: 28px; margin-bottom: 8px; position: relative; z-index: 1; }
.cpub-prize-icon-gold { color: var(--yellow); }
.cpub-prize-icon-silver { color: var(--silver); }
.cpub-prize-icon-bronze { color: var(--bronze); }
.cpub-prize-amount { font-size: 24px; font-weight: 800; font-family: var(--font-mono); margin-bottom: 4px; position: relative; z-index: 1; }
.cpub-prize-amount-gold { color: var(--yellow); }
.cpub-prize-amount-silver { color: var(--silver); }
.cpub-prize-amount-bronze { color: var(--bronze); }
.cpub-prize-label { font-size: 10px; color: var(--text-faint); margin-bottom: 10px; font-family: var(--font-mono); position: relative; z-index: 1; }
.cpub-prize-perks { text-align: left; position: relative; z-index: 1; }
.cpub-prize-perk { font-size: 10px; color: var(--text-dim); display: flex; align-items: center; gap: 5px; margin-bottom: 3px; font-family: var(--font-mono); }
.cpub-prize-perk i { font-size: 8px; color: var(--green); }
.cpub-prize-additional { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.cpub-prize-extra { background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius); padding: 12px; text-align: center; box-shadow: var(--shadow-md); }
.cpub-prize-extra-title { font-size: 11px; font-weight: 600; margin-bottom: 2px; }
.cpub-prize-extra-val { font-size: 14px; font-weight: 700; font-family: var(--font-mono); color: var(--teal); }
.cpub-prize-extra-label { font-size: 9px; color: var(--text-faint); font-family: var(--font-mono); }

/* RULES */
.cpub-rules-card { background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius); padding: 20px; margin-bottom: 20px; box-shadow: var(--shadow-md); }
.cpub-rule-item { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; font-size: 12px; color: var(--text-dim); line-height: 1.55; }
.cpub-rule-item:last-child { margin-bottom: 0; }
.cpub-rule-icon { font-size: 11px; color: var(--accent); margin-top: 2px; flex-shrink: 0; width: 14px; }

/* ENTRIES */
.cpub-entries-filter { display: flex; gap: 6px; margin-bottom: 14px; }
.cpub-entry-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.cpub-entry-card { background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius); overflow: hidden; cursor: pointer; box-shadow: var(--shadow-md); }
.cpub-entry-card:hover { box-shadow: var(--shadow-accent); }
.cpub-entry-thumb { height: 110px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.cpub-entry-bg-light { background: var(--surface2); }
.cpub-entry-bg-dark { background: var(--surface3); }
.cpub-entry-grid-pat { position: absolute; inset: 0; background-image: linear-gradient(var(--border2) 1px, transparent 1px), linear-gradient(90deg, var(--border2) 1px, transparent 1px); background-size: 20px 20px; opacity: .3; }
.cpub-entry-icon { position: relative; z-index: 1; font-size: 22px; opacity: .65; }
.cpub-entry-rank { position: absolute; top: 8px; left: 8px; z-index: 2; font-size: 10px; font-family: var(--font-mono); font-weight: 700; padding: 2px 7px; border-radius: var(--radius); }
.cpub-rank-1 { background: var(--yellow-bg); color: var(--yellow); border: 2px solid var(--yellow); }
.cpub-rank-2 { background: var(--surface2); color: var(--silver); border: 2px solid var(--silver); }
.cpub-rank-3 { background: var(--surface2); color: var(--bronze); border: 2px solid var(--bronze); }
.cpub-entry-body { padding: 10px 12px; }
.cpub-entry-title { font-size: 12px; font-weight: 600; margin-bottom: 3px; line-height: 1.3; }
.cpub-entry-author { font-size: 10px; color: var(--text-dim); font-family: var(--font-mono); margin-bottom: 6px; display: flex; align-items: center; gap: 5px; }
.cpub-entry-footer { display: flex; align-items: center; gap: 6px; }
.cpub-vote-btn { display: flex; align-items: center; gap: 4px; font-size: 10px; font-family: var(--font-mono); padding: 3px 8px; border-radius: var(--radius); border: 2px solid var(--border); background: var(--surface); color: var(--text-dim); cursor: pointer; }
.cpub-vote-btn:hover { background: var(--surface2); }
.cpub-vote-btn i { font-size: 9px; }
.cpub-voted { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); }
.cpub-entry-views { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); margin-left: auto; display: flex; align-items: center; gap: 3px; }

/* JUDGES */
.cpub-judges-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
.cpub-judge-card { background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius); padding: 14px; text-align: center; box-shadow: var(--shadow-md); }
.cpub-judge-av { width: 44px; height: 44px; border-radius: 50%; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; font-family: var(--font-mono); border: 2px solid var(--border); }
.cpub-judge-name { font-size: 11px; font-weight: 600; margin-bottom: 2px; }
.cpub-judge-title { font-size: 10px; color: var(--text-dim); line-height: 1.35; font-family: var(--font-mono); }
.cpub-judge-org { font-size: 10px; color: var(--accent); font-family: var(--font-mono); margin-top: 2px; }

/* TIMELINE */
.cpub-tl-item { display: flex; gap: 12px; margin-bottom: 14px; position: relative; }
.cpub-tl-item:not(.cpub-tl-last)::before { content: ''; position: absolute; left: 10px; top: 20px; bottom: -14px; width: 2px; background: var(--border); }
.cpub-tl-last { margin-bottom: 0; }
.cpub-tl-icon { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 8px; margin-top: 1px; }
.cpub-tl-done { background: var(--green-bg); border: 2px solid var(--green); color: var(--green); }
.cpub-tl-active { background: var(--accent-bg); border: 2px solid var(--accent); color: var(--accent); }
.cpub-tl-upcoming { background: var(--surface2); border: 2px solid var(--border2); color: var(--text-faint); }
.cpub-tl-info { flex: 1; padding-top: 1px; }
.cpub-tl-name { font-size: 11px; font-weight: 600; margin-bottom: 1px; }
.cpub-tl-name-done { color: var(--green); }
.cpub-tl-name-active { color: var(--text); }
.cpub-tl-name-upcoming { color: var(--text-faint); }
.cpub-tl-date { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-tl-status { font-size: 9px; font-family: var(--font-mono); padding: 1px 5px; border-radius: var(--radius); }
.cpub-status-done { color: var(--green); background: var(--green-bg); border: 2px solid var(--green); }
.cpub-status-active { color: var(--accent); background: var(--accent-bg); border: 2px solid var(--accent); }

/* SPONSORS */
.cpub-sponsor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cpub-sponsor-card { background: var(--surface2); border: 2px solid var(--border); border-radius: var(--radius); padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
.cpub-sponsor-icon { font-size: 16px; margin-bottom: 2px; color: var(--text-dim); }
.cpub-sponsor-name { font-size: 10px; font-weight: 600; font-family: var(--font-mono); color: var(--text); }
.cpub-sponsor-tier { font-size: 8px; font-family: var(--font-mono); color: var(--text-faint); }
.cpub-sponsor-link { font-size: 11px; color: var(--accent); text-decoration: none; font-family: var(--font-mono); }
.cpub-sponsor-link:hover { text-decoration: underline; }

/* FAQ */
.cpub-faq-wrap { box-shadow: none; padding: 0; border: none; background: transparent; }
.cpub-faq-item { border: 2px solid var(--border); margin-bottom: -2px; overflow: hidden; }
.cpub-faq-item:first-of-type { border-top: 2px solid var(--border); }
.cpub-faq-q { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; cursor: pointer; font-size: 11px; font-weight: 500; gap: 8px; background: var(--surface); }
.cpub-faq-q:hover { background: var(--surface2); color: var(--accent); }
.cpub-faq-q i { font-size: 10px; color: var(--text-faint); flex-shrink: 0; transition: transform .15s; }
.cpub-faq-open .cpub-faq-q i { transform: rotate(180deg); }
.cpub-faq-open .cpub-faq-q { background: var(--surface2); border-bottom: 2px solid var(--border2); }
.cpub-faq-a { font-size: 11px; color: var(--text-dim); line-height: 1.55; padding: 10px 12px; display: none; background: var(--surface); }
.cpub-faq-open .cpub-faq-a { display: block; }

/* Admin controls */
.cpub-admin-controls {
  display: flex; align-items: center; gap: 8px; margin-top: 16px;
  padding: 10px 14px; background: var(--accent-bg); border: 2px solid var(--accent-border);
}
.cpub-admin-controls-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--accent); margin-right: 4px; font-family: var(--font-mono);
}
.cpub-admin-status {
  font-size: 11px; color: var(--text-dim); margin-left: auto; font-family: var(--font-mono);
}
.cpub-admin-status strong { color: var(--accent); text-transform: capitalize; }
</style>
