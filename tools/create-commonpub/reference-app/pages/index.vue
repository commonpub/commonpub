<script setup lang="ts">
import type { Serialized, ContentListItem, PaginatedResponse } from '@commonpub/server';

useSeoMeta({
  title: 'CommonPub — Edge AI & Maker Platform',
  description: 'Build, deploy, and document edge AI projects. Share with a community of makers.',
});

const { user: authUser } = useAuth();
const { hubs: hubsEnabled, contests: contestsEnabled, learning: learningEnabled, video: videoEnabled, docs: docsEnabled } = useFeatures();
const { enabledTypeMeta } = useContentTypes();

const activeTab = ref(authUser.value ? 'foryou' : 'latest');
const tabs = computed(() => [
  { value: 'foryou', label: 'For You', icon: 'fa-solid fa-sparkles' },
  { value: 'latest', label: 'Latest', icon: 'fa-solid fa-clock' },
  { value: 'following', label: 'Following', icon: 'fa-solid fa-user-group' },
  ...enabledTypeMeta.value.map(ct => ({ value: ct.type, label: ct.plural, icon: ct.icon })),
]);

const user = authUser;

const contentQuery = computed(() => ({
  status: 'published',
  type: ['foryou', 'latest', 'following'].includes(activeTab.value) ? undefined : activeTab.value,
  sort: activeTab.value === 'latest' ? 'recent' : activeTab.value === 'following' ? 'recent' : 'popular',
  ...(activeTab.value === 'following' && user.value?.id ? { followedBy: user.value.id } : {}),
  limit: 12,
}));

const { data: feed } = await useFetch<PaginatedResponse<Serialized<ContentListItem>>>('/api/content', {
  query: contentQuery,
  watch: [contentQuery],
});

const { data: featured } = await useFetch<PaginatedResponse<Serialized<ContentListItem>>>('/api/content', {
  query: { status: 'published', sort: 'popular', limit: 1 },
});

const { data: stats } = await useFetch('/api/stats');

const { data: communities } = await useFetch('/api/hubs', {
  query: { limit: 4 },
});

const { data: contests } = await useFetch('/api/contests', {
  query: { limit: 3 },
});

const heroDismissed = ref(false);
const joinedHubs = ref(new Set<string>());

// Active contest for hero banner
const activeContest = computed(() => {
  const items = contests.value?.items;
  return items?.find((c) => c.status === 'active') ?? null;
});

const isAuthenticated = computed(() => !!user.value);
const toast = useToast();

// Load more state
const feedOffset = ref(0);
const loadingMore = ref(false);
const allLoaded = ref(false);

async function loadMore(): Promise<void> {
  loadingMore.value = true;
  try {
    const nextOffset = (feed.value?.items?.length ?? 0);
    const more = await $fetch<{ items: Array<Record<string, unknown>> }>('/api/content', {
      query: {
        ...contentQuery.value,
        offset: nextOffset,
      },
    });
    if (more.items?.length) {
      if (feed.value?.items) {
        feed.value.items.push(...(more.items as typeof feed.value.items));
      }
    }
    if (!more.items?.length || more.items.length < 12) {
      allLoaded.value = true;
    }
  } catch {
    toast.error('Failed to load more');
  } finally {
    loadingMore.value = false;
  }
}

// Reset load more when tab changes
watch(activeTab, () => { allLoaded.value = false; });

async function handleHubJoin(hubSlug: string): Promise<void> {
  if (!isAuthenticated.value) {
    await navigateTo(`/auth/login?redirect=/`);
    return;
  }
  try {
    await $fetch(`/api/hubs/${hubSlug}/join`, { method: 'POST' });
    joinedHubs.value.add(hubSlug);
    toast.success('Joined hub!');
  } catch {
    toast.error('Failed to join hub');
  }
}
</script>

<template>
  <div>
    <!-- ═══ HERO BANNER ═══ -->
    <section v-if="!heroDismissed" class="cpub-hero-banner">
      <div class="cpub-hero-grid-bg" />
      <div class="cpub-hero-gradient" />
      <button class="cpub-hero-dismiss" title="Dismiss" @click="heroDismissed = true">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <div class="cpub-hero-inner">
        <div class="cpub-hero-content">
          <!-- Active contest hero -->
          <template v-if="contestsEnabled && activeContest">
            <div class="cpub-hero-eyebrow">
              <span class="cpub-hero-badge cpub-hero-badge-live"><span class="cpub-live-dot" /> Live Contest</span>
              <span class="cpub-hero-badge">{{ activeContest.entryCount ?? 0 }} entries</span>
            </div>
            <h1 class="cpub-hero-title">{{ activeContest.title }}</h1>
            <p v-if="activeContest.description" class="cpub-hero-excerpt">{{ activeContest.description }}</p>
            <div class="cpub-hero-actions">
              <NuxtLink :to="`/contests/${activeContest.slug}`" class="cpub-btn cpub-btn-primary"><i class="fa-solid fa-trophy"></i> Enter Contest</NuxtLink>
              <NuxtLink :to="`/contests/${activeContest.slug}`" class="cpub-btn"><i class="fa-solid fa-circle-info"></i> View Details</NuxtLink>
            </div>
            <div class="cpub-hero-meta">
              <span class="cpub-hero-stat"><i class="fa-solid fa-users"></i> <strong>{{ activeContest.entryCount ?? 0 }}</strong> entries</span>
              <span v-if="activeContest.endDate" class="cpub-hero-stat"><i class="fa-solid fa-calendar"></i> Ends <strong>{{ new Date(activeContest.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}</strong></span>
            </div>
          </template>
          <!-- Generic welcome hero (no active contest) -->
          <template v-else>
            <div class="cpub-hero-eyebrow">
              <span class="cpub-hero-badge cpub-hero-badge-live"><span class="cpub-live-dot" /> Open Source</span>
            </div>
            <h1 class="cpub-hero-title">
              Build. Document.<br>
              <span>Share.</span>
            </h1>
            <p class="cpub-hero-excerpt">
              CommonPub is an open platform for maker communities. Document your builds with rich editors, join hubs, learn with structured paths, and share with the world.
            </p>
            <div class="cpub-hero-actions">
              <NuxtLink to="/create" class="cpub-btn cpub-btn-primary"><i class="fa-solid fa-plus"></i> Start Building</NuxtLink>
              <NuxtLink to="/explore" class="cpub-btn"><i class="fa-solid fa-compass"></i> Explore</NuxtLink>
            </div>
          </template>
        </div>
        <div v-if="activeContest?.endDate" class="cpub-hero-aside">
          <CountdownTimer :target-date="activeContest.endDate" />
        </div>
      </div>
    </section>

    <!-- ═══ TABS BAR ═══ -->
    <div class="cpub-tabs-bar">
      <div class="cpub-tabs-inner">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="cpub-tab"
          :class="{ active: activeTab === tab.value }"
          @click="activeTab = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- ═══ MAIN LAYOUT ═══ -->
    <div class="cpub-main-layout">
      <!-- Feed column -->
      <main class="cpub-feed-col">

        <!-- Featured card -->
        <article v-if="featured?.items?.length && activeTab === 'foryou'" class="cpub-featured-card">
          <div class="cpub-featured-thumb">
            <i class="cpub-thumb-icon fa-solid fa-microchip" />
            <div class="cpub-thumb-overlay">
              <div class="cpub-thumb-badges">
                <span class="cpub-badge cpub-badge-featured">Featured</span>
                <ContentTypeBadge :type="featured.items[0].type" />
              </div>
            </div>
          </div>
          <div class="cpub-featured-body">
            <h2 class="cpub-featured-title">
              <NuxtLink :to="`/${featured.items[0].type}/${featured.items[0].slug}`">
                {{ featured.items[0].title }}
              </NuxtLink>
            </h2>
            <p v-if="featured.items[0].description" class="cpub-featured-excerpt">
              {{ featured.items[0].description }}
            </p>
            <div class="cpub-card-author-row">
              <AuthorRow :author="featured.items[0].author" :date="featured.items[0].publishedAt || featured.items[0].createdAt" />
              <div class="cpub-card-stats">
                <span class="cpub-stat-item"><i class="fa-solid fa-heart"></i> {{ featured.items[0].likeCount ?? 0 }}</span>
                <span class="cpub-stat-item"><i class="fa-solid fa-comment"></i> {{ featured.items[0].commentCount ?? 0 }}</span>
              </div>
            </div>
          </div>
        </article>

        <!-- Content grid (2-col) -->
        <div v-if="feed?.items?.length" class="cpub-content-grid">
          <ContentCard v-for="item in feed.items" :key="item.id" :item="item" />
        </div>
        <div v-else class="cpub-empty-state">
          <div class="cpub-empty-state-icon"><i :class="activeTab === 'following' ? 'fa-solid fa-user-group' : 'fa-solid fa-inbox'"></i></div>
          <template v-if="activeTab === 'following' && !isAuthenticated">
            <p class="cpub-empty-state-title">Sign in to see your feed</p>
            <p class="cpub-empty-state-desc">Follow creators to see their content here.</p>
            <NuxtLink to="/auth/login" class="cpub-btn cpub-btn-primary" style="margin-top: 12px;">Sign In</NuxtLink>
          </template>
          <template v-else-if="activeTab === 'following'">
            <p class="cpub-empty-state-title">No posts from people you follow</p>
            <p class="cpub-empty-state-desc">Follow some creators to fill up your feed!</p>
            <NuxtLink to="/explore" class="cpub-btn" style="margin-top: 12px;"><i class="fa-solid fa-compass"></i> Explore</NuxtLink>
          </template>
          <template v-else>
            <p class="cpub-empty-state-title">No content yet</p>
            <p class="cpub-empty-state-desc">Be the first to create something!</p>
          </template>
        </div>

        <div v-if="!allLoaded && feed?.items?.length" class="cpub-load-more-row">
          <button class="cpub-btn-load-more" :disabled="loadingMore" @click="loadMore">
            <i :class="loadingMore ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-rotate'"></i>
            {{ loadingMore ? 'Loading...' : 'Load more' }}
          </button>
        </div>
      </main>

      <!-- ─── SIDEBAR ─── -->
      <aside class="cpub-sidebar">
        <!-- Platform Stats -->
        <div class="cpub-sb-card">
          <div class="cpub-sb-head">Platform Stats</div>
          <div class="cpub-stats-grid">
            <div class="cpub-stat-block">
              <span class="cpub-stat-num">{{ stats?.content?.byType?.project ?? 0 }}</span>
              <span class="cpub-stat-lbl">Projects</span>
            </div>
            <div class="cpub-stat-block">
              <span class="cpub-stat-num">{{ stats?.content?.byType?.article ?? 0 }}</span>
              <span class="cpub-stat-lbl">Articles</span>
            </div>
            <div class="cpub-stat-block">
              <span class="cpub-stat-num">{{ stats?.users?.total ?? 0 }}</span>
              <span class="cpub-stat-lbl">Members</span>
            </div>
            <div v-if="hubsEnabled" class="cpub-stat-block">
              <span class="cpub-stat-num">{{ stats?.hubs?.total ?? 0 }}</span>
              <span class="cpub-stat-lbl">Hubs</span>
            </div>
          </div>
        </div>

        <!-- Active Contests -->
        <div v-if="contestsEnabled && contests?.items?.length" class="cpub-sb-card">
          <div class="cpub-sb-head">Active Contests <NuxtLink to="/contests">View all</NuxtLink></div>
          <div v-for="c in contests.items" :key="c.id" class="cpub-contest-item">
            <NuxtLink :to="`/contests/${c.slug}`" class="cpub-contest-name">{{ c.title }}</NuxtLink>
            <div class="cpub-contest-row">
              <span class="cpub-contest-entries">{{ c.entryCount ?? 0 }} entries</span>
              <span v-if="c.endDate" class="cpub-contest-deadline">
                <i class="fa-regular fa-clock"></i> {{ Math.max(0, Math.ceil((new Date(c.endDate).getTime() - Date.now()) / 86400000)) }}d left
              </span>
            </div>
            <NuxtLink :to="`/contests/${c.slug}`" class="cpub-btn-enter">Enter Contest</NuxtLink>
          </div>
        </div>

        <!-- Trending Hubs -->
        <div v-if="hubsEnabled && communities?.items?.length" class="cpub-sb-card">
          <div class="cpub-sb-head">Trending Hubs <NuxtLink to="/hubs">Browse</NuxtLink></div>
          <div v-for="hub in communities.items" :key="hub.id" class="cpub-hub-item">
            <div class="cpub-hub-icon">
              <i class="fa-solid fa-users"></i>
            </div>
            <div class="cpub-hub-info">
              <NuxtLink :to="`/hubs/${hub.slug}`" class="cpub-hub-name">{{ hub.name }}</NuxtLink>
              <div class="cpub-hub-members">{{ hub.memberCount ?? 0 }} members</div>
            </div>
            <button v-if="joinedHubs.has(hub.slug)" class="cpub-btn-joined" disabled><i class="fa-solid fa-check"></i> Joined</button>
            <button v-else class="cpub-btn-join" @click.prevent="handleHubJoin(hub.slug)">Join</button>
          </div>
        </div>

        <!-- Quick Links -->
        <div class="cpub-sb-card">
          <div class="cpub-sb-head">Explore</div>
          <div class="cpub-tag-cloud">
            <NuxtLink v-for="ct in enabledTypeMeta" :key="ct.type" :to="ct.route" class="cpub-trending-tag">{{ ct.plural }}</NuxtLink>
            <NuxtLink v-if="learningEnabled" to="/learn" class="cpub-trending-tag">Learn</NuxtLink>
            <NuxtLink v-if="videoEnabled" to="/videos" class="cpub-trending-tag">Videos</NuxtLink>
            <NuxtLink v-if="docsEnabled" to="/docs" class="cpub-trending-tag">Docs</NuxtLink>
          </div>
        </div>

        <!-- Powered badge -->
        <div class="cpub-powered-badge">
          <span class="cpub-powered-text">Powered by</span>
          <span class="cpub-powered-logo">[<span>C</span>] CommonPub</span>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* ─── HERO BANNER ─── */
.cpub-hero-banner {
  position: relative;
  background: var(--surface);
  border-bottom: 2px solid var(--border);
  overflow: hidden;
  min-height: 200px;
  display: flex;
  align-items: stretch;
}

.cpub-hero-grid-bg {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--border2) 1px, transparent 1px),
    linear-gradient(90deg, var(--border2) 1px, transparent 1px);
  background-size: 32px 32px;
  opacity: 0.25;
}

.cpub-hero-gradient {
  position: absolute;
  inset: 0;
  background: var(--surface2);
  opacity: 0.5;
}

.cpub-hero-dismiss {
  position: absolute;
  top: 12px;
  right: 16px;
  background: transparent;
  border: none;
  color: var(--text-faint);
  font-size: 12px;
  cursor: pointer;
  padding: 4px;
  z-index: 2;
}

.cpub-hero-dismiss:hover { color: var(--text-dim); }

.cpub-hero-inner {
  position: relative;
  z-index: 1;
  max-width: 1280px;
  margin: 0 auto;
  padding: 36px 32px;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 48px;
}

.cpub-hero-content { flex: 1; }

.cpub-hero-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.cpub-hero-badge {
  font-size: 9px;
  font-family: var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 3px 9px;
  background: var(--yellow-bg);
  border: 2px solid var(--yellow);
  color: var(--yellow);
}

.cpub-hero-badge-live {
  background: var(--green-bg);
  border-color: var(--green);
  color: var(--green);
  display: flex;
  align-items: center;
  gap: 5px;
}

.cpub-live-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--green);
  animation: cpub-pulse 2s ease-in-out infinite;
}

@keyframes cpub-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.cpub-hero-title {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
  margin-bottom: 10px;
}

.cpub-hero-title span { color: var(--accent); }

.cpub-hero-excerpt {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.65;
  margin-bottom: 20px;
  max-width: 560px;
}

.cpub-hero-actions { display: flex; gap: 8px; }

.cpub-hero-meta {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 16px;
}

.cpub-hero-stat {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  display: flex;
  align-items: center;
  gap: 6px;
}

.cpub-hero-stat strong { color: var(--text-dim); }

.cpub-hero-aside { flex-shrink: 0; }

/* ─── TABS BAR ─── */
.cpub-tabs-bar {
  position: sticky;
  top: 48px;
  background: var(--surface);
  border-bottom: 2px solid var(--border);
  z-index: 90;
  padding: 0 32px;
}

.cpub-tabs-inner {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  align-items: flex-end;
  gap: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.cpub-tabs-inner::-webkit-scrollbar { display: none; }

.cpub-tab {
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  padding: 10px 16px;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  background: none;
  border-top: none;
  border-left: none;
  border-right: none;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.cpub-tab:hover { color: var(--text-dim); }

.cpub-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

/* ─── MAIN LAYOUT ─── */
.cpub-main-layout {
  max-width: 1280px;
  margin: 0 auto;
  padding: 28px 32px 48px;
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 32px;
  align-items: start;
}

.cpub-feed-col { min-width: 0; }

/* ─── FEATURED CARD ─── */
.cpub-featured-card {
  background: var(--surface);
  border: 2px solid var(--border);
  overflow: hidden;
  margin-bottom: 24px;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-featured-thumb {
  height: 220px;
  background: var(--surface2);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cpub-featured-thumb::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--border2) 1px, transparent 1px),
    linear-gradient(90deg, var(--border2) 1px, transparent 1px);
  background-size: 24px 24px;
  opacity: 0.3;
}

.cpub-featured-thumb::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 30%, var(--bg) 100%);
}

.cpub-thumb-icon {
  position: relative;
  z-index: 1;
  font-size: 48px;
  opacity: 0.2;
  color: var(--teal);
}

.cpub-thumb-overlay {
  position: absolute;
  bottom: 14px;
  left: 16px;
  right: 16px;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.cpub-thumb-badges { display: flex; gap: 5px; }

.cpub-badge-featured {
  background: var(--yellow-bg);
  border: 2px solid var(--yellow);
  color: var(--yellow);
  font-size: 9px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  padding: 3px 8px;
}

.cpub-featured-body { padding: 20px 24px 18px; }

.cpub-featured-title {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 8px;
}

.cpub-featured-title a { color: var(--text); text-decoration: none; }
.cpub-featured-title a:hover { color: var(--accent); }

.cpub-featured-excerpt {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.65;
  margin-bottom: 14px;
}

.cpub-card-author-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cpub-card-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.cpub-stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-faint);
}

.cpub-stat-item i { font-size: 10px; }

/* ─── CONTENT GRID ─── */
.cpub-content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-bottom: 24px;
}

/* ─── LOAD MORE ─── */
.cpub-load-more-row {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
}

.cpub-btn-load-more {
  padding: 8px 28px;
  background: var(--surface);
  border: 2px solid var(--border);
  color: var(--text-dim);
  font-size: 12px;
  font-family: var(--font-mono);
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.15s;
  box-shadow: 2px 2px 0 var(--border);
  cursor: pointer;
}

.cpub-btn-load-more:hover {
  background: var(--surface2);
  color: var(--text);
  box-shadow: 4px 4px 0 var(--border);
  transform: translate(-1px, -1px);
}

/* ─── SIDEBAR ─── */
.cpub-sidebar {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.cpub-sb-head {
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  padding-bottom: 10px;
  border-bottom: 2px solid var(--border);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cpub-sb-head a {
  font-size: 10px;
  color: var(--accent);
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  text-decoration: none;
}

/* Stats grid */
.cpub-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.cpub-stat-block {
  background: var(--surface2);
  border: 2px solid var(--border);
  padding: 12px 14px;
}

.cpub-stat-num {
  font-size: 18px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text);
  line-height: 1;
  display: block;
  margin-bottom: 3px;
}

.cpub-stat-lbl {
  font-size: 10px;
  color: var(--text-faint);
  font-family: var(--font-mono);
}

/* Contest items */
.cpub-contest-item {
  padding: 10px 0;
  border-bottom: 1px solid var(--border2);
}

.cpub-contest-item:last-child { border-bottom: none; padding-bottom: 0; }
.cpub-contest-item:first-child { padding-top: 0; }

.cpub-contest-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 5px;
  line-height: 1.35;
  display: block;
  text-decoration: none;
}

.cpub-contest-name:hover { color: var(--accent); }

.cpub-contest-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.cpub-contest-entries {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
}

.cpub-contest-deadline {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.cpub-btn-enter {
  width: 100%;
  padding: 6px;
  background: var(--accent-bg);
  border: 2px solid var(--accent);
  color: var(--accent);
  font-size: 11px;
  font-family: var(--font-mono);
  text-align: center;
  text-decoration: none;
  display: block;
  transition: all 0.15s;
  cursor: pointer;
}

.cpub-btn-enter:hover {
  background: var(--accent);
  color: var(--color-text-inverse);
  border-color: var(--border);
  box-shadow: 2px 2px 0 var(--border);
}

/* Hub items */
.cpub-hub-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border2);
}

.cpub-hub-item:last-child { border-bottom: none; padding-bottom: 0; }
.cpub-hub-item:first-child { padding-top: 0; }

.cpub-hub-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  border: 2px solid var(--teal);
  background: var(--teal-bg);
  color: var(--teal);
}

.cpub-hub-info { flex: 1; min-width: 0; }

.cpub-hub-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 2px;
  display: block;
  text-decoration: none;
}

.cpub-hub-name:hover { color: var(--accent); }

.cpub-hub-members {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
}

.cpub-btn-join {
  padding: 4px 10px;
  background: var(--surface);
  border: 2px solid var(--border);
  color: var(--text-dim);
  font-size: 10px;
  font-family: var(--font-mono);
  flex-shrink: 0;
  transition: all 0.15s;
  cursor: pointer;
}

.cpub-btn-join:hover {
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 2px 2px 0 var(--border);
}

.cpub-btn-joined {
  padding: 4px 10px;
  background: var(--green-bg);
  border: 2px solid var(--green-border);
  color: var(--green);
  font-size: 10px;
  font-family: var(--font-mono);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: default;
}

/* Powered badge */
.cpub-powered-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: var(--surface);
  border: 2px solid var(--border);
}

.cpub-powered-text {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
}

.cpub-powered-logo {
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text-dim);
}

.cpub-powered-logo span { color: var(--accent); }

/* ─── TRENDING TAGS ─── */
.cpub-tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cpub-trending-tag {
  font-size: 10px;
  font-family: var(--font-mono);
  padding: 3px 10px;
  border: 2px solid var(--border);
  background: var(--surface2);
  color: var(--text-dim);
  text-decoration: none;
  transition: all 0.12s;
}

.cpub-trending-tag:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

/* ─── RESPONSIVE ─── */
@media (max-width: 1024px) {
  .cpub-main-layout {
    grid-template-columns: 1fr;
  }
  .cpub-hero-inner {
    flex-direction: column;
    gap: 24px;
  }
}

@media (max-width: 640px) {
  .cpub-content-grid {
    grid-template-columns: 1fr;
  }
  .cpub-hero-inner {
    padding: 24px 16px;
  }
  .cpub-main-layout {
    padding: 16px;
  }
}
</style>
