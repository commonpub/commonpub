<script lang="ts">
  let {
    prev = null,
    next = null,
    siteSlug,
    class: className = '',
  }: {
    prev?: { title: string; path: string } | null;
    next?: { title: string; path: string } | null;
    siteSlug: string;
    class?: string;
  } = $props();
</script>

<nav class="prev-next-nav {className}" aria-label="Previous and next pages">
  <div class="prev-next-nav-inner">
    {#if prev}
      <a
        href="/docs/{siteSlug}/{prev.path}"
        class="prev-next-link prev-next-prev"
        aria-label="Previous page: {prev.title}"
      >
        <span class="prev-next-label">Previous</span>
        <span class="prev-next-title">{prev.title}</span>
      </a>
    {:else}
      <div></div>
    {/if}

    {#if next}
      <a
        href="/docs/{siteSlug}/{next.path}"
        class="prev-next-link prev-next-next"
        aria-label="Next page: {next.title}"
      >
        <span class="prev-next-label">Next</span>
        <span class="prev-next-title">{next.title}</span>
      </a>
    {/if}
  </div>
</nav>

<style>
  .prev-next-nav-inner {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4, 1rem);
    padding-top: var(--space-6, 1.5rem);
    border-top: 1px solid var(--border-default, #e5e7eb);
    margin-top: var(--space-8, 2rem);
  }

  .prev-next-link {
    display: flex;
    flex-direction: column;
    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
    border: 1px solid var(--border-default, #e5e7eb);
    border-radius: var(--radius-md, 0.375rem);
    text-decoration: none;
    color: var(--text-primary, inherit);
    max-width: 50%;
  }

  .prev-next-link:hover {
    border-color: var(--border-active, #3b82f6);
    background: var(--bg-hover, #f3f4f6);
  }

  .prev-next-next {
    text-align: right;
    margin-left: auto;
  }

  .prev-next-label {
    font-size: var(--text-xs, 0.75rem);
    color: var(--text-muted, #9ca3af);
    font-weight: var(--font-weight-medium, 500);
  }

  .prev-next-title {
    font-size: var(--text-sm, 0.875rem);
    font-weight: var(--font-semibold, 600);
  }
</style>
