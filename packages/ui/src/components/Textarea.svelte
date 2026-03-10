<script lang="ts">
  interface Props {
    id: string;
    label: string;
    value?: string;
    placeholder?: string;
    rows?: number;
    error?: string;
    disabled?: boolean;
    required?: boolean;
    class?: string;
    oninput?: (e: Event) => void;
  }

  let {
    id,
    label,
    value = $bindable(''),
    placeholder = '',
    rows = 4,
    error = '',
    disabled = false,
    required = false,
    class: className = '',
    oninput,
  }: Props = $props();

  const errorId = $derived(error ? `${id}-error` : undefined);
</script>

<div class={['snaplify-textarea-group', className].filter(Boolean).join(' ')}>
  <label class="snaplify-textarea-label" for={id}>{label}</label>
  <textarea
    class="snaplify-textarea"
    {id}
    {placeholder}
    {rows}
    {disabled}
    {required}
    bind:value
    aria-invalid={error ? true : undefined}
    aria-describedby={errorId}
    {oninput}
  ></textarea>
  {#if error}
    <p class="snaplify-textarea-error" id={errorId} role="alert">{error}</p>
  {/if}
</div>

<style>
  .snaplify-textarea-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
  }

  .snaplify-textarea-label {
    font-family: var(--font-body, sans-serif);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #1a1a1a);
  }

  .snaplify-textarea {
    font-family: var(--font-body, sans-serif);
    font-size: var(--font-size-base, 1rem);
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-md, 0.375rem);
    background: var(--color-surface, #fff);
    color: var(--color-text, #1a1a1a);
    resize: vertical;
    transition: var(--transition-default, 150ms ease);
  }

  .snaplify-textarea:focus-visible {
    outline: var(--focus-ring, 2px solid currentColor);
    outline-offset: 2px;
  }

  .snaplify-textarea[aria-invalid='true'] {
    border-color: var(--color-error, #ef4444);
  }

  .snaplify-textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .snaplify-textarea-error {
    font-family: var(--font-body, sans-serif);
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--color-error, #ef4444);
    margin: 0;
  }
</style>
