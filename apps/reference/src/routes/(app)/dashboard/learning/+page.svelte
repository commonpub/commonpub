<script lang="ts">
  import ProgressBar from '$lib/components/learning/ProgressBar.svelte';
  import CertificateBadge from '$lib/components/learning/CertificateBadge.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>My Learning — Snaplify</title>
</svelte:head>

<div class="learning-dashboard">
  <h1>My Learning</h1>

  <section class="section">
    <h2>Enrollments ({data.enrollments.length})</h2>
    {#if data.enrollments.length === 0}
      <p class="empty">
        You haven't enrolled in any learning paths yet. <a href="/learn">Browse paths</a>
      </p>
    {:else}
      <div class="enrollment-list">
        {#each data.enrollments as enrollment (enrollment.id)}
          <div class="enrollment-card">
            <a href="/learn/{enrollment.path.slug}" class="enrollment-title">
              {enrollment.path.title}
            </a>
            {#if enrollment.path.difficulty}
              <span class="difficulty difficulty-{enrollment.path.difficulty}"
                >{enrollment.path.difficulty}</span
              >
            {/if}
            <ProgressBar value={Number(enrollment.progress)} label="Progress" />
            <div class="enrollment-meta">
              <span>Started {new Date(enrollment.startedAt).toLocaleDateString()}</span>
              {#if enrollment.completedAt}
                <span class="completed-text"
                  >Completed {new Date(enrollment.completedAt).toLocaleDateString()}</span
                >
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <section class="section">
    <h2>Certificates ({data.certificates.length})</h2>
    {#if data.certificates.length === 0}
      <p class="empty">Complete a learning path to earn your first certificate.</p>
    {:else}
      <div class="certificate-list">
        {#each data.certificates as cert (cert.id)}
          <CertificateBadge
            pathTitle={cert.path.title}
            earnerName=""
            issuedAt={cert.issuedAt}
            verificationCode={cert.verificationCode}
          />
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .learning-dashboard {
    max-width: var(--layout-content-width, 960px);
    margin: 0 auto;
  }

  .learning-dashboard h1 {
    font-size: var(--text-2xl, 1.875rem);
    margin-bottom: var(--space-6, 2rem);
    color: var(--color-text, #d8d5cf);
  }

  .section {
    margin-bottom: var(--space-12, 3rem);
  }

  .section h2 {
    font-size: var(--text-lg, 1.25rem);
    margin-bottom: var(--space-4, 1rem);
    color: var(--color-text, #d8d5cf);
  }

  .empty {
    color: var(--color-text-secondary, #888884);
    padding: var(--space-6, 2rem);
    text-align: center;
  }

  .empty a {
    color: var(--color-primary, #2563eb);
  }

  .enrollment-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
  }

  .enrollment-card {
    padding: var(--space-4, 1rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    background: var(--color-surface, #0c0c0b);
  }

  .enrollment-title {
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #d8d5cf);
    text-decoration: none;
    font-size: var(--text-md, 1rem);
    display: block;
    margin-bottom: var(--space-1, 0.25rem);
  }

  .enrollment-title:hover {
    color: var(--color-primary, #2563eb);
  }

  .difficulty {
    display: inline-block;
    font-size: var(--text-xs, 0.75rem);
    padding: 0 var(--space-1, 0.25rem);
    border-radius: var(--radius-sm, 4px);
    text-transform: capitalize;
    margin-bottom: var(--space-2, 0.5rem);
  }

  .difficulty-beginner {
    color: var(--color-success, #22c55e);
    background: var(--color-success-bg, #f0fdf4);
  }
  .difficulty-intermediate {
    color: var(--color-warning, #f59e0b);
    background: var(--color-warning-bg, #fffbeb);
  }
  .difficulty-advanced {
    color: var(--color-error, #dc2626);
    background: var(--color-error-bg, #fef2f2);
  }

  .enrollment-meta {
    display: flex;
    gap: var(--space-2, 0.5rem);
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-secondary, #888884);
    margin-top: var(--space-2, 0.5rem);
  }

  .completed-text {
    color: var(--color-success, #22c55e);
    font-weight: var(--font-weight-medium, 500);
  }

  .certificate-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space-4, 1rem);
  }
</style>
