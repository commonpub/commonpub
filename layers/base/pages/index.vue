<script setup lang="ts">
import type { Serialized, ContentListItem, PaginatedResponse, HomepageSection } from '@commonpub/server';

useSeoMeta({
  title: `${useSiteName()} — Open Maker Platform`,
  description: 'Build, document, and share your projects with a community of makers.',
});

// Fetch configurable homepage sections (from DB or defaults)
const { data: homepageSections } = await useFetch<HomepageSection[]>('/api/homepage/sections');
const hasCustomSections = computed(() => !!homepageSections.value?.length);
const sortedSections = computed(() =>
  [...(homepageSections.value ?? [])].sort((a, b) => a.order - b.order),
);

const { user: authUser } = useAuth();
const { hubs: hubsEnabled, contests: contestsEnabled, learning: learningEnabled, video: videoEnabled, docs: docsEnabled, editorial: editorialEnabled } = useFeatures();
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

const { data: feed, pending: feedPending } = await useFetch<PaginatedResponse<Serialized<ContentListItem>>>('/api/content', {
  query: contentQuery,
  watch: [contentQuery],
});

// Editorial picks — staff-curated content for the homepage (only when editorial feature is enabled)
const { data: editorialPicks } = editorialEnabled.value
  ? await useFetch<PaginatedResponse<Serialized<ContentListItem>>>('/api/content', {
      query: { status: 'published', editorial: true, sort: 'editorial', limit: 3 },
    })
  : { data: ref(null) };

// Legacy featured fallback — if no editorial picks, show single featured card
const { data: featured } = await useFetch<PaginatedResponse<Serialized<ContentListItem>>>('/api/content', {
  query: { status: 'published', featured: true, limit: 1 },
});

const { data: stats, pending: statsPending } = await useFetch('/api/stats');

const { data: communities, pending: communitiesPending } = await useFetch('/api/hubs', {
  query: { limit: 4 },
});

interface ContestListItem {
  id: string;
  slug: string;
  title: string;
  status: string;
  description?: string | null;
  bannerUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  entryCount?: number;
}

const { data: contests, pending: contestsPending } = await useFetch<{ items: ContestListItem[] }>('/api/contests', {
  query: { limit: 3 },
});

// Shared with HeroSection.vue via the same useState key so the dismiss
// persists across the configurable-renderer and legacy code paths.
const heroDismissed = useState('cpub:hero-dismissed', () => false);
const joinedHubs = ref(new Set<string>());

// Active contest for hero banner
const activeContest = computed<ContestListItem | null>(() => {
  const items = contests.value?.items;
  return items?.find((c: ContestListItem) => c.status === 'active') ?? null;
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
    <!-- ═══ CONFIGURABLE HOMEPAGE (section renderer) ═══ -->
    <template v-if="hasCustomSections">
      <!-- Full-width sections (hero) -->
      <HomepageSectionRenderer :sections="sortedSections" zone="full-width" />

      <!-- 2-column layout: main + sidebar -->
      <div class="cpub-main-layout">
        <main class="cpub-feed-col">
          <HomepageSectionRenderer :sections="sortedSections" zone="main" />
        </main>
        <aside class="cpub-sidebar">
          <HomepageSectionRenderer :sections="sortedSections" zone="sidebar" />
          <!-- Powered badge -->
          <div class="cpub-powered-badge">
            <span class="cpub-powered-text">Powered by</span>
            <span class="cpub-powered-logo">[<span>C</span>] CommonPub</span>
          </div>
        </aside>
      </div>
    </template>

    <!-- ═══ LEGACY HARDCODED HOMEPAGE (fallback) ═══ -->
    <template v-else>

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
        <!-- Large textured Town Square logo — shown for Agora theme when no contest -->
        <div v-if="!activeContest" class="cpub-hero-aside cpub-hero-logo-aside">
          <svg class="cpub-hero-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" aria-hidden="true">
            <defs>
              <filter id="cpub-hero-tex" x="-5%" y="-5%" width="110%" height="110%">
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise"/>
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="2"/>
              </filter>
            </defs>
            <g filter="url(#cpub-hero-tex)">
              <rect x="18" y="18" width="72" height="72" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linejoin="round"/>
              <rect x="110" y="18" width="72" height="72" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linejoin="round"/>
              <rect x="18" y="110" width="72" height="72" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linejoin="round"/>
              <rect x="110" y="110" width="72" height="72" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linejoin="round"/>
              <rect x="90" y="90" width="20" height="20" fill="var(--accent, #3d8b5e)"/>
              <rect x="84" y="84" width="6" height="6" fill="var(--accent, #3d8b5e)" opacity="0.6"/>
              <rect x="110" y="84" width="6" height="6" fill="var(--accent, #3d8b5e)" opacity="0.6"/>
              <rect x="84" y="110" width="6" height="6" fill="var(--accent, #3d8b5e)" opacity="0.6"/>
              <rect x="110" y="110" width="6" height="6" fill="var(--accent, #3d8b5e)" opacity="0.6"/>
              <line x1="32" y1="40" x2="76" y2="40" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.15"/>
              <line x1="32" y1="52" x2="66" y2="52" stroke="var(--accent, #3d8b5e)" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
              <line x1="32" y1="64" x2="72" y2="64" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.15"/>
              <line x1="124" y1="40" x2="168" y2="40" stroke="var(--accent, #3d8b5e)" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
              <line x1="124" y1="52" x2="158" y2="52" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.15"/>
              <line x1="124" y1="64" x2="164" y2="64" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.15"/>
              <line x1="32" y1="132" x2="76" y2="132" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.15"/>
              <line x1="32" y1="144" x2="62" y2="144" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.15"/>
              <line x1="32" y1="156" x2="70" y2="156" stroke="var(--accent, #3d8b5e)" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
              <line x1="124" y1="132" x2="168" y2="132" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.15"/>
              <line x1="124" y1="144" x2="160" y2="144" stroke="var(--accent, #3d8b5e)" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
              <line x1="124" y1="156" x2="152" y2="156" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.15"/>
            </g>
          </svg>
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

        <!-- Editorial Picks Section -->
        <section v-if="editorialEnabled && editorialPicks?.items?.length && activeTab === 'foryou'" class="cpub-editorial-section">
          <div class="cpub-editorial-header">
            <h2 class="cpub-editorial-heading"><i class="fa-solid fa-pen-fancy"></i> Staff Picks</h2>
          </div>
          <div class="cpub-editorial-grid" :class="{ 'cpub-editorial-single': editorialPicks.items.length === 1 }">
            <ContentCard v-for="item in editorialPicks.items" :key="item.id" :item="item" />
          </div>
        </section>

        <!-- Legacy featured card (shown when no editorial picks exist) -->
        <article v-else-if="featured?.items?.length && activeTab === 'foryou'" class="cpub-featured-card">
          <div class="cpub-featured-thumb" :style="featured.items[0].coverImageUrl ? { backgroundImage: `url(${featured.items[0].coverImageUrl.includes('://') && !featured.items[0].coverImageUrl.includes(useRuntimeConfig().public?.domain as string || 'localhost') ? `/api/image-proxy?url=${encodeURIComponent(featured.items[0].coverImageUrl)}&w=900` : featured.items[0].coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}">
            <i v-if="!featured.items[0].coverImageUrl" class="cpub-thumb-icon fa-solid fa-microchip" />
            <div class="cpub-thumb-overlay">
              <div class="cpub-thumb-badges">
                <span class="cpub-badge cpub-badge-featured">Featured</span>
                <ContentTypeBadge :type="featured.items[0].type" />
              </div>
            </div>
          </div>
          <div class="cpub-featured-body">
            <h2 class="cpub-featured-title">
              <NuxtLink :to="`/u/${featured.items[0].author?.username}/${featured.items[0].type}/${featured.items[0].slug}`">
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

        <!-- Active Contest Banner (compact, below hero) -->
        <NuxtLink v-if="contestsEnabled && activeContest" :to="`/contests/${activeContest.slug}`" class="cpub-contest-banner">
          <div class="cpub-contest-banner-info">
            <span class="cpub-contest-banner-label"><i class="fa-solid fa-trophy"></i> {{ activeContest.title }}</span>
            <span class="cpub-contest-banner-meta">{{ activeContest.entryCount ?? 0 }} entries<template v-if="activeContest.endDate"> &middot; Ends {{ new Date(activeContest.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}</template></span>
          </div>
          <span class="cpub-contest-banner-btn">Enter Challenge <i class="fa-solid fa-arrow-right"></i></span>
        </NuxtLink>

        <!-- Content grid (2-col) -->
        <div v-if="feedPending" class="cpub-loading-state">
          <i class="fa-solid fa-circle-notch fa-spin"></i> Loading content...
        </div>
        <div v-else-if="feed?.items?.length" class="cpub-content-grid">
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
          <div v-if="statsPending" class="cpub-loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
          <div v-else class="cpub-stats-grid">
            <div class="cpub-stat-block">
              <span class="cpub-stat-num">{{ stats?.content?.byType?.project ?? 0 }}</span>
              <span class="cpub-stat-lbl">Projects</span>
            </div>
            <div class="cpub-stat-block">
              <span class="cpub-stat-num">{{ (stats?.content?.byType?.blog ?? 0) + (stats?.content?.byType?.article ?? 0) }}</span>
              <span class="cpub-stat-lbl">Posts</span>
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
        <div v-if="hubsEnabled && communitiesPending" class="cpub-sb-card">
          <div class="cpub-sb-head">Trending Hubs</div>
          <div class="cpub-loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
        </div>
        <div v-else-if="hubsEnabled && communities?.items?.length" class="cpub-sb-card">
          <div class="cpub-sb-head">Trending Hubs <NuxtLink to="/hubs">Browse</NuxtLink></div>
          <div v-for="hub in communities.items" :key="hub.id" class="cpub-hub-item">
            <div class="cpub-hub-icon">
              <img v-if="hub.iconUrl" :src="hub.iconUrl" :alt="hub.name" class="cpub-hub-icon-img" />
              <i v-else class="fa-solid fa-users"></i>
            </div>
            <div class="cpub-hub-info">
              <NuxtLink :to="(hub as Record<string, unknown>).source === 'federated' ? `/federated-hubs/${hub.id}` : `/hubs/${hub.slug}`" class="cpub-hub-name">{{ hub.name }}</NuxtLink>
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

    </template><!-- end legacy fallback -->
  </div>
</template>

<style scoped>
/* ─── HERO BANNER ─── */
.cpub-hero-banner {
  position: relative;
  background: var(--surface);
  border-bottom: var(--border-width-default) solid var(--border);
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
  border: var(--border-width-default) solid var(--yellow);
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

/* Hero logo — hidden by default, shown by Agora theme CSS */
.cpub-hero-logo-aside { display: none; }
.cpub-hero-logo {
  width: 160px;
  height: 160px;
  opacity: 0.6;
}

/* ─── TABS BAR ─── */
.cpub-tabs-bar {
  position: sticky;
  top: 48px;
  background: var(--surface);
  border-bottom: var(--border-width-default) solid var(--border);
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
  border-bottom: var(--border-width-default) solid transparent;
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

/* ─── EDITORIAL PICKS ─── */
.cpub-editorial-section {
  margin-bottom: 24px;
}

.cpub-editorial-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.cpub-editorial-heading {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--teal);
  display: flex;
  align-items: center;
  gap: 6px;
}

.cpub-editorial-heading i {
  font-size: 10px;
}

.cpub-editorial-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.cpub-editorial-single {
  grid-template-columns: 1fr;
  max-width: 400px;
}

@media (max-width: 768px) {
  .cpub-editorial-grid { grid-template-columns: 1fr; }
}

/* ─── FEATURED CARD ─── */
.cpub-featured-card {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  overflow: hidden;
  margin-bottom: 24px;
  box-shadow: var(--shadow-md);
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
  border: var(--border-width-default) solid var(--yellow);
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

/* ─── CONTEST BANNER ─── */
.cpub-contest-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--accent-bg);
  border: var(--border-width-default) solid var(--accent);
  padding: 14px 18px;
  margin-bottom: 20px;
  text-decoration: none;
  color: var(--text);
  transition: box-shadow 0.15s, transform 0.15s;
}
.cpub-contest-banner:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--shadow-md);
}
.cpub-contest-banner-info { flex: 1; min-width: 0; }
.cpub-contest-banner-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text);
}
.cpub-contest-banner-label i {
  color: var(--accent);
  margin-right: 4px;
}
.cpub-contest-banner-meta {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--text-dim);
  letter-spacing: 0.02em;
}
.cpub-contest-banner-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 8px 14px;
  background: var(--accent);
  color: var(--color-text-inverse);
  border: var(--border-width-default) solid var(--accent);
  white-space: nowrap;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.15s, transform 0.15s;
}
.cpub-contest-banner:hover .cpub-contest-banner-btn {
  box-shadow: none;
  transform: translate(2px, 2px);
}

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
  border: var(--border-width-default) solid var(--border);
  color: var(--text-dim);
  font-size: 12px;
  font-family: var(--font-mono);
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.15s;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
}

.cpub-btn-load-more:hover {
  background: var(--surface2);
  color: var(--text);
  box-shadow: var(--shadow-md);
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
  border-bottom: var(--border-width-default) solid var(--border);
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
  border: var(--border-width-default) solid var(--border);
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
  border-bottom: var(--border-width-default) solid var(--border2);
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
  border: var(--border-width-default) solid var(--accent);
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
  box-shadow: var(--shadow-sm);
}

/* Hub items */
.cpub-hub-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: var(--border-width-default) solid var(--border2);
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
  border: var(--border-width-default) solid var(--teal);
  background: var(--teal-bg);
  color: var(--teal);
  overflow: hidden;
}
.cpub-hub-icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  border: var(--border-width-default) solid var(--border);
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
  box-shadow: var(--shadow-sm);
}

.cpub-btn-joined {
  padding: 4px 10px;
  background: var(--green-bg);
  border: var(--border-width-default) solid var(--green-border);
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
  border: var(--border-width-default) solid var(--border);
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
  border: var(--border-width-default) solid var(--border);
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

.cpub-loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2, 8px);
  padding: var(--space-8, 32px);
  color: var(--text-faint);
  font-size: var(--font-size-sm, 14px);
}
</style>
