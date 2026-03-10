<script lang="ts">
  interface Props {
    src?: string;
    alt: string;
    name?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    class?: string;
  }

  let {
    src,
    alt,
    name = '',
    size = 'md',
    class: className = '',
  }: Props = $props();

  const initials = $derived(
    name
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()
  );

  let imgError = $state(false);

  function handleError(): void {
    imgError = true;
  }
</script>

<span
  class={['snaplify-avatar', `snaplify-avatar--${size}`, className].filter(Boolean).join(' ')}
  role="img"
  aria-label={alt}
>
  {#if src && !imgError}
    <img class="snaplify-avatar-img" {src} alt="" onerror={handleError} />
  {:else}
    <span class="snaplify-avatar-fallback" aria-hidden="true">{initials}</span>
  {/if}
</span>

<style>
  .snaplify-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-full, 9999px);
    overflow: hidden;
    background: var(--color-surface-elevated, #f8f9fa);
    color: var(--color-text-secondary, #64748b);
    font-family: var(--font-body, sans-serif);
    font-weight: var(--font-weight-semibold, 600);
    flex-shrink: 0;
  }

  .snaplify-avatar--sm {
    width: var(--space-8, 2rem);
    height: var(--space-8, 2rem);
    font-size: var(--font-size-xs, 0.75rem);
  }

  .snaplify-avatar--md {
    width: var(--space-10, 2.5rem);
    height: var(--space-10, 2.5rem);
    font-size: var(--font-size-sm, 0.875rem);
  }

  .snaplify-avatar--lg {
    width: var(--space-12, 3rem);
    height: var(--space-12, 3rem);
    font-size: var(--font-size-base, 1rem);
  }

  .snaplify-avatar--xl {
    width: var(--space-16, 4rem);
    height: var(--space-16, 4rem);
    font-size: var(--font-size-lg, 1.125rem);
  }

  .snaplify-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .snaplify-avatar-fallback {
    line-height: 1;
  }
</style>
