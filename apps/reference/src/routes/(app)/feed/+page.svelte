<script lang="ts">
  import ContentCard from '$lib/components/ContentCard.svelte';
  import FilterBar from '$lib/components/FilterBar.svelte';
  import SidebarCard from '$lib/components/SidebarCard.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let activeFilter = $state(0);
</script>

<svelte:head>
  <title>Feed — Snaplify</title>
  <meta name="description" content="Recent activity from the community." />
</svelte:head>

<div class="page">
  <div class="grid-sb">
    <div>
      <FilterBar
        chips={['following', 'federated', 'local']}
        active={activeFilter}
        onchange={(i) => activeFilter = i}
      />

      {#if data.items.length === 0}
        <div class="empty-state">
          <p>No activity yet. Follow makers and communities to see their content here.</p>
        </div>
      {:else}
        {#each data.items as item (item.id)}
          <div class="feed-item">
            <div class="av">{(item.author.displayName ?? item.author.username ?? '?')[0].toUpperCase()}</div>
            <div class="feed-body">
              <div class="feed-action">
                <strong>{item.author.displayName ?? item.author.username}</strong>&nbsp;published a {item.type}
                <span class="ts">{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
              </div>
              <a href="/{item.type === 'project' ? 'projects' : item.type === 'article' ? 'articles' : item.type === 'guide' ? 'guides' : item.type === 'blog' ? 'blog' : item.type === 'explainer' ? 'explainers' : item.type}/{item.slug}" class="feed-ref">
                <div class="feed-thumb"></div>
                <div>
                  <div class="ref-type">{item.type}</div>
                  <div class="ref-title">{item.title}</div>
                </div>
              </a>
            </div>
          </div>
        {/each}
      {/if}

      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        buildUrl={(p) => `/feed${p > 1 ? `?page=${p}` : ''}`}
      />
    </div>

    <div>
      <SidebarCard title="who to follow">
        <div class="sb-placeholder">
          <span class="faint-label">suggestions based on your interests</span>
        </div>
      </SidebarCard>
      <SidebarCard title="active communities">
        <div class="sb-placeholder">
          <span class="faint-label">communities with recent activity</span>
        </div>
      </SidebarCard>
    </div>
  </div>
</div>

<style>
  a.feed-ref {
    text-decoration: none;
    color: inherit;
  }

  a.feed-ref:hover {
    border-color: var(--color-border-strong, #333330);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-12, 3rem);
    color: var(--color-text-secondary, #888884);
  }

  .sb-placeholder {
    padding: 8px 0;
  }
</style>
