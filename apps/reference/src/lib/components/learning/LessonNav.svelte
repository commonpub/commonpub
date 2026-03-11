<script lang="ts">
  let {
    prevLesson,
    nextLesson,
    pathSlug,
  }: {
    prevLesson: { slug: string; title: string } | null;
    nextLesson: { slug: string; title: string } | null;
    pathSlug: string;
  } = $props();
</script>

<nav class="lesson-nav" aria-label="Lesson navigation">
  {#if prevLesson}
    <a href="/learn/{pathSlug}/{prevLesson.slug}" class="nav-link nav-prev">
      <span class="nav-direction">Previous</span>
      <span class="nav-title">{prevLesson.title}</span>
    </a>
  {:else}
    <div></div>
  {/if}

  {#if nextLesson}
    <a href="/learn/{pathSlug}/{nextLesson.slug}" class="nav-link nav-next">
      <span class="nav-direction">Next</span>
      <span class="nav-title">{nextLesson.title}</span>
    </a>
  {/if}
</nav>

<style>
  .lesson-nav {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4, 1rem);
    padding: var(--space-6, 2rem) 0;
    border-top: 1px solid var(--color-border, #272725);
  }

  .nav-link {
    display: flex;
    flex-direction: column;
    text-decoration: none;
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    max-width: 45%;
  }

  .nav-link:hover {
    border-color: var(--color-primary, #2563eb);
  }

  .nav-prev {
    text-align: left;
  }

  .nav-next {
    text-align: right;
    margin-left: auto;
  }

  .nav-direction {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary, #888884);
    text-transform: uppercase;
  }

  .nav-title {
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #d8d5cf);
    font-size: var(--text-sm, 0.875rem);
  }
</style>
