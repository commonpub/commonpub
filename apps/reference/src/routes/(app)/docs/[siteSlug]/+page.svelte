<script lang="ts">
  import DocsSidebar from '$lib/components/docs/DocsSidebar.svelte';
  import DocsSearch from '$lib/components/docs/DocsSearch.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.site.name} — Snaplify Docs</title>
  <meta
    name="description"
    content={data.site.description ?? `Documentation for ${data.site.name}`}
  />
</svelte:head>

<div class="docs-layout">
  <DocsSidebar
    nav={data.nav}
    versions={data.versions}
    currentVersion={data.activeVersion.version}
    siteSlug={data.site.slug}
  />

  <main class="docs-main">
    <DocsSearch siteSlug={data.site.slug} versionId={data.activeVersion.id} />

    <div class="docs-overview">
      <h1 class="docs-overview-title">{data.site.name}</h1>
      {#if data.site.description}
        <p class="docs-overview-desc">{data.site.description}</p>
      {/if}

      {#if data.isOwner}
        <div class="docs-owner-actions">
          <a href="/docs/{data.site.slug}/edit" class="docs-owner-link">Site Settings</a>
          <a href="/docs/{data.site.slug}/edit/nav" class="docs-owner-link">Edit Navigation</a>
          <a href="/docs/{data.site.slug}/edit/versions" class="docs-owner-link">Manage Versions</a>
        </div>
      {/if}

      {#if data.pageTree.length > 0}
        <h2 class="docs-overview-section">Pages</h2>
        <ul class="docs-page-list">
          {#each data.pageTree as node}
            <li>
              <a href="/docs/{data.site.slug}/{node.slug}">{node.title}</a>
              {#if node.children.length > 0}
                <ul>
                  {#each node.children as child}
                    <li>
                      <a href="/docs/{data.site.slug}/{node.slug}/{child.slug}">{child.title}</a>
                    </li>
                  {/each}
                </ul>
              {/if}
            </li>
          {/each}
        </ul>
      {:else}
        <p class="docs-empty">
          No pages yet. {#if data.isOwner}<a href="/docs/{data.site.slug}/edit"
              >Create your first page</a
            >.{/if}
        </p>
      {/if}
    </div>
  </main>
</div>

<style>
  .docs-layout {
    display: flex;
    min-height: calc(100vh - 4rem);
  }

  .docs-main {
    flex: 1;
    padding: var(--space-4, 1rem) var(--space-6, 2rem);
    min-width: 0;
  }

  .docs-overview-title {
    font-size: var(--text-2xl, 1.875rem);
    font-weight: var(--font-weight-bold, 700);
    margin-bottom: var(--space-2, 0.5rem);
    color: var(--color-text, inherit);
  }

  .docs-overview-desc {
    font-size: var(--text-lg, 1.125rem);
    color: var(--color-text-secondary, #6b7280);
    margin-bottom: var(--space-6, 2rem);
  }

  .docs-owner-actions {
    display: flex;
    gap: var(--space-2, 0.5rem);
    margin-bottom: var(--space-6, 2rem);
  }

  .docs-owner-link {
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-sm, 0.25rem);
    text-decoration: none;
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text, inherit);
  }

  .docs-owner-link:hover {
    background: var(--color-bg-hover, #f3f4f6);
  }

  .docs-overview-section {
    font-size: var(--text-lg, 1.125rem);
    font-weight: var(--font-weight-semibold, 600);
    margin-bottom: var(--space-2, 0.5rem);
    color: var(--color-text, inherit);
  }

  .docs-page-list {
    padding-left: var(--space-4, 1rem);
  }

  .docs-page-list a {
    color: var(--color-primary, #3b82f6);
    text-decoration: none;
  }

  .docs-page-list a:hover {
    text-decoration: underline;
  }

  .docs-empty {
    color: var(--color-text-secondary, #6b7280);
    padding: var(--space-6, 2rem) 0;
  }
</style>
