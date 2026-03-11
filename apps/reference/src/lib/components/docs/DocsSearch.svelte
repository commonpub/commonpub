<script lang="ts">
  import { sanitizeHtml } from '@snaplify/docs';

  let {
    siteSlug,
    versionId = '',
    class: className = '',
  }: {
    siteSlug: string;
    versionId?: string;
    class?: string;
  } = $props();

  let query = $state('');
  let results = $state<Array<{ id: string; title: string; slug: string; snippet: string }>>([]);
  let isOpen = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function handleInput(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    query = target.value;

    if (debounceTimer) clearTimeout(debounceTimer);

    if (!query.trim()) {
      results = [];
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, siteSlug });
        if (versionId) params.set('versionId', versionId);
        const res = await fetch(`/api/docs/search?${params}`);
        if (res.ok) {
          results = await res.json();
          isOpen = true;
        }
      } catch {
        results = [];
      }
    }, 300);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      isOpen = false;
    }
  }
</script>

<div class="docs-search {className}" role="search" aria-label="Search documentation">
  <input
    type="search"
    placeholder="Search docs..."
    aria-label="Search documentation"
    value={query}
    oninput={handleInput}
    onkeydown={handleKeydown}
    onfocus={() => {
      if (results.length) isOpen = true;
    }}
    onblur={() => {
      setTimeout(() => {
        isOpen = false;
      }, 200);
    }}
    class="docs-search-input"
  />

  {#if isOpen && results.length > 0}
    <ul class="docs-search-results" role="listbox" aria-label="Search results">
      {#each results as result}
        <li class="docs-search-result" role="option">
          <a href="/docs/{siteSlug}/{result.slug}" class="docs-search-result-link">
            <span class="docs-search-result-title">{result.title}</span>
            {#if result.snippet}
              <span class="docs-search-result-snippet">{@html sanitizeHtml(result.snippet)}</span>
            {/if}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .docs-search {
    position: relative;
  }

  .docs-search-input {
    width: 100%;
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border: 1px solid var(--border-default, #e5e7eb);
    border-radius: var(--radius-md, 0.375rem);
    background: var(--bg-surface, #fff);
    color: var(--text-primary, inherit);
    font-size: var(--text-sm, 0.875rem);
  }

  .docs-search-input::placeholder {
    color: var(--text-muted, #9ca3af);
  }

  .docs-search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: var(--space-1, 0.25rem);
    background: var(--bg-surface, #fff);
    border: 1px solid var(--border-default, #e5e7eb);
    border-radius: var(--radius-md, 0.375rem);
    box-shadow: var(--shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1));
    list-style: none;
    padding: var(--space-1, 0.25rem);
    margin: 0;
    margin-top: var(--space-1, 0.25rem);
    max-height: 20rem;
    overflow-y: auto;
    z-index: 10;
  }

  .docs-search-result-link {
    display: block;
    padding: var(--space-2, 0.5rem);
    text-decoration: none;
    border-radius: var(--radius-sm, 0.25rem);
    color: var(--text-primary, inherit);
  }

  .docs-search-result-link:hover {
    background: var(--bg-hover, #f3f4f6);
  }

  .docs-search-result-title {
    display: block;
    font-weight: var(--font-weight-medium, 500);
    font-size: var(--text-sm, 0.875rem);
  }

  .docs-search-result-snippet {
    display: block;
    font-size: var(--text-xs, 0.75rem);
    color: var(--text-muted, #9ca3af);
    margin-top: var(--space-1, 0.25rem);
  }
</style>
