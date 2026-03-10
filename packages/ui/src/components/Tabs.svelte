<script lang="ts">
  interface Tab {
    id: string;
    label: string;
  }

  interface Props {
    tabs: Tab[];
    activeTab?: string;
    class?: string;
    onchange?: (tabId: string) => void;
  }

  let {
    tabs,
    activeTab = $bindable(tabs[0]?.id ?? ''),
    class: className = '',
    onchange,
  }: Props = $props();

  function selectTab(tabId: string): void {
    activeTab = tabId;
    onchange?.(tabId);
  }

  function handleKeydown(e: KeyboardEvent): void {
    const currentIndex = tabs.findIndex((t) => t.id === activeTab);
    let newIndex = currentIndex;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        newIndex = (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    const tab = tabs[newIndex];
    if (tab) {
      selectTab(tab.id);
      // Focus the new tab button
      const tabEl = document.getElementById(`tab-${tab.id}`);
      tabEl?.focus();
    }
  }
</script>

<div class={['snaplify-tabs', className].filter(Boolean).join(' ')}>
  <div
    class="snaplify-tablist"
    role="tablist"
    onkeydown={handleKeydown}
  >
    {#each tabs as tab}
      <button
        id={`tab-${tab.id}`}
        type="button"
        class="snaplify-tab"
        class:snaplify-tab--active={tab.id === activeTab}
        role="tab"
        aria-selected={tab.id === activeTab}
        aria-controls={`panel-${tab.id}`}
        tabindex={tab.id === activeTab ? 0 : -1}
        onclick={() => selectTab(tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  {#each tabs as tab}
    <div
      id={`panel-${tab.id}`}
      class="snaplify-tabpanel"
      role="tabpanel"
      aria-labelledby={`tab-${tab.id}`}
      hidden={tab.id !== activeTab}
      tabindex={0}
    ></div>
  {/each}
</div>

<style>
  .snaplify-tabs {
    display: flex;
    flex-direction: column;
  }

  .snaplify-tablist {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
  }

  .snaplify-tab {
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    font-family: var(--font-body, sans-serif);
    font-size: var(--font-size-base, 1rem);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--color-text-secondary, #64748b);
    cursor: pointer;
    transition: var(--transition-default, 150ms ease);
    margin-bottom: -1px;
  }

  .snaplify-tab:focus-visible {
    outline: var(--focus-ring, 2px solid currentColor);
    outline-offset: -2px;
  }

  .snaplify-tab--active {
    color: var(--color-primary, #3b82f6);
    border-bottom-color: var(--color-primary, #3b82f6);
    font-weight: var(--font-weight-medium, 500);
  }

  .snaplify-tabpanel {
    padding: var(--space-4, 1rem) 0;
  }

  .snaplify-tabpanel[hidden] {
    display: none;
  }
</style>
