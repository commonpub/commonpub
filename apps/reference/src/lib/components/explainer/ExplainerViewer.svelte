<script lang="ts">
  import { onMount } from 'svelte';
  import {
    createProgressState,
    markSectionCompleted,
    canAccessSection,
    getCompletionPercentage,
    generateToc,
    type ExplainerSection,
    type ExplainerProgressState,
  } from '@snaplify/explainer';
  import ExplainerProgress from './ExplainerProgress.svelte';
  import ExplainerToc from './ExplainerToc.svelte';
  import ExplainerSectionComponent from './ExplainerSection.svelte';
  import ExplainerNav from './ExplainerNav.svelte';

  let {
    sections,
    title,
    storageKey,
  }: {
    sections: ExplainerSection[];
    title: string;
    storageKey: string;
  } = $props();

  let progress = $state<ExplainerProgressState>(createProgressState(sections));
  let activeSectionIndex = $state(0);
  let activeSectionId = $derived(sections[activeSectionIndex]?.id ?? '');

  let tocItems = $derived(generateToc(sections, progress, activeSectionId));
  let percentage = $derived(getCompletionPercentage(progress));

  onMount(() => {
    loadProgress();
    setupKeyboardNav();
    setupScrollObserver();
  });

  function loadProgress() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as ExplainerProgressState;
        // Merge saved progress with current sections
        const merged = createProgressState(sections);
        for (const [id, p] of Object.entries(parsed.sections)) {
          if (merged.sections[id]) {
            merged.sections[id] = p;
          }
        }
        merged.startedAt = parsed.startedAt;
        merged.lastAccessedAt = new Date().toISOString();
        progress = merged;
      }
    } catch {
      // Ignore corrupt localStorage
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(progress));
    } catch {
      // Ignore full localStorage
    }
  }

  function handleSectionComplete(sectionId: string, quizScore?: number) {
    progress = markSectionCompleted(progress, sectionId, quizScore);
    saveProgress();

    // Auto-mark text sections as complete when scrolled into view
    // For quiz/checkpoint, completion is handled by their components
  }

  function scrollToSection(anchor: string) {
    const el = document.getElementById(anchor);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function handleTocSelect(anchor: string) {
    scrollToSection(anchor);
  }

  function handlePrevious() {
    if (activeSectionIndex > 0) {
      const prevSection = sections[activeSectionIndex - 1];
      if (prevSection) scrollToSection(prevSection.anchor);
    }
  }

  function handleNext() {
    if (activeSectionIndex < sections.length - 1) {
      const nextSection = sections[activeSectionIndex + 1];
      if (nextSection && canAccessSection(progress, sections, nextSection.id)) {
        scrollToSection(nextSection.anchor);
      }
    }
  }

  function setupKeyboardNav() {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }

  function setupScrollObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const sectionId = el.dataset.sectionId;
            const sectionType = el.dataset.sectionType;
            if (sectionId) {
              const idx = sections.findIndex((s) => s.id === sectionId);
              if (idx >= 0) activeSectionIndex = idx;

              // Auto-complete text sections on view
              if (sectionType === 'text' && !progress.sections[sectionId]?.completed) {
                handleSectionComplete(sectionId);
              }
            }
          }
        }
      },
      { threshold: 0.5 },
    );

    // Defer observation to next tick
    setTimeout(() => {
      const sectionEls = document.querySelectorAll('.explainer-section');
      sectionEls.forEach((el) => observer.observe(el));
    }, 0);

    return () => observer.disconnect();
  }
</script>

<div class="explainer-layout">
  <ExplainerProgress {percentage} />

  <aside class="explainer-sidebar">
    <ExplainerToc items={tocItems} onselect={handleTocSelect} />
  </aside>

  <main class="explainer-main">
    <header class="explainer-header">
      <h1>{title}</h1>
    </header>

    {#each sections as section, i}
      <ExplainerSectionComponent
        {section}
        locked={!canAccessSection(progress, sections, section.id)}
        completed={progress.sections[section.id]?.completed ?? false}
        onsectioncomplete={handleSectionComplete}
      />
    {/each}

    <ExplainerNav
      hasPrevious={activeSectionIndex > 0}
      hasNext={activeSectionIndex < sections.length - 1 &&
        canAccessSection(progress, sections, sections[activeSectionIndex + 1]?.id ?? '')}
      onprevious={handlePrevious}
      onnext={handleNext}
    />
  </main>
</div>

<style>
  .explainer-layout {
    display: grid;
    grid-template-columns: 240px 1fr;
    min-height: 100vh;
  }

  .explainer-sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    border-right: 1px solid var(--color-border, #272725);
    background: var(--color-surface, #0c0c0b);
  }

  .explainer-main {
    max-width: var(--layout-content-width, 768px);
    margin: 0 auto;
    padding: var(--space-12, 3rem);
  }

  .explainer-header h1 {
    font-size: var(--text-3xl, 2.25rem);
    color: var(--color-text, #d8d5cf);
    margin-bottom: var(--space-12, 3rem);
  }

  @media (max-width: 768px) {
    .explainer-layout {
      grid-template-columns: 1fr;
    }

    .explainer-sidebar {
      display: none;
    }
  }
</style>
