<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ExplainerDocument, ExplainerThemeRef } from '@commonpub/explainer';
import { resolveThemePreset } from '@commonpub/explainer';
import { useScrollTracking } from '../../composables/useScrollTracking';
import { useExplainerTheme } from '../../composables/useExplainerTheme';
import ProgressBar from './ProgressBar.vue';
import NavDots from './NavDots.vue';
import HeroRenderer from './HeroRenderer.vue';
import SectionRenderer from './SectionRenderer.vue';
import ConclusionRenderer from './ConclusionRenderer.vue';

const props = defineProps<{
  document: ExplainerDocument;
}>();

const emit = defineEmits<{
  'section-enter': [sectionId: string, index: number];
  'progress': [progress: number];
  'complete': [];
}>();

// Refs
const viewerRoot = ref<HTMLElement | null>(null);
const themeRef = computed<ExplainerThemeRef>(() => props.document.theme);

// Section IDs for scroll tracking (hero + sections + conclusion)
const allSectionIds = computed(() => {
  const ids = ['hero'];
  for (const s of props.document.sections) {
    ids.push(s.id);
  }
  if (props.document.conclusion) ids.push('conclusion');
  return ids;
});

// Composables
const { activeSectionIndex, scrollProgress, scrollToSection } = useScrollTracking(allSectionIds);
useExplainerTheme(themeRef, viewerRoot);

// Settings with defaults
const showProgressBar = computed(() => props.document.settings?.showProgressBar !== false);
const showNavDots = computed(() => props.document.settings?.showNavDots !== false);
const showFooter = computed(() => props.document.settings?.showFooter !== false);
const footerText = computed(() => props.document.settings?.footerText ?? 'An explorable explanation');

// Keyboard navigation
function handleKeydown(e: KeyboardEvent): void {
  const ids = allSectionIds.value;
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    e.preventDefault();
    const next = Math.min(activeSectionIndex.value + 1, ids.length - 1);
    scrollToSection(ids[next]!);
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault();
    const prev = Math.max(activeSectionIndex.value - 1, 0);
    scrollToSection(ids[prev]!);
  } else if (e.key === 'Home') {
    e.preventDefault();
    scrollToSection('hero');
  } else if (e.key === 'End') {
    e.preventDefault();
    scrollToSection(ids[ids.length - 1]!);
  }
}
</script>

<template>
  <div
    ref="viewerRoot"
    class="cpub-scroll-viewer"
    tabindex="0"
    @keydown="handleKeydown"
  >
    <!-- Progress bar -->
    <ProgressBar v-if="showProgressBar" :progress="scrollProgress" />

    <!-- Nav dots -->
    <NavDots
      v-if="showNavDots"
      :sections="document.sections"
      :active-index="Math.max(0, activeSectionIndex - 1)"
      @navigate="scrollToSection"
    />

    <!-- Main scroll content -->
    <main class="cpub-scroll-main">
      <!-- Hero -->
      <HeroRenderer :hero="document.hero" />

      <!-- Sections -->
      <SectionRenderer
        v-for="(section, i) in document.sections"
        :key="section.id"
        :section="section"
        :index="i"
      />

      <!-- Conclusion -->
      <ConclusionRenderer
        v-if="document.conclusion"
        :conclusion="document.conclusion"
      />
    </main>

    <!-- Footer -->
    <footer v-if="showFooter" class="cpub-scroll-footer">
      <span>{{ footerText }}</span>
      <span class="cpub-scroll-footer-sep">/</span>
      <a href="https://explorabl.es/" target="_blank" rel="noopener noreferrer">explorabl.es</a>
    </footer>
  </div>
</template>

<style scoped>
.cpub-scroll-viewer {
  background: var(--bg-page, #0c0c0f);
  min-height: 100vh;
  outline: none;
}

.cpub-scroll-main {
  position: relative;
}

/* Footer */
.cpub-scroll-footer {
  background: var(--bg-page, #0c0c0f);
  padding: 32px;
  text-align: center;
  font-family: var(--font-ui);
  font-size: 12px;
  color: var(--text-on-dark-faint, rgba(255, 255, 255, 0.2));
}

.cpub-scroll-footer a {
  color: var(--text-on-dark-faint, rgba(255, 255, 255, 0.2));
  text-decoration: underline;
  text-underline-offset: 2px;
}

.cpub-scroll-footer a:hover {
  color: var(--accent);
}

.cpub-scroll-footer-sep {
  margin: 0 8px;
  opacity: 0.5;
}
</style>
