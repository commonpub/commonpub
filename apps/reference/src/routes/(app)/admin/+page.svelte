<script lang="ts">
  import StatCard from '$lib/components/admin/StatCard.svelte';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();
</script>

<svelte:head>
  <title>Admin Dashboard</title>
</svelte:head>

<div class="adm-page-header">
  <h1 class="adm-heading">Dashboard</h1>
  <span class="adm-heading-sub">system overview</span>
</div>

<div class="adm-stats-grid">
  <StatCard label="Total Users" value={data.stats.users.total} />
  <StatCard label="Total Content" value={data.stats.content.total} />
  <StatCard label="Communities" value={data.stats.communities.total} />
  <StatCard
    label="Pending Reports"
    value={data.stats.reports.pending}
    description={`${data.stats.reports.total} total`}
  />
</div>

<div class="adm-breakdown">
  <section>
    <div class="adm-section-head">
      <span class="adm-section-label">Users by Role</span>
    </div>
    <div class="adm-stats-grid">
      {#each Object.entries(data.stats.users.byRole) as [role, count]}
        <StatCard label={role} value={count as number} />
      {/each}
    </div>
  </section>

  <section>
    <div class="adm-section-head">
      <span class="adm-section-label">Content by Type</span>
    </div>
    <div class="adm-stats-grid">
      {#each Object.entries(data.stats.content.byType) as [type, count]}
        <StatCard label={type} value={count as number} />
      {/each}
    </div>
  </section>
</div>

<style>
  .adm-page-header {
    display: flex;
    align-items: baseline;
    gap: var(--space-3, 0.75rem);
    margin-bottom: var(--space-6, 1.5rem);
    padding-bottom: var(--space-3, 0.75rem);
    border-bottom: 1px solid var(--color-border, #272725);
  }

  .adm-heading {
    font-size: var(--text-xl, 1.25rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
    margin: 0;
  }

  .adm-heading-sub {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted, #444440);
  }

  .adm-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--space-3, 0.75rem);
  }

  .adm-breakdown {
    margin-top: var(--space-6, 1.5rem);
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
  }

  .adm-section-head {
    border-bottom: 1px solid var(--color-border, #272725);
    padding-bottom: var(--space-2, 0.5rem);
    margin-bottom: var(--space-3, 0.75rem);
  }

  .adm-section-label {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-text-secondary, #888884);
  }
</style>
