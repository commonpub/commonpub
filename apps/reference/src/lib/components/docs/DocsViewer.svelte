<script lang="ts">
  import { sanitizeHtml } from '@snaplify/docs';
  import type { TocEntry, PageFrontmatter } from '@snaplify/docs';

  let {
    html,
    toc = [],
    frontmatter = {},
    themeTokens = null,
    class: className = '',
  }: {
    html: string;
    toc?: TocEntry[];
    frontmatter?: PageFrontmatter;
    themeTokens?: Record<string, string> | null;
    class?: string;
  } = $props();

  const styleVars = $derived(
    themeTokens
      ? Object.entries(themeTokens)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ')
      : '',
  );
</script>

<div
  class="docs-viewer {className}"
  style={styleVars}
  role="article"
  aria-label={frontmatter.title ?? 'Documentation'}
>
  {#if frontmatter.title}
    <h1 class="docs-viewer-title">{frontmatter.title}</h1>
  {/if}

  <div class="docs-viewer-content">
    {@html sanitizeHtml(html)}
  </div>

  {#if toc.length > 0}
    <nav class="docs-viewer-toc" aria-label="Table of contents">
      <h2 class="docs-viewer-toc-title">On this page</h2>
      <ul class="docs-viewer-toc-list">
        {#each toc as entry}
          <li class="docs-viewer-toc-item" style="padding-left: {(entry.level - 2) * 0.75}rem">
            <a href="#{entry.id}" class="docs-viewer-toc-link">{entry.text}</a>
          </li>
        {/each}
      </ul>
    </nav>
  {/if}
</div>

<style>
  .docs-viewer {
    display: flex;
    gap: var(--space-8, 2rem);
    color: var(--text-primary, inherit);
    font-family: var(--font-body, inherit);
  }

  .docs-viewer-title {
    font-size: var(--text-3xl, 1.875rem);
    font-weight: var(--font-bold, 700);
    margin-bottom: var(--space-4, 1rem);
    color: var(--text-primary, inherit);
  }

  .docs-viewer-content {
    flex: 1;
    min-width: 0;
    line-height: var(--leading-relaxed, 1.625);
  }

  .docs-viewer-toc {
    position: sticky;
    top: var(--space-4, 1rem);
    width: 14rem;
    flex-shrink: 0;
    align-self: flex-start;
  }

  .docs-viewer-toc-title {
    font-size: var(--text-sm, 0.875rem);
    font-weight: var(--font-semibold, 600);
    margin-bottom: var(--space-2, 0.5rem);
    color: var(--text-secondary, inherit);
  }

  .docs-viewer-toc-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .docs-viewer-toc-item {
    margin-bottom: var(--space-1, 0.25rem);
  }

  .docs-viewer-toc-link {
    font-size: var(--text-sm, 0.875rem);
    color: var(--text-muted, inherit);
    text-decoration: none;
  }

  .docs-viewer-toc-link:hover {
    color: var(--text-primary, inherit);
  }
</style>
