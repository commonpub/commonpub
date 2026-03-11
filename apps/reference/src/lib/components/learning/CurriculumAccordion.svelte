<script lang="ts">
  let {
    modules,
    pathSlug,
  }: {
    modules: Array<{
      id: string;
      title: string;
      description: string | null;
      sortOrder: number;
      lessons: Array<{
        id: string;
        title: string;
        slug: string;
        type: string;
        duration: number | null;
        sortOrder: number;
      }>;
    }>;
    pathSlug: string;
  } = $props();

  let expandedModules = $state<Set<string>>(new Set(modules.map((m) => m.id)));

  function toggleModule(id: string) {
    const next = new Set(expandedModules);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    expandedModules = next;
  }

  const typeIcons: Record<string, string> = {
    article: 'A',
    video: 'V',
    quiz: 'Q',
    project: 'P',
    explainer: 'E',
  };
</script>

<div class="accordion">
  {#each modules as mod (mod.id)}
    <div class="module">
      <button
        class="module-header"
        type="button"
        aria-expanded={expandedModules.has(mod.id)}
        aria-controls="module-{mod.id}"
        onclick={() => toggleModule(mod.id)}
      >
        <span class="module-toggle" aria-hidden="true"
          >{expandedModules.has(mod.id) ? '-' : '+'}</span
        >
        <span class="module-title">{mod.title}</span>
        <span class="module-count">{mod.lessons.length} lessons</span>
      </button>

      {#if expandedModules.has(mod.id)}
        <ul class="lesson-list" id="module-{mod.id}" role="list">
          {#each mod.lessons as lesson (lesson.id)}
            <li class="lesson-item">
              <a href="/learn/{pathSlug}/{lesson.slug}" class="lesson-link">
                <span class="lesson-type-icon" title={lesson.type}
                  >{typeIcons[lesson.type] ?? '?'}</span
                >
                <span class="lesson-title">{lesson.title}</span>
                {#if lesson.duration}
                  <span class="lesson-duration">{lesson.duration}m</span>
                {/if}
              </a>
            </li>
          {/each}
          {#if mod.lessons.length === 0}
            <li class="lesson-empty">No lessons yet</li>
          {/if}
        </ul>
      {/if}
    </div>
  {/each}

  {#if modules.length === 0}
    <p class="empty">No modules yet.</p>
  {/if}
</div>

<style>
  .accordion {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    overflow: hidden;
  }

  .module {
    border-bottom: 1px solid var(--color-border, #272725);
  }

  .module:last-child {
    border-bottom: none;
  }

  .module-header {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    width: 100%;
    padding: var(--space-4, 1rem);
    background: var(--color-surface, #0c0c0b);
    border: none;
    cursor: pointer;
    font-size: var(--text-md, 1rem);
    text-align: left;
    color: var(--color-text, #d8d5cf);
  }

  .module-header:hover {
    background: var(--color-surface-hover, #1c1c1a);
  }

  .module-toggle {
    width: 20px;
    text-align: center;
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text-secondary, #888884);
  }

  .module-title {
    flex: 1;
    font-weight: var(--font-weight-medium, 500);
  }

  .module-count {
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-secondary, #888884);
  }

  .lesson-list {
    list-style: none;
    margin: 0;
    padding: 0;
    background: var(--color-surface-alt, #1c1c1a);
  }

  .lesson-item {
    border-top: 1px solid var(--color-border, #272725);
  }

  .lesson-link {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    padding-left: calc(var(--space-4, 1rem) + 28px);
    text-decoration: none;
    color: var(--color-text, #d8d5cf);
    font-size: var(--text-sm, 0.875rem);
  }

  .lesson-link:hover {
    background: var(--color-surface-hover, #ebebeb);
  }

  .lesson-type-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: var(--radius-sm, 4px);
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
    font-size: var(--text-xs, 0.75rem);
    font-weight: var(--font-weight-bold, 700);
    flex-shrink: 0;
  }

  .lesson-title {
    flex: 1;
  }

  .lesson-duration {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary, #888884);
  }

  .lesson-empty {
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    padding-left: calc(var(--space-4, 1rem) + 28px);
    color: var(--color-text-secondary, #888884);
    font-size: var(--text-sm, 0.875rem);
    font-style: italic;
  }

  .empty {
    padding: var(--space-4, 1rem);
    text-align: center;
    color: var(--color-text-secondary, #888884);
  }
</style>
