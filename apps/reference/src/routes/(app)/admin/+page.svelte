<script lang="ts">
  import StatCard from '$lib/components/admin/StatCard.svelte';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();
</script>

<svelte:head>
  <title>Admin Dashboard</title>
</svelte:head>

<h1 class="admin-heading">Dashboard</h1>

<div class="admin-stats-grid">
  <StatCard label="Total Users" value={data.stats.users.total} />
  <StatCard label="Total Content" value={data.stats.content.total} />
  <StatCard label="Communities" value={data.stats.communities.total} />
  <StatCard
    label="Pending Reports"
    value={data.stats.reports.pending}
    description={`${data.stats.reports.total} total`}
  />
</div>

<div class="admin-breakdown">
  <section>
    <h2 class="admin-subheading">Users by Role</h2>
    <div class="admin-stats-grid">
      {#each Object.entries(data.stats.users.byRole) as [role, count]}
        <StatCard label={role} value={count as number} />
      {/each}
    </div>
  </section>

  <section>
    <h2 class="admin-subheading">Content by Type</h2>
    <div class="admin-stats-grid">
      {#each Object.entries(data.stats.content.byType) as [type, count]}
        <StatCard label={type} value={count as number} />
      {/each}
    </div>
  </section>
</div>

<style>
  .admin-heading {
    font-family: var(--font-heading, sans-serif);
    font-size: var(--text-2xl, 1.5rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
    margin: 0 0 var(--space-6, 1.5rem);
  }

  .admin-subheading {
    font-family: var(--font-heading, sans-serif);
    font-size: var(--text-lg, 1.125rem);
    font-weight: var(--font-weight-semibold, 600);
    color: var(--color-text, #d8d5cf);
    margin: var(--space-6, 1.5rem) 0 var(--space-3, 0.75rem);
  }

  .admin-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--space-3, 0.75rem);
  }

  .admin-breakdown {
    margin-top: var(--space-4, 1rem);
  }
</style>
