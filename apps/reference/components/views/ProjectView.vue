<script setup lang="ts">
const props = defineProps<{
  content: any;
}>();

const activeTab = ref('overview');
const tabs = [
  { value: 'overview', label: 'Overview' },
  { value: 'code', label: 'Code' },
  { value: 'schematics', label: 'Schematics' },
  { value: 'bom', label: 'BOM' },
  { value: 'files', label: 'Files' },
  { value: 'comments', label: 'Comments' },
];

const liked = ref(false);

const difficultyLevel = computed(() => props.content?.difficulty || 3);
</script>

<template>
  <div class="cpub-project-view">
    <!-- HERO COVER -->
    <div class="cpub-hero-cover">
      <div class="cpub-hero-cover-grid"></div>
      <div class="cpub-hero-circuit">
        <div class="cpub-chip-row">
          <div class="cpub-chip">{{ content.hardwarePrimary || 'MCU' }}</div>
          <div class="cpub-chip-line"></div>
          <div class="cpub-chip">{{ content.hardwareSecondary || 'SENSOR' }}</div>
          <div class="cpub-chip-line"></div>
          <div class="cpub-chip">{{ content.hardwareTertiary || 'ML MODEL' }}</div>
        </div>
      </div>
      <div class="cpub-hero-badges">
        <span v-if="content.featured" class="cpub-badge cpub-badge-featured"><i class="fa-solid fa-star"></i> Featured</span>
        <span class="cpub-badge cpub-badge-outline">{{ content.difficultyLabel || 'Intermediate' }}</span>
      </div>
    </div>

    <!-- PAGE CONTENT -->
    <div class="cpub-page-outer">
      <!-- BREADCRUMB -->
      <div class="cpub-breadcrumb">
        <NuxtLink to="/">Explore</NuxtLink>
        <span class="cpub-bc-sep"><i class="fa-solid fa-chevron-right"></i></span>
        <NuxtLink to="/project">Projects</NuxtLink>
        <span class="cpub-bc-sep"><i class="fa-solid fa-chevron-right"></i></span>
        <span class="cpub-bc-current">{{ content.title }}</span>
      </div>

      <!-- PROJECT META -->
      <div class="cpub-project-meta">
        <h1 class="cpub-project-title">{{ content.title }}</h1>
        <p v-if="content.description" class="cpub-project-subtitle">{{ content.description }}</p>

        <!-- Author Row -->
        <div class="cpub-author-row">
          <div class="cpub-av cpub-av-lg">{{ content.author?.displayName?.slice(0, 2).toUpperCase() || 'CP' }}</div>
          <div>
            <div class="cpub-author-name">{{ content.author?.displayName || content.author?.username || 'Author' }}</div>
            <div class="cpub-author-meta-row">
              <span v-if="content.author?.org" class="cpub-author-org">{{ content.author.org }}</span>
              <span class="cpub-meta-date">Published {{ new Date(content.publishedAt || content.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}</span>
            </div>
          </div>
          <span class="cpub-meta-sep">&bull;</span>
          <div class="cpub-fork-count">
            <i class="fa-solid fa-code-branch"></i>
            <span>{{ content.forkCount ?? 0 }} forks</span>
          </div>
        </div>

        <!-- Engagement Row -->
        <div class="cpub-engagement-row">
          <button class="cpub-engage-btn" :class="{ liked }" @click="liked = !liked">
            <i class="fa-solid fa-heart"></i> Like <span class="cpub-count">{{ content.likeCount ?? 0 }}</span>
          </button>
          <button class="cpub-engage-btn"><i class="fa-regular fa-bookmark"></i> Bookmark</button>
          <button class="cpub-engage-btn"><i class="fa-solid fa-share-nodes"></i> Share</button>
          <div class="cpub-engage-sep"></div>
          <button class="cpub-engage-btn"><i class="fa-solid fa-code-branch"></i> Fork <span class="cpub-count">{{ content.forkCount ?? 0 }}</span></button>
          <button class="cpub-engage-btn cpub-engage-btn-green"><i class="fa-solid fa-hammer"></i> I Built This <span class="cpub-count">{{ content.buildCount ?? 0 }}</span></button>
        </div>
      </div>
    </div>

    <!-- STICKY TABS -->
    <div class="cpub-tabs-sticky">
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

    <!-- MAIN CONTENT GRID -->
    <div class="cpub-page-outer">
      <div class="cpub-content-grid">
        <!-- LEFT: CONTENT -->
        <div class="cpub-content-col">
          <div class="cpub-prose">
            <template v-if="content.content && Array.isArray(content.content) && content.content.length > 0">
              <ClientOnly>
                <CpubEditor :model-value="content.content" :editable="false" />
              </ClientOnly>
            </template>
            <template v-else>
              <div class="cpub-prose-section">
                <div class="cpub-section-title">Introduction</div>
                <p class="cpub-prose-p">No content body yet. This project doesn't have any content blocks.</p>
              </div>
            </template>
          </div>

          <!-- Comments -->
          <CommentSection :content-id="content.id" />
        </div>

        <!-- RIGHT: SIDEBAR -->
        <aside class="cpub-sidebar">
          <!-- Stats Grid -->
          <div class="cpub-sb-card">
            <div class="cpub-sb-title">Stats</div>
            <div class="cpub-stats-grid">
              <div class="cpub-stat-cell">
                <div class="cpub-stat-val">{{ content.viewCount?.toLocaleString() || '0' }}</div>
                <div class="cpub-stat-label">VIEWS</div>
              </div>
              <div class="cpub-stat-cell">
                <div class="cpub-stat-val">{{ content.likeCount ?? 0 }}</div>
                <div class="cpub-stat-label">LIKES</div>
              </div>
              <div class="cpub-stat-cell">
                <div class="cpub-stat-val">{{ content.forkCount ?? 0 }}</div>
                <div class="cpub-stat-label">FORKS</div>
              </div>
              <div class="cpub-stat-cell">
                <div class="cpub-stat-val">{{ content.bookmarkCount ?? 0 }}</div>
                <div class="cpub-stat-label">SAVES</div>
              </div>
            </div>
          </div>

          <!-- Details -->
          <div class="cpub-sb-card">
            <div class="cpub-sb-title">Details</div>
            <div class="cpub-diff-row">
              <span>Difficulty</span>
              <div class="cpub-diff-dots">
                <div v-for="d in 5" :key="d" class="cpub-diff-dot" :class="{ on: d <= difficultyLevel }"></div>
              </div>
            </div>
            <div class="cpub-meta-row">
              <div class="cpub-meta-row-icon"><i class="fa-solid fa-clock"></i></div>
              <div>
                <div class="cpub-meta-row-label">Build Time</div>
                <div class="cpub-meta-row-val">{{ content.buildTime || '~4 hours' }}</div>
              </div>
            </div>
            <div class="cpub-meta-row">
              <div class="cpub-meta-row-icon"><i class="fa-solid fa-dollar-sign"></i></div>
              <div>
                <div class="cpub-meta-row-label">Estimated Cost</div>
                <div class="cpub-meta-row-val">{{ content.estimatedCost || '$45–$65' }}</div>
              </div>
            </div>
            <div v-if="content.githubUrl" class="cpub-meta-row">
              <div class="cpub-meta-row-icon"><i class="fa-brands fa-github"></i></div>
              <div>
                <div class="cpub-meta-row-label">Source Code</div>
                <div class="cpub-meta-row-val"><a :href="content.githubUrl" class="cpub-link-text">View on GitHub</a></div>
              </div>
            </div>
            <div v-if="content.license" class="cpub-meta-row">
              <div class="cpub-meta-row-icon"><i class="fa-solid fa-scale-balanced"></i></div>
              <div>
                <div class="cpub-meta-row-label">License</div>
                <div class="cpub-meta-row-val">{{ content.license }}</div>
              </div>
            </div>
          </div>

          <!-- Tags -->
          <div v-if="content.tags?.length" class="cpub-sb-card">
            <div class="cpub-sb-title">Tags</div>
            <div class="cpub-tag-cloud">
              <span v-for="tag in content.tags" :key="tag.id || tag.name || tag" class="cpub-tag">{{ tag.name || tag }}</span>
            </div>
          </div>

          <!-- BOM Summary -->
          <div v-if="content.parts?.length" class="cpub-sb-card">
            <div class="cpub-sb-title">BOM Summary</div>
            <div class="cpub-bom-summary-row">
              <span class="cpub-bom-label">Components</span>
              <span class="cpub-bom-val">{{ content.parts.length }}</span>
            </div>
            <div class="cpub-bom-summary-row">
              <span class="cpub-bom-label">Total Cost</span>
              <span class="cpub-bom-val cpub-bom-green">{{ content.estimatedCost || '$45–$65' }}</span>
            </div>
          </div>

          <!-- Community Hub -->
          <div v-if="content.community" class="cpub-sb-card">
            <div class="cpub-hub-card-inner">
              <div class="cpub-hub-icon"><i class="fa-solid fa-users"></i></div>
              <div class="cpub-hub-name">{{ content.community.name }}</div>
              <div class="cpub-hub-desc">{{ content.community.description }}</div>
              <button class="cpub-btn cpub-btn-sm">Join Community</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── HERO COVER ── */
.cpub-hero-cover {
  position: relative;
  height: 280px;
  background: var(--surface2);
  overflow: hidden;
  flex-shrink: 0;
  border-bottom: 2px solid var(--border);
}

.cpub-hero-cover-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--accent-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--accent-border) 1px, transparent 1px);
  background-size: 32px 32px;
}

.cpub-hero-circuit {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.22;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--teal);
  letter-spacing: 0.05em;
}

.cpub-chip-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cpub-chip {
  border: 2px solid currentColor;
  padding: 8px 16px;
  font-size: 10px;
}

.cpub-chip-line {
  width: 40px;
  height: 2px;
  background: currentColor;
  opacity: 0.5;
}

.cpub-hero-badges {
  position: absolute;
  top: 16px;
  left: 20px;
  display: flex;
  gap: 6px;
}

.cpub-badge {
  font-size: 9px;
  font-family: var(--font-mono);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 4px 10px;
}

.cpub-badge-featured {
  background: var(--yellow-bg);
  border: 2px solid var(--border);
  color: var(--yellow);
  box-shadow: 2px 2px 0 var(--border);
}

.cpub-badge-outline {
  background: var(--surface);
  border: 2px solid var(--border);
  color: var(--text-dim);
  box-shadow: 2px 2px 0 var(--border);
}

/* ── PAGE OUTER ── */
.cpub-page-outer {
  max-width: 1160px;
  margin: 0 auto;
  padding: 0 32px;
}

/* ── BREADCRUMB ── */
.cpub-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 0 10px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-faint);
}

.cpub-breadcrumb a { color: var(--text-dim); text-decoration: none; }
.cpub-breadcrumb a:hover { color: var(--text); }
.cpub-bc-sep { color: var(--text-faint); font-size: 8px; }
.cpub-bc-current { color: var(--text-dim); }

/* ── PROJECT META ── */
.cpub-project-meta { padding: 24px 0 0; }

.cpub-project-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.25;
  margin-bottom: 8px;
  letter-spacing: -0.02em;
}

.cpub-project-subtitle {
  font-size: 14px;
  color: var(--text-dim);
  line-height: 1.6;
  margin-bottom: 18px;
}

/* ── AUTHOR ROW ── */
.cpub-author-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.cpub-av {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--surface3);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-dim);
  font-family: var(--font-mono);
  flex-shrink: 0;
}

.cpub-av-lg { width: 36px; height: 36px; font-size: 12px; }

.cpub-author-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.cpub-author-meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.cpub-author-org {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--accent);
  background: var(--accent-bg);
  border: 2px solid var(--border);
  padding: 2px 7px;
}

.cpub-meta-date {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-faint);
}

.cpub-meta-sep { color: var(--text-faint); font-size: 11px; }

.cpub-fork-count {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-dim);
  display: flex;
  align-items: center;
  gap: 4px;
}

.cpub-fork-count i { font-size: 10px; color: var(--text-faint); }

/* ── ENGAGEMENT ROW ── */
.cpub-engagement-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 20px;
  flex-wrap: wrap;
}

.cpub-engage-btn {
  font-size: 12px;
  padding: 6px 13px;
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--text-dim);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.cpub-engage-btn:hover { color: var(--text); background: var(--surface2); }
.cpub-engage-btn.liked { color: var(--red); background: var(--red-bg); }

.cpub-engage-btn-green {
  color: var(--green);
  background: var(--green-bg);
}

.cpub-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
}

.cpub-engage-sep { width: 2px; height: 24px; background: var(--border); }

/* ── TABS ── */
.cpub-tabs-sticky {
  position: sticky;
  top: 48px;
  z-index: 50;
  background: var(--bg);
  border-bottom: 2px solid var(--border);
  margin-bottom: 28px;
}

.cpub-tabs-inner {
  max-width: 1160px;
  margin: 0 auto;
  padding: 0 32px;
  display: flex;
  align-items: center;
  gap: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.cpub-tabs-inner::-webkit-scrollbar { display: none; }

.cpub-tab {
  font-size: 12px;
  color: var(--text-dim);
  padding: 10px 14px;
  cursor: pointer;
  border: none;
  background: none;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: color var(--transition-fast);
}

.cpub-tab:hover { color: var(--text); }

.cpub-tab.active {
  color: var(--text);
  font-weight: 600;
  border-bottom-color: var(--border);
}

/* ── CONTENT GRID ── */
.cpub-content-grid {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 32px;
  align-items: start;
  padding-bottom: 64px;
}

/* ── PROSE ── */
.cpub-prose {
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-dim);
}

.cpub-prose :deep(h2),
.cpub-prose :deep(.section-title) {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 12px;
  letter-spacing: -0.01em;
}

.cpub-prose :deep(p) { margin-bottom: 12px; }
.cpub-prose :deep(strong) { color: var(--text); font-weight: 600; }
.cpub-prose :deep(a) { color: var(--accent); text-decoration: none; }
.cpub-prose :deep(a:hover) { text-decoration: underline; }
.cpub-prose :deep(code) {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--surface2);
  padding: 2px 5px;
  border: 1px solid var(--border2);
  color: var(--accent);
}

.cpub-prose :deep(hr) {
  border: none;
  border-top: 2px solid var(--border);
  margin: 24px 0;
}

/* ── SIDEBAR ── */
.cpub-sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cpub-sb-card {
  background: var(--surface);
  border: 2px solid var(--border);
  padding: 18px;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-sb-title {
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-bottom: 14px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--border);
}

/* Stats grid */
.cpub-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 2px solid var(--border);
  overflow: hidden;
}

.cpub-stat-cell {
  background: var(--surface2);
  padding: 14px;
  text-align: center;
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.cpub-stat-cell:nth-child(2n) { border-right: none; }
.cpub-stat-cell:nth-child(n+3) { border-bottom: none; }

.cpub-stat-val {
  font-size: 18px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text);
  line-height: 1;
  margin-bottom: 4px;
}

.cpub-stat-label {
  font-size: 9px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* Difficulty */
.cpub-diff-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 10px;
}

.cpub-diff-dots {
  display: flex;
  gap: 4px;
}

.cpub-diff-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border2);
}

.cpub-diff-dot.on { background: var(--yellow); }

/* Meta rows */
.cpub-meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border2);
  font-size: 12px;
}

.cpub-meta-row:last-child { border-bottom: none; }

.cpub-meta-row-icon {
  width: 28px;
  height: 28px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--text-faint);
  flex-shrink: 0;
}

.cpub-meta-row-label {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  margin-bottom: 2px;
}

.cpub-meta-row-val {
  font-size: 12px;
  color: var(--text);
  font-weight: 500;
}

/* Tags */
.cpub-tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cpub-tag {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-family: var(--font-mono);
  padding: 4px 10px;
  border: 2px solid var(--border);
  color: var(--text-dim);
  background: var(--surface);
  cursor: pointer;
  transition: border-color var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
}

.cpub-tag:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

/* BOM Summary */
.cpub-bom-summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 0;
  border-bottom: 1px solid var(--border2);
  font-size: 12px;
}

.cpub-bom-summary-row:last-child { border-bottom: none; }
.cpub-bom-label { color: var(--text-dim); }
.cpub-bom-val { font-family: var(--font-mono); color: var(--text); font-weight: 600; }
.cpub-bom-green { color: var(--green); }

/* Hub card */
.cpub-hub-card-inner {
  text-align: center;
  padding: 4px 0;
}

.cpub-hub-icon {
  width: 44px;
  height: 44px;
  background: var(--purple-bg);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: var(--purple);
  margin: 0 auto 10px;
}

.cpub-hub-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 4px;
}

.cpub-hub-desc {
  font-size: 11px;
  color: var(--text-faint);
  margin-bottom: 12px;
  line-height: 1.5;
}

/* Link text */
.cpub-link-text {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--accent);
  text-decoration: none;
}

.cpub-link-text:hover { color: var(--accent); text-decoration: underline; }

/* Buttons */
.cpub-btn {
  font-size: 12px;
  padding: 6px 14px;
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background var(--transition-fast);
}

.cpub-btn:hover { background: var(--surface2); }
.cpub-btn-sm { padding: 4px 10px; font-size: 11px; }

/* ── RESPONSIVE ── */
@media (max-width: 1024px) {
  .cpub-content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .cpub-page-outer { padding: 0 16px; }
  .cpub-hero-cover { height: 180px; }
}
</style>
