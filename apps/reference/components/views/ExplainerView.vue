<script setup lang="ts">
import type { ContentViewData } from '~/composables/useEngagement';
import type { BlockTuple } from '@commonpub/editor';

const props = defineProps<{
  content: ContentViewData;
}>();

const blocks = computed<BlockTuple[]>(() => {
  const raw = props.content?.content;
  if (!Array.isArray(raw)) return [];
  return raw as BlockTuple[];
});

// Derive sections from sectionHeader blocks, falling back to H2 headings
const sections = computed(() => {
  const result: Array<{ title: string; tag: string; body: string; blockIndex: number }> = [];

  // First try sectionHeader blocks
  for (let i = 0; i < blocks.value.length; i++) {
    const [type, data] = blocks.value[i]!;
    if (type === 'sectionHeader') {
      result.push({
        title: (data.title as string) || 'Untitled',
        tag: (data.tag as string) || '',
        body: (data.body as string) || '',
        blockIndex: i,
      });
    }
  }

  // Fallback to H2 headings if no sectionHeader blocks
  if (result.length === 0) {
    for (let i = 0; i < blocks.value.length; i++) {
      const [type, data] = blocks.value[i]!;
      if (type === 'heading' && ((data.level as number) ?? 2) <= 2) {
        result.push({
          title: (data.text as string) || 'Untitled',
          tag: `§ ${String(result.length + 1).padStart(2, '0')}`,
          body: '',
          blockIndex: i,
        });
      }
    }
  }

  // Final fallback: treat entire content as one section
  // blockIndex -1 so that sectionRanges start = -1 + 1 = 0 (don't skip first block)
  if (result.length === 0 && blocks.value.length > 0) {
    result.push({
      title: props.content.title || 'Content',
      tag: '§ 01',
      body: props.content.description || '',
      blockIndex: -1,
    });
  }

  return result;
});

// Compute block ranges per section (blocks between section headers)
const sectionRanges = computed(() => {
  const ranges: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < sections.value.length; i++) {
    // Start after the sectionHeader block itself
    const start = sections.value[i]!.blockIndex + 1;
    const nextSec = sections.value[i + 1];
    const end = nextSec?.blockIndex ?? blocks.value.length;
    ranges.push({ start, end });
  }
  if (ranges.length === 0 && blocks.value.length > 0) {
    ranges.push({ start: 0, end: blocks.value.length });
  }
  return ranges;
});

const activeSection = ref(0);
const completedSections = ref<Set<number>>(new Set());
const contentId = computed(() => props.content?.id);
const contentType = computed(() => props.content?.type ?? 'explainer');
const { bookmarked, toggleBookmark, share } = useEngagement(contentId, contentType);

const { user } = useAuth();
const isOwner = computed(() => user.value?.id === props.content?.author?.id);

const runtimeConfig = useRuntimeConfig();
useJsonLd({
  type: 'article',
  title: props.content.title,
  description: props.content.seoDescription ?? props.content.description ?? '',
  url: `${runtimeConfig.public.siteUrl}/explainer/${props.content.slug}`,
  imageUrl: props.content.coverImageUrl ?? undefined,
  authorName: props.content.author?.displayName ?? props.content.author?.username ?? '',
  authorUrl: `${runtimeConfig.public.siteUrl}/u/${props.content.author?.username}`,
  publishedAt: props.content.publishedAt ?? props.content.createdAt,
  updatedAt: props.content.updatedAt,
});

const totalSections = computed(() => sections.value.length);
const progressPct = computed(() => ((activeSection.value + 1) / totalSections.value) * 100);

function goToSection(idx: number): void {
  if (idx >= 0 && idx < totalSections.value && idx !== activeSection.value) {
    if (activeSection.value < idx) {
      completedSections.value.add(activeSection.value);
    }
    activeSection.value = idx;
  }
}

function prevSection(): void {
  if (activeSection.value > 0) activeSection.value--;
}

function nextSection(): void {
  completedSections.value.add(activeSection.value);
  if (activeSection.value < totalSections.value - 1) activeSection.value++;
}

// Checkpoint state
const checkpointVisible = ref(false);

watch(activeSection, () => {
  checkpointVisible.value = false;
  // Scroll section viewport to top on section change
  const viewport = document.querySelector('.cpub-section-viewport');
  if (viewport) viewport.scrollTop = 0;
});

// Current section data
const currentSection = computed(() => sections.value[activeSection.value]);
const currentRange = computed(() => sectionRanges.value[activeSection.value]);

// Keyboard navigation
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowLeft') { prevSection(); e.preventDefault(); }
  if (e.key === 'ArrowRight') { nextSection(); e.preventDefault(); }
}

onMounted(() => { document.addEventListener('keydown', onKeydown); });
onUnmounted(() => { document.removeEventListener('keydown', onKeydown); });
</script>

<template>
  <div class="cpub-explainer-view">
    <!-- PROGRESS BAR -->
    <div class="cpub-progress-line">
      <div class="cpub-progress-line-fill" :style="{ width: progressPct + '%' }"></div>
    </div>

    <!-- CUSTOM TOPBAR -->
    <header class="cpub-explainer-topbar">
      <div class="cpub-explainer-badge">EXPLAINER</div>
      <span class="cpub-topbar-title">{{ content.title }}</span>
      <div class="cpub-topbar-spacer"></div>
      <span class="cpub-progress-text">Section {{ activeSection + 1 }} of {{ totalSections }}</span>
      <div class="cpub-topbar-divider"></div>
      <div class="cpub-nav-btn-group">
        <button class="cpub-icon-btn" :disabled="activeSection === 0" title="Previous section" @click="prevSection">
          <i class="fa-solid fa-arrow-left"></i>
        </button>
        <button class="cpub-icon-btn" :disabled="activeSection === totalSections - 1" title="Next section" @click="nextSection">
          <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>
      <div class="cpub-topbar-divider"></div>
      <button class="cpub-icon-btn" :class="{ active: bookmarked }" title="Bookmark" @click="toggleBookmark">
        <i :class="bookmarked ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark'"></i>
      </button>
      <button class="cpub-icon-btn" title="Share" @click="share">
        <i class="fa-solid fa-arrow-up-from-bracket"></i>
      </button>
      <NuxtLink
        v-if="isOwner"
        :to="`/${content.type}/${content.slug}/edit`"
        class="cpub-icon-btn cpub-edit-link"
        title="Edit explainer"
        aria-label="Edit explainer"
      >
        <i class="fa-solid fa-pen"></i>
      </NuxtLink>
    </header>

    <!-- MAIN LAYOUT -->
    <div class="cpub-explainer-layout">
      <!-- SIDEBAR TOC -->
      <nav class="cpub-explainer-sidebar">
        <div class="cpub-toc-header">Contents</div>
        <ul class="cpub-toc-list">
          <li
            v-for="(section, i) in sections"
            :key="i"
            class="cpub-toc-item"
            :class="{ completed: completedSections.has(i), active: activeSection === i }"
          >
            <a @click="goToSection(i)">
              <span class="cpub-toc-icon">
                <i v-if="completedSections.has(i)" class="fa-solid fa-check"></i>
                <i v-else-if="activeSection === i" class="fa-solid fa-arrow-right"></i>
              </span>
              <span class="cpub-toc-num">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="cpub-toc-label">{{ section.title }}</span>
            </a>
          </li>
        </ul>

        <!-- Author info -->
        <div v-if="content.author" class="cpub-sidebar-author">
          <NuxtLink :to="`/u/${content.author.username}`" class="cpub-sidebar-author-avatar">
            <img v-if="content.author.avatarUrl" :src="content.author.avatarUrl" :alt="content.author.displayName || content.author.username" />
            <span v-else class="cpub-sidebar-author-initials">{{ (content.author.displayName || content.author.username).charAt(0).toUpperCase() }}</span>
          </NuxtLink>
          <div class="cpub-sidebar-author-info">
            <NuxtLink :to="`/u/${content.author.username}`" class="cpub-sidebar-author-name">
              {{ content.author.displayName || content.author.username }}
            </NuxtLink>
            <time class="cpub-sidebar-author-date" :datetime="new Date(content.publishedAt || content.createdAt).toISOString()">
              {{ new Date(content.publishedAt || content.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}
            </time>
          </div>
        </div>
      </nav>

      <!-- MAIN CONTENT — one section at a time -->
      <main class="cpub-explainer-main">
        <div class="cpub-section-viewport">
          <div class="cpub-content-wrap" :key="activeSection">
            <!-- Section Header (from sectionHeader block data) -->
            <div v-if="currentSection?.tag" class="cpub-section-tag">{{ currentSection.tag }}</div>
            <h1 class="cpub-section-title">{{ currentSection?.title || content.title }}</h1>

            <!-- Author byline (mobile only — desktop shows in sidebar) -->
            <div v-if="activeSection === 0 && content.author" class="cpub-mobile-author">
              <NuxtLink :to="`/u/${content.author.username}`" class="cpub-mobile-author-link">
                {{ content.author.displayName || content.author.username }}
              </NuxtLink>
              <span class="cpub-mobile-author-sep">&middot;</span>
              <time :datetime="new Date(content.publishedAt || content.createdAt).toISOString()">
                {{ new Date(content.publishedAt || content.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}
              </time>
            </div>

            <p v-if="currentSection?.body" class="cpub-section-intro">{{ currentSection.body }}</p>

            <!-- Section body blocks -->
            <div class="cpub-body-text">
              <template v-if="currentRange && currentRange.start < currentRange.end">
                <BlocksBlockContentRenderer
                  :blocks="blocks"
                  :start-index="currentRange.start"
                  :end-index="currentRange.end"
                  @quiz-answered="(_idx: number, correct: boolean) => { if (correct) { completedSections.add(activeSection); checkpointVisible = true; } }"
                  @checkpoint-reached="() => { completedSections.add(activeSection); checkpointVisible = true; }"
                />
              </template>
              <p v-else class="cpub-empty-section">This section has no content blocks yet.</p>
            </div>

            <!-- CHECKPOINT -->
            <div class="cpub-checkpoint" :class="{ visible: checkpointVisible }">
              <i class="fa-solid fa-circle-check"></i>
              <span class="cpub-checkpoint-text">Section {{ activeSection + 1 }} complete</span>
              <span class="cpub-checkpoint-sub">+1 section · {{ totalSections - activeSection - 1 }} remaining</span>
            </div>

            <!-- SECTION NAV FOOTER -->
            <div class="cpub-section-nav">
              <button v-if="activeSection > 0" class="cpub-prev-btn" @click="prevSection">
                <i class="fa-solid fa-arrow-left"></i>
                {{ sections[activeSection - 1]?.title }}
              </button>
              <div v-else></div>

              <div class="cpub-progress-dots">
                <div
                  v-for="(_, i) in totalSections"
                  :key="i"
                  class="cpub-dot"
                  :class="{ done: completedSections.has(i), active: i === activeSection }"
                  @click="goToSection(i)"
                ></div>
              </div>

              <button v-if="activeSection < totalSections - 1" class="cpub-next-btn" @click="nextSection">
                Next: {{ sections[activeSection + 1]?.title }}
                <i class="fa-solid fa-arrow-right"></i>
              </button>
              <div v-else></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* ── PROGRESS BAR ── */
.cpub-progress-line {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: var(--surface3);
  z-index: 200;
}
.cpub-progress-line-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.4s ease;
}

/* ── CUSTOM TOPBAR ── */
.cpub-explainer-topbar {
  position: fixed;
  top: 3px; left: 0; right: 0;
  height: 48px;
  background: var(--surface);
  border-bottom: 2px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  z-index: 100;
}

.cpub-explainer-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--accent);
  background: var(--accent-bg);
  border: 2px solid var(--accent-border);
  padding: 3px 8px;
  white-space: nowrap;
  flex-shrink: 0;
}

.cpub-topbar-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cpub-topbar-spacer { flex: 1; }

.cpub-progress-text {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  white-space: nowrap;
  flex-shrink: 0;
}

.cpub-topbar-divider {
  width: 2px;
  height: 20px;
  background: var(--border);
  flex-shrink: 0;
}

.cpub-icon-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 2px solid var(--border);
  color: var(--text-dim);
  cursor: pointer;
  font-size: 12px;
  transition: background 0.1s, color 0.1s, box-shadow 0.1s;
  flex-shrink: 0;
}
.cpub-icon-btn:hover:not(:disabled) { background: var(--surface2); color: var(--text); box-shadow: 2px 2px 0 var(--border); }
.cpub-icon-btn:active:not(:disabled) { box-shadow: none; transform: translate(1px, 1px); }
.cpub-icon-btn.active { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); }
.cpub-icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.cpub-nav-btn-group { display: flex; gap: 4px; flex-shrink: 0; }

/* ── LAYOUT ── */
.cpub-explainer-layout {
  display: flex;
  margin-top: 51px;
  height: calc(100vh - 51px);
  overflow: hidden;
}

/* ── SIDEBAR ── */
.cpub-explainer-sidebar {
  width: 200px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: 2px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.cpub-toc-header {
  padding: 14px 14px 10px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.12em;
  color: var(--text-faint);
  text-transform: uppercase;
  border-bottom: 2px solid var(--border);
}
.cpub-toc-list { list-style: none; padding: 6px 0; }
.cpub-toc-item a {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  text-decoration: none;
  color: var(--text-dim);
  font-size: 12px;
  line-height: 1.4;
  border-left: 3px solid transparent;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
  cursor: pointer;
}
.cpub-toc-item a:hover { background: var(--surface2); color: var(--text); }
.cpub-toc-item.active a { background: var(--accent-bg); border-left-color: var(--accent); color: var(--accent); font-weight: 500; }
.cpub-toc-item.completed a { color: var(--text-dim); }
.cpub-toc-icon { width: 14px; font-size: 10px; flex-shrink: 0; text-align: center; }
.cpub-toc-item.completed .cpub-toc-icon { color: var(--green); }
.cpub-toc-item.active .cpub-toc-icon { color: var(--accent); }
.cpub-toc-num { font-family: var(--font-mono); font-size: 9px; color: var(--text-faint); flex-shrink: 0; }
.cpub-toc-item.active .cpub-toc-num { color: var(--accent-border); }
.cpub-toc-item.completed .cpub-toc-num { color: var(--green-border); }
.cpub-toc-label { flex: 1; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── SIDEBAR AUTHOR ── */
.cpub-sidebar-author {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-top: 2px solid var(--border);
  margin-top: auto;
}
.cpub-sidebar-author-avatar {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  background: var(--surface3);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  text-decoration: none;
}
.cpub-sidebar-author-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cpub-sidebar-author-initials {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  color: var(--text-dim);
}
.cpub-sidebar-author-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.cpub-sidebar-author-name {
  font-size: 11px;
  font-weight: 500;
  color: var(--text);
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cpub-sidebar-author-name:hover { color: var(--accent); }
.cpub-sidebar-author-date {
  font-size: 10px;
  color: var(--text-faint);
  font-family: var(--font-mono);
}

/* ── EDIT LINK ── */
.cpub-edit-link {
  text-decoration: none;
}

/* ── MOBILE AUTHOR (hidden on desktop, shown when sidebar hidden) ── */
.cpub-mobile-author {
  display: none;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-faint);
  margin-bottom: 20px;
}
.cpub-mobile-author-link {
  color: var(--text-dim);
  text-decoration: none;
  font-weight: 500;
}
.cpub-mobile-author-link:hover { color: var(--accent); }
.cpub-mobile-author-sep { color: var(--text-faint); }
.cpub-mobile-author time { font-family: var(--font-mono); font-size: 11px; }

/* ── MAIN CONTENT ── */
.cpub-explainer-main {
  flex: 1;
  overflow: hidden;
  background: var(--bg);
}

/* Section viewport — fills available space, scrolls within */
.cpub-section-viewport {
  height: 100%;
  overflow-y: auto;
}

.cpub-content-wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 44px 36px 80px;
  min-height: calc(100vh - 51px - 80px);
}

/* ── SECTION TAG ── */
.cpub-section-tag {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--text-faint);
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.cpub-section-tag::before {
  content: '';
  display: inline-block;
  width: 24px;
  height: 2px;
  background: var(--border);
}

/* ── SECTION TITLE ── */
.cpub-section-title {
  font-size: 30px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.25;
  margin-bottom: 24px;
  letter-spacing: -0.02em;
}

.cpub-section-intro {
  font-size: 15px;
  color: var(--text-dim);
  line-height: 1.75;
  margin-bottom: 24px;
  max-width: 560px;
}

/* ── BODY TEXT ── */
.cpub-body-text {
  font-size: 15px;
  line-height: 1.75;
  color: var(--text);
  margin-bottom: 20px;
}
.cpub-body-text :deep(p) { margin-bottom: 14px; }
.cpub-body-text :deep(strong) { color: var(--text); font-weight: 700; }
.cpub-body-text :deep(em) { color: var(--accent); font-style: normal; font-weight: 500; }
.cpub-body-text :deep(code) {
  font-family: var(--font-mono);
  font-size: 13px;
  background: var(--surface2);
  border: 2px solid var(--border);
  padding: 1px 6px;
  color: var(--accent);
}

.cpub-empty-section {
  color: var(--text-faint);
  font-style: italic;
  padding: var(--space-10) 0;
  text-align: center;
}

/* ── CHECKPOINT ── */
.cpub-checkpoint {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--green-bg);
  border: 2px solid var(--green);
  margin-top: 24px;
  font-size: 13px;
  color: var(--green);
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.cpub-checkpoint.visible { opacity: 1; transform: translateY(0); }
.cpub-checkpoint i { font-size: 14px; }
.cpub-checkpoint-text { font-weight: 600; }
.cpub-checkpoint-sub {
  margin-left: auto;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--green-border);
}

/* ── SECTION NAV FOOTER ── */
.cpub-section-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 48px;
  padding-top: 24px;
  border-top: 2px solid var(--border);
}

.cpub-progress-dots { display: flex; align-items: center; gap: 5px; }
.cpub-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--border2);
  transition: background 0.15s, transform 0.15s;
  cursor: pointer;
}
.cpub-dot.done { background: var(--green); }
.cpub-dot.active { background: var(--accent); transform: scale(1.3); }
.cpub-dot:hover { transform: scale(1.4); }

.cpub-next-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: var(--accent);
  border: 2px solid var(--border);
  color: var(--color-text-inverse);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 4px 4px 0 var(--border);
  transition: box-shadow 0.1s, transform 0.1s;
}
.cpub-next-btn:hover { box-shadow: 2px 2px 0 var(--border); transform: translate(1px, 1px); }
.cpub-next-btn i { font-size: 12px; }

.cpub-prev-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: var(--surface);
  border: 2px solid var(--border);
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: box-shadow 0.1s;
}
.cpub-prev-btn:hover { box-shadow: 2px 2px 0 var(--border); }
.cpub-prev-btn i { font-size: 12px; }

/* ── RESPONSIVE ── */
@media (max-width: 768px) {
  .cpub-explainer-sidebar { display: none; }
  .cpub-mobile-author { display: flex; }
  .cpub-content-wrap { padding: 24px 16px 48px; }
  .cpub-section-nav { flex-direction: column; gap: 16px; }
  .cpub-section-title { font-size: 24px; }
}
</style>
