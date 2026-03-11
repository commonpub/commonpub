<script lang="ts">
  import ActivityLog from '$lib/components/federation/ActivityLog.svelte';
  import FollowRequests from '$lib/components/federation/FollowRequests.svelte';
  import TrustedInstances from '$lib/components/federation/TrustedInstances.svelte';
  import RemoteActorCard from '$lib/components/federation/RemoteActorCard.svelte';

  let { data } = $props();
</script>

<svelte:head>
  <title>Federation Dashboard</title>
</svelte:head>

<main class="federation-dashboard">
  <h1>Federation</h1>

  <div class="stats">
    <div class="stat-card">
      <span class="stat-value">{data.followers.length}</span>
      <span class="stat-label">Remote Followers</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{data.following.length}</span>
      <span class="stat-label">Following (Remote)</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{data.activityLog.total}</span>
      <span class="stat-label">Activities</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{data.pendingRequests.length}</span>
      <span class="stat-label">Pending Requests</span>
    </div>
  </div>

  {#if data.pendingRequests.length > 0}
    <section>
      <h2>Pending Follow Requests</h2>
      <FollowRequests requests={data.pendingRequests} domain={data.domain} />
    </section>
  {/if}

  <section>
    <h2>Activity Log</h2>
    <ActivityLog items={data.activityLog.items} />
  </section>

  <section>
    <h2>Trusted Instances</h2>
    <TrustedInstances instances={data.trustedInstances} />
  </section>
</main>

<style>
  .federation-dashboard {
    max-width: 64rem;
    margin: 0 auto;
    padding: var(--space-4, 1rem);
  }

  h1 {
    font-size: var(--text-2xl, 1.5rem);
    font-weight: var(--font-weight-bold, 700);
    margin-bottom: var(--space-4, 1rem);
  }

  h2 {
    font-size: var(--text-lg, 1.125rem);
    font-weight: var(--font-semibold, 600);
    margin-bottom: var(--space-3, 0.75rem);
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: var(--space-3, 0.75rem);
    margin-bottom: var(--space-6, 1.5rem);
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-4, 1rem);
    background: var(--color-bg-card, #f9f9f9);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-lg, 0.5rem);
  }

  .stat-value {
    font-size: var(--text-2xl, 1.5rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #111);
  }

  .stat-label {
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-secondary, #888884);
  }

  section {
    margin-bottom: var(--space-6, 1.5rem);
  }
</style>
