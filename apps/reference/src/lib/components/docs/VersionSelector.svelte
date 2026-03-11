<script lang="ts">
  import type { VersionInfo } from '@snaplify/docs';

  let {
    versions,
    currentVersion = '',
    class: className = '',
    onchange,
  }: {
    versions: VersionInfo[];
    currentVersion?: string;
    class?: string;
    onchange?: (version: string) => void;
  } = $props();
</script>

<div class="version-selector {className}">
  <label for="version-select" class="version-selector-label">Version</label>
  <select
    id="version-select"
    class="version-selector-select"
    aria-label="Select version"
    onchange={(e) => {
      const target = e.currentTarget;
      onchange?.(target.value);
    }}
  >
    {#each versions as version}
      <option value={version.version} selected={version.version === currentVersion}>
        {version.version}{version.isDefault ? ' (default)' : ''}
      </option>
    {/each}
  </select>
</div>

<style>
  .version-selector {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }

  .version-selector-label {
    font-size: var(--text-sm, 0.875rem);
    font-weight: var(--font-weight-medium, 500);
    color: var(--text-secondary, inherit);
  }

  .version-selector-select {
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    border: 1px solid var(--border-default, #e5e7eb);
    border-radius: var(--radius-sm, 0.25rem);
    background: var(--bg-surface, #fff);
    color: var(--text-primary, inherit);
    font-size: var(--text-sm, 0.875rem);
  }
</style>
