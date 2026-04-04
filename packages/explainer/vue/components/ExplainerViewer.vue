<script setup lang="ts">
/**
 * ExplainerViewer — standalone section-by-section viewer.
 *
 * No Nuxt dependencies. Works in any Vue 3 app.
 * Engagement actions (like, bookmark, share) are optional callbacks via props.
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useExplainerSections } from '../composables/useExplainerSections.js';
import { useExplainerProgress } from '../composables/useExplainerProgress.js';

type BlockTuple = [string, Record<string, unknown>];

export interface ExplainerContent {
  title: string;
  description?: string | null;
  coverImageUrl?: string | null;
  content: BlockTuple[];
  author?: {
    displayName?: string | null;
    username?: string;
    avatarUrl?: string | null;
  } | null;
  publishedAt?: string | null;
  createdAt?: string;
}

const props = withDefaults(defineProps<{
  content: ExplainerContent;
  /** Show engagement buttons (like, bookmark, share) */
  showEngagement?: boolean;
  /** Callback when user clicks edit */
  onEdit?: () => void;
}>(), {
  showEngagement: false,
});

const blocks = computed<BlockTuple[]>(() => {
  const raw = props.content?.content;
  if (!Array.isArray(raw)) return [];
  return raw as BlockTuple[];
});

const { sections, ranges } = useExplainerSections(blocks, props.content.title);
const totalSections = computed(() => sections.value.length);
const {
  activeSection,
  completedSections,
  progressPct,
  goToSection,
  prevSection,
  nextSection,
  markComplete,
} = useExplainerProgress(totalSections);

// Checkpoint animation state
const checkpointVisible = ref(false);

watch(activeSection, () => {
  checkpointVisible.value = false;
  const viewport = document.querySelector('.cpub-section-viewport');
  if (viewport) viewport.scrollTop = 0;
});

const currentSection = computed(() => sections.value[activeSection.value]);
const currentRange = computed(() => ranges.value[activeSection.value]);

const authorName = computed(() =>
  props.content.author?.displayName || props.content.author?.username || '',
);

const publishDate = computed(() => {
  const d = props.content.publishedAt || props.content.createdAt;
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
});

// Keyboard navigation
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowLeft') { prevSection(); e.preventDefault(); }
  if (e.key === 'ArrowRight') { nextSection(); e.preventDefault(); }
}

onMounted(() => document.addEventListener('keydown', onKeydown));
onUnmounted(() => document.removeEventListener('keydown', onKeydown));

function onQuizAnswered(_idx: number, correct: boolean): void {
  if (correct) {
    markComplete(activeSection.value);
    checkpointVisible.value = true;
  }
}

function onCheckpointReached(): void {
  markComplete(activeSection.value);
  checkpointVisible.value = true;
}
</script>

<template>
  <div class="cpub-explainer-view">
    <!-- PROGRESS BAR -->
    <div class="cpub-progress-line">
      <div class="cpub-progress-line-fill" :style="{ width: progressPct + '%' }"></div>
    </div>

    <!-- TOPBAR -->
    <header class="cpub-explainer-topbar">
      <div class="cpub-explainer-badge">EXPLAINER</div>
      <span class="cpub-topbar-title">{{ content.title }}</span>
      <div class="cpub-topbar-spacer"></div>
      <span class="cpub-progress-text">Section {{ activeSection + 1 }} of {{ totalSections }}</span>
      <div class="cpub-topbar-divider"></div>
      <div class="cpub-nav-btn-group">
        <button class="cpub-icon-btn" :disabled="activeSection === 0" aria-label="Previous section" @click="prevSection">
          &larr;
        </button>
        <button class="cpub-icon-btn" :disabled="activeSection === totalSections - 1" aria-label="Next section" @click="nextSection">
          &rarr;
        </button>
      </div>
      <button v-if="onEdit" class="cpub-icon-btn" title="Edit" aria-label="Edit explainer" @click="onEdit">
        &#9998;
      </button>
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
            <button type="button" :aria-label="`Go to section ${i + 1}: ${section.title}`" @click="goToSection(i)">
              <span class="cpub-toc-icon">
                <template v-if="completedSections.has(i)">&#10003;</template>
                <template v-else-if="activeSection === i">&rarr;</template>
              </span>
              <span class="cpub-toc-num">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="cpub-toc-label">{{ section.title }}</span>
            </button>
          </li>
        </ul>

        <!-- Author info -->
        <div v-if="content.author" class="cpub-sidebar-author">
          <div class="cpub-sidebar-author-avatar">
            <img v-if="content.author.avatarUrl" :src="content.author.avatarUrl" :alt="authorName" />
            <span v-else class="cpub-sidebar-author-initials">{{ authorName.charAt(0).toUpperCase() }}</span>
          </div>
          <div class="cpub-sidebar-author-info">
            <span class="cpub-sidebar-author-name">{{ authorName }}</span>
            <time v-if="publishDate" class="cpub-sidebar-author-date">{{ publishDate }}</time>
          </div>
        </div>
      </nav>

      <!-- MAIN CONTENT -->
      <main class="cpub-explainer-main">
        <div class="cpub-section-viewport">
          <div class="cpub-content-wrap" :key="activeSection">
            <!-- Cover image (first section only) -->
            <div v-if="activeSection === 0 && content.coverImageUrl" class="cpub-explainer-cover">
              <img :src="content.coverImageUrl" :alt="content.title" />
            </div>

            <!-- Section header -->
            <div v-if="currentSection?.tag" class="cpub-section-tag">{{ currentSection.tag }}</div>
            <h1 class="cpub-section-title">{{ currentSection?.title || content.title }}</h1>

            <!-- Mobile author -->
            <div v-if="activeSection === 0 && content.author" class="cpub-mobile-author">
              <span class="cpub-mobile-author-name">{{ authorName }}</span>
              <span class="cpub-mobile-author-sep">&middot;</span>
              <time v-if="publishDate">{{ publishDate }}</time>
            </div>

            <p v-if="currentSection?.body" class="cpub-section-intro">{{ currentSection.body }}</p>

            <!-- Section body blocks -->
            <div class="cpub-body-text">
              <template v-if="currentRange && currentRange.start < currentRange.end">
                <BlockRenderer
                  :blocks="blocks"
                  :start-index="currentRange.start"
                  :end-index="currentRange.end"
                  @quiz-answered="onQuizAnswered"
                  @checkpoint-reached="onCheckpointReached"
                />
              </template>
              <p v-else class="cpub-empty-section">This section has no content blocks yet.</p>
            </div>

            <!-- CHECKPOINT -->
            <div class="cpub-checkpoint" :class="{ visible: checkpointVisible }">
              <span>&#10003;</span>
              <span class="cpub-checkpoint-text">Section {{ activeSection + 1 }} complete</span>
              <span class="cpub-checkpoint-sub">+1 section &middot; {{ totalSections - activeSection - 1 }} remaining</span>
            </div>

            <!-- SECTION NAV FOOTER -->
            <div class="cpub-section-nav">
              <button v-if="activeSection > 0" class="cpub-prev-btn" @click="prevSection">
                &larr; {{ sections[activeSection - 1]?.title }}
              </button>
              <div v-else></div>

              <div class="cpub-progress-dots" role="group" aria-label="Section progress">
                <button
                  v-for="(_, i) in totalSections"
                  :key="i"
                  type="button"
                  class="cpub-dot"
                  :class="{ done: completedSections.has(i), active: i === activeSection }"
                  :aria-label="`Section ${i + 1}`"
                  :aria-current="i === activeSection ? 'step' : undefined"
                  @click="goToSection(i)"
                ></button>
              </div>

              <button v-if="activeSection < totalSections - 1" class="cpub-next-btn" @click="nextSection">
                Next: {{ sections[activeSection + 1]?.title }} &rarr;
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
/* Progress bar */
.cpub-progress-line { position: fixed; top: 0; left: 0; right: 0; height: 3px; background: var(--surface3); z-index: 200; }
.cpub-progress-line-fill { height: 100%; background: var(--accent); transition: width 0.4s ease; }

/* Topbar */
.cpub-explainer-topbar { position: fixed; top: 3px; left: 0; right: 0; height: 48px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; padding: 0 16px; z-index: 100; }
.cpub-explainer-badge { font-family: var(--font-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.08em; color: var(--accent); background: var(--accent-bg); border: var(--border-width-default) solid var(--accent-border); padding: 3px 8px; white-space: nowrap; flex-shrink: 0; }
.cpub-topbar-title { font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cpub-topbar-spacer { flex: 1; }
.cpub-progress-text { font-family: var(--font-mono); font-size: 11px; color: var(--text-dim); white-space: nowrap; flex-shrink: 0; }
.cpub-topbar-divider { width: 2px; height: 20px; background: var(--border); flex-shrink: 0; }
.cpub-icon-btn { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; background: var(--surface); border: 1px solid var(--border); color: var(--text-dim); cursor: pointer; font-size: 12px; transition: background 0.1s, color 0.1s; flex-shrink: 0; }
.cpub-icon-btn:hover:not(:disabled) { background: var(--surface2); color: var(--text); }
.cpub-icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.cpub-nav-btn-group { display: flex; gap: 4px; flex-shrink: 0; }

/* Layout */
.cpub-explainer-layout { display: flex; margin-top: 51px; height: calc(100vh - 51px); overflow: hidden; }

/* Sidebar */
.cpub-explainer-sidebar { width: 200px; flex-shrink: 0; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow-y: auto; }
.cpub-toc-header { padding: 14px 14px 10px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.12em; color: var(--text-faint); text-transform: uppercase; border-bottom: 1px solid var(--border); }
.cpub-toc-list { list-style: none; padding: 6px 0; margin: 0; }
.cpub-toc-item button { display: flex; align-items: center; gap: 8px; padding: 8px 14px; width: 100%; background: none; border: none; text-align: left; color: var(--text-dim); font-size: 12px; font-family: inherit; line-height: 1.4; border-left: 3px solid transparent; transition: background 0.1s, color 0.1s, border-color 0.1s; cursor: pointer; }
.cpub-toc-item button:hover { background: var(--surface2); color: var(--text); }
.cpub-toc-item.active button { background: var(--accent-bg); border-left-color: var(--accent); color: var(--accent); font-weight: 500; }
.cpub-toc-item.completed button { color: var(--text-dim); }
.cpub-toc-icon { width: 14px; font-size: 10px; flex-shrink: 0; text-align: center; }
.cpub-toc-item.completed .cpub-toc-icon { color: var(--green); }
.cpub-toc-item.active .cpub-toc-icon { color: var(--accent); }
.cpub-toc-num { font-family: var(--font-mono); font-size: 9px; color: var(--text-faint); flex-shrink: 0; }
.cpub-toc-item.active .cpub-toc-num { color: var(--accent-border); }
.cpub-toc-item.completed .cpub-toc-num { color: var(--green-border); }
.cpub-toc-label { flex: 1; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Sidebar author */
.cpub-sidebar-author { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-top: 1px solid var(--border); margin-top: auto; }
.cpub-sidebar-author-avatar { width: 24px; height: 24px; border-radius: var(--radius-full); background: var(--surface3); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
.cpub-sidebar-author-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cpub-sidebar-author-initials { font-family: var(--font-mono); font-size: 9px; font-weight: 600; color: var(--text-dim); }
.cpub-sidebar-author-info { display: flex; flex-direction: column; min-width: 0; }
.cpub-sidebar-author-name { font-size: 11px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cpub-sidebar-author-date { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }

/* Mobile author (hidden on desktop) */
.cpub-mobile-author { display: none; align-items: center; gap: 6px; font-size: 12px; color: var(--text-faint); margin-bottom: 20px; }
.cpub-mobile-author-name { color: var(--text-dim); font-weight: 500; }
.cpub-mobile-author-sep { color: var(--text-faint); }
.cpub-mobile-author time { font-family: var(--font-mono); font-size: 11px; }

/* Main content */
.cpub-explainer-main { flex: 1; overflow: hidden; background: var(--bg); }
.cpub-section-viewport { height: 100%; overflow-y: auto; }
.cpub-content-wrap { max-width: 720px; margin: 0 auto; padding: 44px 36px 80px; min-height: calc(100vh - 51px - 80px); }

/* Cover */
.cpub-explainer-cover { width: 100%; max-height: 320px; overflow: hidden; margin-bottom: 20px; border: var(--border-width-default) solid var(--border); }
.cpub-explainer-cover img { width: 100%; height: 100%; max-height: 320px; object-fit: cover; display: block; }

/* Section tag */
.cpub-section-tag { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; color: var(--text-faint); margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }
.cpub-section-tag::before { content: ''; display: inline-block; width: 24px; height: 2px; background: var(--border); }

/* Section title */
.cpub-section-title { font-size: 30px; font-weight: 700; color: var(--text); line-height: 1.25; margin-bottom: 24px; letter-spacing: -0.02em; }
.cpub-section-intro { font-size: 15px; color: var(--text-dim); line-height: 1.75; margin-bottom: 24px; max-width: 560px; }

/* Body */
.cpub-body-text { font-size: 15px; line-height: 1.75; color: var(--text); margin-bottom: 20px; }
.cpub-empty-section { color: var(--text-faint); font-style: italic; padding: 40px 0; text-align: center; }

/* Checkpoint */
.cpub-checkpoint { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: var(--green-bg); border: var(--border-width-default) solid var(--green); margin-top: 24px; font-size: 13px; color: var(--green); opacity: 0; transform: translateY(8px); transition: opacity 0.4s ease, transform 0.4s ease; }
.cpub-checkpoint.visible { opacity: 1; transform: translateY(0); }
.cpub-checkpoint-text { font-weight: 600; }
.cpub-checkpoint-sub { margin-left: auto; font-size: 11px; font-family: var(--font-mono); color: var(--green-border); }

/* Section nav footer */
.cpub-section-nav { display: flex; align-items: center; justify-content: space-between; margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--border); }
.cpub-progress-dots { display: flex; align-items: center; gap: 5px; }
.cpub-dot { width: 7px; height: 7px; padding: 0; border: none; border-radius: 50%; background: var(--border2); transition: background 0.15s, transform 0.15s; cursor: pointer; }
.cpub-dot.done { background: var(--green); }
.cpub-dot.active { background: var(--accent); transform: scale(1.3); }
.cpub-dot:hover { transform: scale(1.4); }
.cpub-next-btn { display: flex; align-items: center; gap: 8px; padding: 10px 18px; background: var(--accent); border: 1px solid var(--border); color: var(--color-text-inverse); font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: var(--shadow-sm); transition: box-shadow 0.1s, transform 0.1s; }
.cpub-next-btn:hover { box-shadow: var(--shadow-sm); transform: translate(1px, 1px); }
.cpub-prev-btn { display: flex; align-items: center; gap: 8px; padding: 10px 18px; background: var(--surface); border: 1px solid var(--border); color: var(--text); font-size: 13px; font-weight: 500; cursor: pointer; transition: box-shadow 0.1s; }
.cpub-prev-btn:hover { box-shadow: var(--shadow-sm); }

/* Responsive */
@media (max-width: 768px) {
  .cpub-explainer-sidebar { display: none; }
  .cpub-mobile-author { display: flex; }
  .cpub-content-wrap { padding: 24px 16px 48px; }
  .cpub-section-nav { flex-direction: column; gap: 16px; }
  .cpub-section-title { font-size: 24px; }
}
</style>
