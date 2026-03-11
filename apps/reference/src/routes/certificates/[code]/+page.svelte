<script lang="ts">
  import CertificateBadge from '$lib/components/learning/CertificateBadge.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Certificate Verification — Snaplify</title>
  <meta name="description" content="Verify a Snaplify learning certificate." />
</svelte:head>

<div class="verify-page">
  <h1>Certificate Verification</h1>
  <CertificateBadge
    pathTitle={data.path.title}
    earnerName={data.earner.name}
    issuedAt={data.certificate.issuedAt}
    verificationCode={data.certificate.verificationCode}
  />
  <p class="verify-note">This certificate is verified and authentic.</p>
</div>

<style>
  .verify-page {
    max-width: var(--layout-content-width, 640px);
    margin: 0 auto;
    text-align: center;
    padding: var(--space-12, 3rem) var(--space-4, 1rem);
  }

  .verify-page h1 {
    font-size: var(--text-2xl, 1.875rem);
    margin-bottom: var(--space-6, 2rem);
    color: var(--color-text, #d8d5cf);
  }

  .verify-note {
    margin-top: var(--space-4, 1rem);
    color: var(--color-success, #22c55e);
    font-weight: var(--font-weight-medium, 500);
  }
</style>
