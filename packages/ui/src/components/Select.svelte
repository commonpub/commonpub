<script lang="ts">
  interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
  }

  interface Props {
    id: string;
    label: string;
    options: SelectOption[];
    value?: string;
    placeholder?: string;
    error?: string;
    disabled?: boolean;
    class?: string;
    onchange?: (value: string) => void;
  }

  let {
    id,
    label,
    options,
    value = $bindable(''),
    placeholder = 'Select an option',
    error = '',
    disabled = false,
    class: className = '',
    onchange,
  }: Props = $props();

  let open = $state(false);
  let activeIndex = $state(-1);
  let listboxRef: HTMLUListElement | undefined = $state(undefined);
  let triggerRef: HTMLButtonElement | undefined = $state(undefined);

  const selectedOption = $derived(options.find((o) => o.value === value));
  const displayText = $derived(selectedOption?.label ?? placeholder);
  const errorId = $derived(error ? `${id}-error` : undefined);
  const listboxId = `${id}-listbox`;

  const enabledOptions = $derived(options.filter((o) => !o.disabled));

  function selectOption(opt: SelectOption): void {
    if (opt.disabled) return;
    value = opt.value;
    onchange?.(opt.value);
    close();
  }

  function toggle(): void {
    if (disabled) return;
    if (open) {
      close();
    } else {
      open = true;
      activeIndex = value ? options.findIndex((o) => o.value === value) : 0;
    }
  }

  function close(): void {
    open = false;
    activeIndex = -1;
    triggerRef?.focus();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (disabled) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        if (!open) {
          open = true;
          activeIndex = 0;
        } else {
          const nextIndex = findNextEnabled(activeIndex, 1);
          if (nextIndex !== -1) activeIndex = nextIndex;
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (!open) {
          open = true;
          activeIndex = options.length - 1;
        } else {
          const prevIndex = findNextEnabled(activeIndex, -1);
          if (prevIndex !== -1) activeIndex = prevIndex;
        }
        break;
      }
      case 'Home': {
        e.preventDefault();
        if (open) activeIndex = findNextEnabled(-1, 1);
        break;
      }
      case 'End': {
        e.preventDefault();
        if (open) activeIndex = findNextEnabled(options.length, -1);
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        if (open && activeIndex >= 0 && activeIndex < options.length) {
          selectOption(options[activeIndex]!);
        } else if (!open) {
          toggle();
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        if (open) close();
        break;
      }
      default: {
        // Type-ahead: find first option starting with the pressed key
        if (e.key.length === 1 && open) {
          const char = e.key.toLowerCase();
          const idx = options.findIndex(
            (o, i) => i > activeIndex && o.label.toLowerCase().startsWith(char) && !o.disabled
          );
          if (idx !== -1) activeIndex = idx;
          else {
            const wrapIdx = options.findIndex(
              (o) => o.label.toLowerCase().startsWith(char) && !o.disabled
            );
            if (wrapIdx !== -1) activeIndex = wrapIdx;
          }
        }
        break;
      }
    }
  }

  function findNextEnabled(from: number, direction: number): number {
    let i = from + direction;
    while (i >= 0 && i < options.length) {
      if (!options[i]!.disabled) return i;
      i += direction;
    }
    return -1;
  }

  function getOptionId(index: number): string {
    return `${id}-option-${index}`;
  }
</script>

<div
  class={['snaplify-select', className].filter(Boolean).join(' ')}
  onkeydown={handleKeydown}
>
  <label class="snaplify-select-label" id={`${id}-label`}>{label}</label>
  <button
    bind:this={triggerRef}
    type="button"
    class="snaplify-select-trigger"
    role="combobox"
    aria-expanded={open}
    aria-haspopup="listbox"
    aria-controls={listboxId}
    aria-labelledby={`${id}-label`}
    aria-activedescendant={open && activeIndex >= 0 ? getOptionId(activeIndex) : undefined}
    aria-invalid={error ? true : undefined}
    aria-describedby={errorId}
    {disabled}
    onclick={toggle}
  >
    <span class="snaplify-select-value">{displayText}</span>
    <span class="snaplify-select-arrow" aria-hidden="true">▾</span>
  </button>

  {#if open}
    <ul
      bind:this={listboxRef}
      id={listboxId}
      class="snaplify-select-listbox"
      role="listbox"
      aria-labelledby={`${id}-label`}
    >
      {#each options as option, index}
        <li
          id={getOptionId(index)}
          role="option"
          class="snaplify-select-option"
          class:snaplify-select-option--active={index === activeIndex}
          class:snaplify-select-option--selected={option.value === value}
          class:snaplify-select-option--disabled={option.disabled}
          aria-selected={option.value === value}
          aria-disabled={option.disabled}
          onclick={() => selectOption(option)}
        >
          {option.label}
        </li>
      {/each}
    </ul>
  {/if}

  {#if error}
    <p class="snaplify-select-error" id={errorId} role="alert">{error}</p>
  {/if}
</div>

<style>
  .snaplify-select {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
    position: relative;
  }

  .snaplify-select-label {
    font-family: var(--font-body, sans-serif);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #1a1a1a);
  }

  .snaplify-select-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    font-family: var(--font-body, sans-serif);
    font-size: var(--font-size-base, 1rem);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-md, 0.375rem);
    background: var(--color-surface, #fff);
    color: var(--color-text, #1a1a1a);
    cursor: pointer;
    text-align: left;
  }

  .snaplify-select-trigger:focus-visible {
    outline: var(--focus-ring, 2px solid currentColor);
    outline-offset: 2px;
  }

  .snaplify-select-trigger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .snaplify-select-trigger[aria-invalid='true'] {
    border-color: var(--color-error, #ef4444);
  }

  .snaplify-select-listbox {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin: var(--space-1, 0.25rem) 0 0;
    padding: var(--space-1, 0.25rem) 0;
    list-style: none;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-md, 0.375rem);
    background: var(--color-surface, #fff);
    box-shadow: var(--shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1));
    z-index: var(--z-dropdown, 100);
    max-height: 15rem;
    overflow-y: auto;
  }

  .snaplify-select-option {
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    font-family: var(--font-body, sans-serif);
    font-size: var(--font-size-base, 1rem);
    cursor: pointer;
    color: var(--color-text, #1a1a1a);
  }

  .snaplify-select-option--active {
    background: var(--color-surface-elevated, #f8f9fa);
  }

  .snaplify-select-option--selected {
    font-weight: var(--font-weight-semibold, 600);
  }

  .snaplify-select-option--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .snaplify-select-error {
    font-family: var(--font-body, sans-serif);
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--color-error, #ef4444);
    margin: 0;
  }
</style>
