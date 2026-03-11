<script lang="ts">
  import type { NavItem, VersionInfo } from '@snaplify/docs';

  let {
    nav = [],
    activePath = '',
    versions = [],
    currentVersion = '',
    siteSlug,
    class: className = '',
  }: {
    nav: NavItem[];
    activePath?: string;
    versions?: VersionInfo[];
    currentVersion?: string;
    siteSlug: string;
    class?: string;
  } = $props();
</script>

<aside class="docs-sidebar {className}" aria-label="Documentation navigation">
  {#if versions.length > 1}
    <div class="docs-sidebar-versions">
      <label for="docs-version-select" class="docs-sidebar-label">Version</label>
      <select
        id="docs-version-select"
        class="docs-sidebar-select"
        aria-label="Select documentation version"
        onchange={(e) => {
          const target = e.currentTarget;
          if (target.value) {
            window.location.href = `/docs/${siteSlug}?v=${target.value}`;
          }
        }}
      >
        {#each versions as version}
          <option value={version.version} selected={version.version === currentVersion}>
            {version.version}{version.isDefault ? ' (default)' : ''}
          </option>
        {/each}
      </select>
    </div>
  {/if}

  <nav aria-label="Documentation pages">
    <ul class="docs-sidebar-list" role="tree">
      {#each nav as item}
        <li
          class="docs-sidebar-item"
          role="treeitem"
          aria-expanded={item.children && item.children.length > 0 ? true : undefined}
        >
          {#if item.pageId}
            <a
              href="/docs/{siteSlug}/{item.pageId}"
              class="docs-sidebar-link"
              class:active={activePath === item.pageId}
              aria-current={activePath === item.pageId ? 'page' : undefined}
            >
              {item.title}
            </a>
          {:else}
            <span class="docs-sidebar-group">{item.title}</span>
          {/if}

          {#if item.children && item.children.length > 0}
            <ul class="docs-sidebar-children" role="group">
              {#each item.children as child}
                <li class="docs-sidebar-item" role="treeitem">
                  {#if child.pageId}
                    <a
                      href="/docs/{siteSlug}/{child.pageId}"
                      class="docs-sidebar-link docs-sidebar-link-child"
                      class:active={activePath === child.pageId}
                      aria-current={activePath === child.pageId ? 'page' : undefined}
                    >
                      {child.title}
                    </a>
                  {:else}
                    <span class="docs-sidebar-group">{child.title}</span>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  </nav>
</aside>

<style>
  .docs-sidebar {
    width: var(--sidebar-width, 16rem);
    flex-shrink: 0;
    padding: var(--space-4, 1rem);
    border-right: 1px solid var(--border-default, #e5e7eb);
  }

  .docs-sidebar-versions {
    margin-bottom: var(--space-4, 1rem);
  }

  .docs-sidebar-label {
    display: block;
    font-size: var(--text-xs, 0.75rem);
    font-weight: var(--font-semibold, 600);
    color: var(--text-muted, inherit);
    margin-bottom: var(--space-1, 0.25rem);
  }

  .docs-sidebar-select {
    width: 100%;
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    border: 1px solid var(--border-default, #e5e7eb);
    border-radius: var(--radius-sm, 0.25rem);
    background: var(--bg-surface, #fff);
    color: var(--text-primary, inherit);
    font-size: var(--text-sm, 0.875rem);
  }

  .docs-sidebar-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .docs-sidebar-item {
    margin-bottom: var(--space-1, 0.25rem);
  }

  .docs-sidebar-link {
    display: block;
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    font-size: var(--text-sm, 0.875rem);
    color: var(--text-secondary, inherit);
    text-decoration: none;
    border-radius: var(--radius-sm, 0.25rem);
  }

  .docs-sidebar-link:hover {
    background: var(--bg-hover, #f3f4f6);
    color: var(--text-primary, inherit);
  }

  .docs-sidebar-link.active {
    background: var(--bg-active, #e5e7eb);
    color: var(--text-primary, inherit);
    font-weight: var(--font-weight-medium, 500);
  }

  .docs-sidebar-group {
    display: block;
    padding: var(--space-2, 0.5rem) var(--space-2, 0.5rem);
    font-size: var(--text-xs, 0.75rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--text-muted, inherit);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .docs-sidebar-children {
    list-style: none;
    padding: 0;
    padding-left: var(--space-3, 0.75rem);
    margin: 0;
  }

  .docs-sidebar-link-child {
    font-size: var(--text-sm, 0.875rem);
  }
</style>
