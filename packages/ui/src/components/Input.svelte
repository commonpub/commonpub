<script lang="ts">
  interface Props {
    id: string;
    label: string;
    value?: string;
    type?: 'text' | 'email' | 'password' | 'url' | 'search' | 'tel' | 'number';
    name?: string;
    placeholder?: string;
    maxlength?: number;
    error?: string;
    disabled?: boolean;
    required?: boolean;
    class?: string;
    oninput?: (e: Event) => void;
    onchange?: (e: Event) => void;
  }

  let {
    id,
    label,
    value = $bindable(''),
    type = 'text',
    name,
    placeholder = '',
    maxlength,
    error = '',
    disabled = false,
    required = false,
    class: className = '',
    oninput,
    onchange,
  }: Props = $props();

  const errorId = $derived(error ? `${id}-error` : undefined);
</script>

<div class={['snaplify-input-group', className].filter(Boolean).join(' ')}>
  <label class="snaplify-input-label" for={id}>{label}</label>
  <input
    class="snaplify-input"
    {id}
    {type}
    name={name ?? undefined}
    {placeholder}
    maxlength={maxlength ?? undefined}
    {disabled}
    {required}
    bind:value
    aria-invalid={error ? true : undefined}
    aria-describedby={errorId}
    {oninput}
    {onchange}
  />
  {#if error}
    <p class="snaplify-input-error" id={errorId} role="alert">{error}</p>
  {/if}
</div>

<style>
  .snaplify-input-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
  }

  .snaplify-input-label {
    font-family: var(--font-body, sans-serif);
    font-size: var(--text-sm);
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #1a1a1a);
  }

  .snaplify-input {
    font-family: var(--font-body, sans-serif);
    font-size: var(--text-base);
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-md, 0.375rem);
    background: var(--color-surface, #fff);
    color: var(--color-text, #1a1a1a);
    transition: var(--transition-default, 150ms ease);
  }

  .snaplify-input:focus-visible {
    outline: var(--focus-ring, 2px solid currentColor);
    outline-offset: 2px;
  }

  .snaplify-input[aria-invalid='true'] {
    border-color: var(--color-error, #ef4444);
  }

  .snaplify-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .snaplify-input-error {
    font-family: var(--font-body, sans-serif);
    font-size: var(--text-sm);
    color: var(--color-error, #ef4444);
    margin: 0;
  }
</style>
