<script lang="ts">
  import { TOKEN_NAMES, validateTokenOverrides } from '@snaplify/ui';

  interface Props {
    overrides: Record<string, string>;
    class?: string;
    onChange?: (overrides: Record<string, string>) => void;
  }

  let { overrides = {}, class: className = '', onChange }: Props = $props();

  let newKey = $state('');
  let newValue = $state('');

  function addOverride() {
    if (!newKey || !newValue) return;
    const { valid, invalid } = validateTokenOverrides({ [newKey]: newValue });
    if (invalid.length > 0) return;

    const updated = { ...overrides, ...valid };
    onChange?.(updated);
    newKey = '';
    newValue = '';
  }

  function removeOverride(key: string) {
    const updated = { ...overrides };
    delete updated[key];
    onChange?.(updated);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addOverride();
    }
  }
</script>

<div
  class={['admin-token-editor', className].filter(Boolean).join(' ')}
  aria-label="Custom token overrides"
>
  <div class="admin-token-editor__list">
    {#each Object.entries(overrides) as [key, value] (key)}
      <div class="admin-token-editor__row">
        <code class="admin-token-editor__key">--{key}</code>
        <span class="admin-token-editor__value">{value}</span>
        <button
          type="button"
          class="admin-token-editor__remove"
          aria-label={`Remove override for ${key}`}
          onclick={() => removeOverride(key)}
        >
          Remove
        </button>
      </div>
    {/each}
  </div>

  <div class="admin-token-editor__add">
    <select bind:value={newKey} aria-label="Token name" class="admin-token-editor__select">
      <option value="">Select token...</option>
      {#each TOKEN_NAMES as token}
        <option value={token}>{token}</option>
      {/each}
    </select>
    <input
      type="text"
      bind:value={newValue}
      placeholder="Value (e.g. #ff0000)"
      aria-label="Token value"
      class="admin-token-editor__input"
      onkeydown={handleKeydown}
    />
    <button
      type="button"
      class="admin-token-editor__btn"
      aria-label="Add token override"
      onclick={addOverride}
      disabled={!newKey || !newValue}
    >
      Add
    </button>
  </div>
</div>

<style>
  .admin-token-editor {
    font-family: var(--font-body, sans-serif);
  }

  .admin-token-editor__list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
    margin-bottom: var(--space-3, 0.75rem);
  }

  .admin-token-editor__row {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-2, 0.5rem);
    background: var(--color-surface-alt, #f8f9fa);
    border-radius: var(--radius-md, 0.25rem);
  }

  .admin-token-editor__key {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-primary, #3b82f6);
    flex-shrink: 0;
  }

  .admin-token-editor__value {
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text, #d8d5cf);
    flex: 1;
  }

  .admin-token-editor__remove {
    font-family: var(--font-body, sans-serif);
    font-size: var(--text-xs, 0.6875rem);
    color: var(--color-error, #ef4444);
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--space-1, 0.25rem);
  }

  .admin-token-editor__remove:focus {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .admin-token-editor__add {
    display: flex;
    gap: var(--space-2, 0.5rem);
    align-items: center;
  }

  .admin-token-editor__select,
  .admin-token-editor__input {
    font-family: var(--font-body, sans-serif);
    font-size: var(--text-sm, 0.75rem);
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    border: var(--border-width-thin, 1px) solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-md, 0.25rem);
    background: var(--color-surface, #fff);
    color: var(--color-text, #d8d5cf);
  }

  .admin-token-editor__select:focus,
  .admin-token-editor__input:focus {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .admin-token-editor__select {
    flex: 1;
  }

  .admin-token-editor__input {
    flex: 1;
  }

  .admin-token-editor__btn {
    font-family: var(--font-body, sans-serif);
    font-size: var(--text-sm, 0.75rem);
    font-weight: var(--font-weight-medium, 500);
    padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
    border: var(--border-width-thin, 1px) solid var(--color-primary, #3b82f6);
    border-radius: var(--radius-md, 0.25rem);
    background: var(--color-primary, #3b82f6);
    color: var(--color-primary-text, #fff);
    cursor: pointer;
  }

  .admin-token-editor__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-token-editor__btn:focus {
    outline: none;
    box-shadow: var(--focus-ring);
  }
</style>
