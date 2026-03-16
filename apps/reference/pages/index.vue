<script setup lang="ts">
useSeoMeta({
  title: 'CommonPub — Edge AI & Maker Platform',
  description: 'Build, deploy, and document edge AI projects. Share with a community of makers.',
});

const activeTab = ref('foryou');
const tabs = [
  { value: 'foryou', label: 'For You' },
  { value: 'latest', label: 'Latest' },
  { value: 'following', label: 'Following' },
  { value: 'project', label: 'Projects' },
  { value: 'article', label: 'Articles' },
  { value: 'explainer', label: 'Explainers' },
  { value: 'video', label: 'Videos' },
  { value: 'guide', label: 'Guides' },
];

const contentQuery = computed(() => ({
  status: 'published',
  type: ['foryou', 'latest', 'following'].includes(activeTab.value) ? undefined : activeTab.value,
  sort: activeTab.value === 'latest' ? 'recent' : 'popular',
  limit: 12,
}));

const { data: feed } = await useFetch('/api/content', {
  query: contentQuery,
  watch: [contentQuery],
});

const { data: featured } = await useFetch('/api/content', {
  query: { status: 'published', sort: 'popular', limit: 1 },
});

const { data: stats } = await useFetch('/api/stats');

const { data: communities } = await useFetch('/api/communities', {
  query: { limit: 4 },
});

const { data: contests } = await useFetch('/api/contests', {
  query: { limit: 3 },
});

const heroDismissed = ref(false);
</script>

<template>
  <div>
    <!-- ═══ HERO BANNER — contest promo ═══ -->
    <section v-if="!heroDismissed" class="cpub-hero-banner">
      <div class="cpub-hero-grid-bg" />
      <div class="cpub-hero-gradient" />
      <button class="cpub-hero-dismiss" title="Dismiss" @click="heroDismissed = true">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <div class="cpub-hero-inner">
        <div class="cpub-hero-content">
          <div class="cpub-hero-eyebrow">
            <span class="cpub-hero-badge cpub-hero-badge-live"><span class="cpub-live-dot" /> Live Contest</span>
            <span class="cpub-hero-badge">$12,500 Prize Pool</span>
          </div>
          <h1 class="cpub-hero-title">
            Edge AI Deployment Challenge<br>
            <span>Spring 2026</span>
          </h1>
          <p class="cpub-hero-excerpt">
            Build, deploy, and document an inference pipeline on constrained edge hardware — Raspberry Pi 5, Jetson Orin Nano, or ESP32-S3. Fastest ONNX inference on-device wins. All skill levels welcome.
          </p>
          <div class="cpub-hero-actions">
            <NuxtLink to="/contests" class="cpub-btn cpub-btn-primary"><i class="fa-solid fa-trophy"></i> Enter Contest</NuxtLink>
            <NuxtLink to="/contests" class="cpub-btn"><i class="fa-solid fa-circle-info"></i> View Rules</NuxtLink>
          </div>
          <div class="cpub-hero-meta">
            <span class="cpub-hero-stat"><i class="fa-solid fa-users"></i> <strong>1,284</strong> entrants</span>
            <span class="cpub-hero-stat"><i class="fa-solid fa-file-code"></i> <strong>347</strong> submissions</span>
            <span class="cpub-hero-stat"><i class="fa-solid fa-calendar"></i> Ends <strong>Apr 15, 2026</strong></span>
          </div>
        </div>
        <div class="cpub-hero-aside">
          <CountdownTimer target-date="2026-04-15T00:00:00Z" />
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
          <div class="cpub-empty-state-icon"><i class="fa-solid fa-inbox"></i></div>
          <p class="cpub-empty-state-title">No content yet</p>
          <p class="cpub-empty-state-desc">Be the first to create something!</p>
        </div>

        <div class="cpub-load-more-row">
          <button class="cpub-btn-load-more">
            <i class="fa-solid fa-rotate"></i> Load more
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
              <span class="cpub-stat-num">{{ stats?.contentCount ?? 0 }}</span>
              <span class="cpub-stat-lbl">Projects</span>
            </div>
            <div class="cpub-stat-block">
              <span class="cpub-stat-num">{{ stats?.articleCount ?? 0 }}</span>
              <span class="cpub-stat-lbl">Articles</span>
            </div>
            <div class="cpub-stat-block">
              <span class="cpub-stat-num">{{ stats?.userCount ?? 0 }}</span>
              <span class="cpub-stat-lbl">Members</span>
            </div>
            <div class="cpub-stat-block">
              <span class="cpub-stat-num">{{ stats?.communityCount ?? 0 }}</span>
              <span class="cpub-stat-lbl">Hubs</span>
            </div>
          </div>
        </div>

        <!-- Active Contests -->
        <div v-if="contests?.items?.length" class="cpub-sb-card">
          <div class="cpub-sb-head">Active Contests <NuxtLink to="/contests">View all</NuxtLink></div>
          <div v-for="c in contests.items" :key="c.id" class="cpub-contest-item">
            <NuxtLink :to="`/contests/${c.slug}`" class="cpub-contest-name">{{ c.title }}</NuxtLink>
            <div class="cpub-contest-row">
              <span v-if="c.prizePool" class="cpub-contest-prize">{{ c.prizePool }}</span>
              <span v-if="c.endDate" class="cpub-contest-deadline">
                <i class="fa-regular fa-clock"></i> {{ c.daysLeft ?? '' }}
              </span>
            </div>
            <NuxtLink :to="`/contests/${c.slug}`" class="cpub-btn-enter">Enter Contest</NuxtLink>
          </div>
        </div>

        <!-- Trending Hubs -->
        <div v-if="communities?.items?.length" class="cpub-sb-card">
          <div class="cpub-sb-head">Trending Hubs <NuxtLink to="/communities">Browse</NuxtLink></div>
          <div v-for="hub in communities.items" :key="hub.id" class="cpub-hub-item">
            <div class="cpub-hub-icon">
              <i class="fa-solid fa-users"></i>
            </div>
            <div class="cpub-hub-info">
              <NuxtLink :to="`/communities/${hub.slug}`" class="cpub-hub-name">{{ hub.name }}</NuxtLink>
              <div class="cpub-hub-members">{{ hub.memberCount ?? 0 }} members</div>
            </div>
            <button class="cpub-btn-join">Join</button>
          </div>
        </div>

        <!-- Powered badge -->
        <div class="cpub-powered-badge">
          <span class="cpub-powered-text">Powered by</span>
          <span class="cpub-powered-logo">[<span>C</span>] CommonPub</span>
        </div>
      </aside>
    </div>

    <!-- ═══ FOOTER ═══ -->
    <footer class="cpub-footer">
      <div class="cpub-footer-inner">
        <nav class="cpub-footer-links">
          <NuxtLink to="/about" class="cpub-footer-link">About</NuxtLink>
          <span class="cpub-footer-sep">&middot;</span>
          <NuxtLink to="/docs" class="cpub-footer-link">Docs</NuxtLink>
          <span class="cpub-footer-sep">&middot;</span>
          <NuxtLink to="/api" class="cpub-footer-link">API</NuxtLink>
          <span class="cpub-footer-sep">&middot;</span>
          <a href="https://github.com" class="cpub-footer-link">GitHub</a>
        </nav>
        <span class="cpub-footer-copy">&copy; 2026 CommonPub</span>
      </div>
    </footer>
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

.cpub-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s;
  text-decoration: none;
  cursor: pointer;
}

.cpub-btn:hover { background: var(--surface2); box-shadow: 2px 2px 0 var(--border); }

.cpub-btn-primary {
  background: var(--accent);
  color: var(--color-text-inverse);
  box-shadow: 2px 2px 0 var(--border);
}

.cpub-btn-primary:hover { box-shadow: 4px 4px 0 var(--border); transform: translate(-1px, -1px); }

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

.cpub-sb-card {
  background: var(--surface);
  border: 2px solid var(--border);
  padding: 18px 20px;
  box-shadow: 4px 4px 0 var(--border);
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

.cpub-contest-prize {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--yellow);
  font-weight: 600;
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

/* ─── FOOTER ─── */
.cpub-footer {
  border-top: 2px solid var(--border);
  padding: 20px 32px;
  background: var(--surface);
}

.cpub-footer-inner {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 20px;
}

.cpub-footer-links {
  display: flex;
  gap: 16px;
}

.cpub-footer-link {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  text-decoration: none;
  transition: color 0.15s;
}

.cpub-footer-link:hover { color: var(--text); }

.cpub-footer-sep { color: var(--border2); }

.cpub-footer-copy {
  margin-left: auto;
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
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
