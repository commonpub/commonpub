<script lang="ts">
  import type {
    ExplainerSection,
    TextSection,
    QuizSection,
    CheckpointSection,
  } from '@snaplify/explainer';
  import SectionList from './SectionList.svelte';
  import SectionEditor from './SectionEditor.svelte';

  let {
    sections = [],
    onsectionschange,
  }: {
    sections: ExplainerSection[];
    onsectionschange?: (sections: ExplainerSection[]) => void;
  } = $props();

  let activeIndex = $state(0);
  let activeSection = $derived(sections[activeIndex]);

  function generateAnchor(title: string): string {
    return (
      title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || `section-${Date.now()}`
    );
  }

  function handleAdd(type: string) {
    const id = `sec-${Date.now()}`;
    let newSection: ExplainerSection;

    switch (type) {
      case 'quiz':
        newSection = {
          id,
          title: 'New Quiz',
          anchor: `quiz-${Date.now()}`,
          type: 'quiz',
          content: [],
          questions: [],
          passingScore: 70,
          isGate: false,
        } satisfies QuizSection;
        break;
      case 'checkpoint':
        newSection = {
          id,
          title: 'Checkpoint',
          anchor: `checkpoint-${Date.now()}`,
          type: 'checkpoint',
          content: [],
          requiresPrevious: true,
        } satisfies CheckpointSection;
        break;
      default:
        newSection = {
          id,
          title: 'New Section',
          anchor: `section-${Date.now()}`,
          type: 'text',
          content: [],
        } satisfies TextSection;
    }

    const updated = [...sections, newSection];
    onsectionschange?.(updated);
    activeIndex = updated.length - 1;
  }

  function handleRemove(index: number) {
    const updated = sections.filter((_, i) => i !== index);
    onsectionschange?.(updated);
    if (activeIndex >= updated.length) {
      activeIndex = Math.max(0, updated.length - 1);
    }
  }

  function handleMoveUp(index: number) {
    if (index === 0) return;
    const updated = [...sections];
    [updated[index - 1], updated[index]] = [updated[index]!, updated[index - 1]!];
    onsectionschange?.(updated);
    activeIndex = index - 1;
  }

  function handleMoveDown(index: number) {
    if (index >= sections.length - 1) return;
    const updated = [...sections];
    [updated[index], updated[index + 1]] = [updated[index + 1]!, updated[index]!];
    onsectionschange?.(updated);
    activeIndex = index + 1;
  }

  function handleSelect(index: number) {
    activeIndex = index;
  }

  function handleSectionChange(updated: ExplainerSection) {
    // Auto-generate anchor from title
    if (updated.title !== sections[activeIndex]?.title) {
      updated = { ...updated, anchor: generateAnchor(updated.title) };
    }
    const updatedSections = sections.map((s, i) => (i === activeIndex ? updated : s));
    onsectionschange?.(updatedSections);
  }
</script>

<div class="explainer-editor">
  <aside class="explainer-editor__sidebar">
    <SectionList
      {sections}
      {activeIndex}
      onselect={handleSelect}
      onadd={handleAdd}
      onremove={handleRemove}
      onmoveup={handleMoveUp}
      onmovedown={handleMoveDown}
    />
  </aside>

  <div class="explainer-editor__main">
    {#if activeSection}
      {#key activeSection.id}
        <SectionEditor section={activeSection} onchange={handleSectionChange} />
      {/key}
    {:else}
      <div class="explainer-editor__empty">
        <p>Add a section to get started.</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .explainer-editor {
    display: grid;
    grid-template-columns: 280px 1fr;
    min-height: 500px;
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    overflow: hidden;
  }

  .explainer-editor__sidebar {
    border-right: 1px solid var(--color-border, #272725);
    background: var(--color-surface, #0c0c0b);
    overflow-y: auto;
  }

  .explainer-editor__main {
    overflow-y: auto;
    background: var(--color-surface, #0c0c0b);
  }

  .explainer-editor__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-text-secondary, #888884);
  }
</style>
