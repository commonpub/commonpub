<script lang="ts">
  let {
    pathTitle,
    earnerName,
    issuedAt,
    verificationCode,
  }: {
    pathTitle: string;
    earnerName: string;
    issuedAt: Date;
    verificationCode: string;
  } = $props();

  const formattedDate = new Date(issuedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
</script>

<div class="certificate" aria-label="Certificate for {pathTitle}">
  <div class="certificate-header">Certificate of Completion</div>
  <div class="certificate-body">
    <h3 class="certificate-path">{pathTitle}</h3>
    {#if earnerName}
      <p class="certificate-earner">Awarded to {earnerName}</p>
    {/if}
    <p class="certificate-date">{formattedDate}</p>
  </div>
  <div class="certificate-footer">
    <span class="certificate-code">Verification: {verificationCode}</span>
    <a href="/certificates/{verificationCode}" class="certificate-verify">Verify</a>
  </div>
</div>

<style>
  .certificate {
    border: 2px solid var(--color-primary, #2563eb);
    border-radius: var(--radius-md, 6px);
    overflow: hidden;
    background: var(--color-surface, #0c0c0b);
  }

  .certificate-header {
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    font-size: var(--text-sm, 0.875rem);
    font-weight: var(--font-weight-semibold, 600);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-align: center;
  }

  .certificate-body {
    padding: var(--space-6, 2rem) var(--space-4, 1rem);
    text-align: center;
  }

  .certificate-path {
    font-size: var(--text-lg, 1.25rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
    margin: 0 0 var(--space-2, 0.5rem);
  }

  .certificate-earner {
    font-size: var(--text-md, 1rem);
    color: var(--color-text-secondary, #888884);
    margin: 0 0 var(--space-1, 0.25rem);
  }

  .certificate-date {
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-secondary, #888884);
    margin: 0;
  }

  .certificate-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    border-top: 1px solid var(--color-border, #272725);
    font-size: var(--text-xs, 0.75rem);
  }

  .certificate-code {
    color: var(--color-text-secondary, #888884);
    font-family: monospace;
  }

  .certificate-verify {
    color: var(--color-primary, #2563eb);
    text-decoration: none;
    font-weight: var(--font-weight-medium, 500);
  }
</style>
