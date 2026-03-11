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

              if (sectionType === 'text' && !progress.sections[sectionId]?.completed) {
                handleSectionComplete(sectionId);
              }
            }
          }
        }
      },
      { threshold: 0.5 },
    );

    setTimeout(() => {
      const sectionEls = document.querySelectorAll('.explainer-section');
      sectionEls.forEach((el) => observer.observe(el));
    }, 0);

    return () => observer.disconnect();
  }
</script>

<div class="exp-layout">
  <!-- Sidebar with TOC + progress -->
  <aside class="exp-sidebar">
    <div class="exp-sidebar-header">
      <span class="exp-sidebar-label">Explainer</span>
      <span class="exp-sidebar-pct">{percentage}%</span>
    </div>

    <div class="exp-progress-bar">
      <div class="exp-progress-fill" style="width: {percentage}%;"></div>
    </div>

    <nav class="exp-nav" aria-label="Section navigation">
      {#each sections as section, i}
        {@const sectionProgress = progress.sections[section.id]}
        {@const isActive = activeSectionId === section.id}
        {@const isCompleted = sectionProgress?.completed ?? false}
        {@const isLocked = !canAccessSection(progress, sections, section.id)}
        <button
          class="exp-nav-item"
          class:exp-nav-active={isActive}
          class:exp-nav-completed={isCompleted}
          class:exp-nav-locked={isLocked}
          onclick={() => !isLocked && scrollToSection(section.anchor)}
          disabled={isLocked}
          aria-current={isActive ? 'step' : undefined}
        >
          <span class="exp-nav-dot">
            {#if isCompleted}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M2 5l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            {:else}
              <span class="exp-nav-num">{i + 1}</span>
            {/if}
          </span>
          <span class="exp-nav-title">{section.title}</span>
          {#if section.type !== 'text'}
            <span class="exp-nav-tag">{section.type}</span>
          {/if}
        </button>
      {/each}
    </nav>
  </aside>

  <!-- Main content area -->
  <main class="exp-main">
    <header class="exp-header">
      <h1 class="exp-title">{title}</h1>
      <ExplainerProgress {percentage} />
    </header>

    {#each sections as section, i}
      <div
        class="exp-section"
        class:exp-section-alt={i % 2 === 1}
        id={section.anchor}
      >
        <span class="exp-section-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>

        {#if section.type !== 'text'}
          <span class="exp-section-tag">{section.type}</span>
        {/if}

        <ExplainerSectionComponent
          {section}
          locked={!canAccessSection(progress, sections, section.id)}
          completed={progress.sections[section.id]?.completed ?? false}
          onsectioncomplete={handleSectionComplete}
        />

        <!-- Interactive embed zone -->
        {#if section.type === 'interactive'}
          <div class="exp-embed">
            <span class="exp-embed-label">Interactive: {section.title}</span>
          </div>
        {/if}
      </div>
    {/each}

    <!-- Bottom nav -->
    <div class="exp-bottom-nav">
      <div class="exp-dots">
        {#each sections as section, i}
          <button
            class="exp-dot"
            class:exp-dot-active={i === activeSectionIndex}
            class:exp-dot-done={progress.sections[section.id]?.completed}
            onclick={() => scrollToSection(section.anchor)}
            aria-label="Go to section {i + 1}"
          ></button>
        {/each}
      </div>

      <ExplainerNav
        hasPrevious={activeSectionIndex > 0}
        hasNext={activeSectionIndex < sections.length - 1 &&
          canAccessSection(progress, sections, sections[activeSectionIndex + 1]?.id ?? '')}
        onprevious={handlePrevious}
        onnext={handleNext}
      />
    </div>
  </main>
</div>

<style>
  /* Full-height explainer layout */
  .exp-layout {
    display: grid;
    grid-template-columns: 200px 1fr;
    min-height: 100vh;
  }

  /* Sidebar */
  .exp-sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    border-right: 1px solid var(--color-border, #272725);
    background: var(--color-surface, #0c0c0b);
    padding: var(--space-4, 1rem) 0;
  }

  .exp-sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--space-3, 0.75rem) var(--space-3, 0.75rem);
  }

  .exp-sidebar-label {
    font-family: var(--font-mono, monospace);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-text-muted, #444440);
  }

  .exp-sidebar-pct {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--color-accent, #5b9cf6);
    font-weight: 700;
  }

  .exp-progress-bar {
    height: 2px;
    background: var(--color-border, #272725);
    margin: 0 var(--space-3, 0.75rem) var(--space-3, 0.75rem);
  }

  .exp-progress-fill {
    height: 100%;
    background: var(--color-accent, #5b9cf6);
    transition: width 0.3s ease;
  }

  /* Nav items */
  .exp-nav {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .exp-nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border: none;
    background: transparent;
    cursor: pointer;
    text-align: left;
    color: var(--color-text-secondary, #888884);
    width: 100%;
  }

  .exp-nav-item:hover:not(:disabled) {
    background: var(--color-surface-alt, #141413);
    color: var(--color-text, #d8d5cf);
  }

  .exp-nav-active {
    background: var(--color-surface-alt, #141413);
    color: var(--color-text, #d8d5cf);
    border-left: 2px solid var(--color-accent, #5b9cf6);
  }

  .exp-nav-completed {
    color: var(--color-success, #4ade80);
  }

  .exp-nav-locked {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .exp-nav-dot {
    width: 18px;
    height: 18px;
    border-radius: var(--radius-full, 50%);
    border: 1px solid var(--color-border-strong, #333330);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 9px;
    font-family: var(--font-mono, monospace);
  }

  .exp-nav-active .exp-nav-dot {
    border-color: var(--color-accent, #5b9cf6);
    color: var(--color-accent, #5b9cf6);
  }

  .exp-nav-completed .exp-nav-dot {
    border-color: var(--color-success, #4ade80);
    background: rgba(74, 222, 128, 0.1);
    color: var(--color-success, #4ade80);
  }

  .exp-nav-num {
    font-size: 9px;
    color: inherit;
  }

  .exp-nav-title {
    font-size: 11px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .exp-nav-tag {
    font-family: var(--font-mono, monospace);
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-accent, #5b9cf6);
    flex-shrink: 0;
  }

  /* Main content */
  .exp-main {
    overflow-y: auto;
  }

  .exp-header {
    padding: var(--space-8, 2rem) var(--space-10, 3rem);
    max-width: 720px;
    margin: 0 auto;
  }

  .exp-title {
    font-size: 30px;
    font-weight: 700;
    color: var(--color-text, #d8d5cf);
    line-height: 1.2;
    margin: 0 0 var(--space-4, 1rem);
  }

  /* Sections */
  .exp-section {
    position: relative;
    min-height: 80vh;
    padding: var(--space-12, 3rem) var(--space-10, 3rem);
    max-width: 720px;
    margin: 0 auto;
  }

  .exp-section-alt {
    background: var(--color-surface-alt, #141413);
    max-width: none;
    padding-left: calc((100% - 720px) / 2 + 3rem);
    padding-right: calc((100% - 720px) / 2 + 3rem);
  }

  .exp-section-num {
    position: absolute;
    top: var(--space-8, 2rem);
    right: var(--space-4, 1rem);
    font-family: var(--font-mono, monospace);
    font-size: 80px;
    font-weight: 700;
    color: var(--color-text-muted, #444440);
    opacity: 0.08;
    line-height: 1;
    pointer-events: none;
    user-select: none;
  }

  .exp-section-tag {
    display: inline-block;
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-accent, #5b9cf6);
    margin-bottom: var(--space-3, 0.75rem);
  }

  /* Interactive embed zone */
  .exp-embed {
    margin-top: var(--space-6, 1.5rem);
    padding: var(--space-8, 2rem);
    border: 1px dashed var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    background: var(--color-surface, #0c0c0b);
    text-align: center;
  }

  .exp-embed-label {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--color-text-muted, #444440);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* Bottom nav */
  .exp-bottom-nav {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4, 1rem);
    padding: var(--space-8, 2rem) var(--space-10, 3rem);
    border-top: 1px solid var(--color-border, #272725);
    max-width: 720px;
    margin: 0 auto;
  }

  .exp-dots {
    display: flex;
    gap: 6px;
  }

  .exp-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full, 50%);
    border: 1px solid var(--color-border-strong, #333330);
    background: transparent;
    cursor: pointer;
    padding: 0;
  }

  .exp-dot:hover {
    border-color: var(--color-text-secondary, #888884);
  }

  .exp-dot-active {
    background: var(--color-accent, #5b9cf6);
    border-color: var(--color-accent, #5b9cf6);
  }

  .exp-dot-done {
    background: var(--color-success, #4ade80);
    border-color: var(--color-success, #4ade80);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .exp-layout {
      grid-template-columns: 1fr;
    }

    .exp-sidebar {
      display: none;
    }

    .exp-section {
      min-height: auto;
      padding: var(--space-8, 2rem) var(--space-4, 1rem);
    }

    .exp-section-alt {
      padding-left: var(--space-4, 1rem);
      padding-right: var(--space-4, 1rem);
    }

    .exp-section-num {
      font-size: 48px;
    }

    .exp-header {
      padding: var(--space-6, 1.5rem) var(--space-4, 1rem);
    }

    .exp-title {
      font-size: 24px;
    }
  }
</style>
