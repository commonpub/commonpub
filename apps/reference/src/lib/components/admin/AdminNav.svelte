<script lang="ts">
  interface NavItem {
    href: string;
    label: string;
  }

  interface Props {
    currentPath: string;
    class?: string;
  }

  let { currentPath, class: className = '' }: Props = $props();

  const items: NavItem[] = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/reports', label: 'Reports' },
    { href: '/admin/settings', label: 'Settings' },
    { href: '/admin/settings/theme', label: 'Theme' },
    { href: '/admin/audit', label: 'Audit Log' },
  ];

  function isActive(href: string): boolean {
    if (href === '/admin') return currentPath === '/admin';
    return currentPath.startsWith(href);
  }
</script>

<nav class={['admin-nav', className].filter(Boolean).join(' ')} aria-label="Admin navigation">
  <ul class="admin-nav__list" role="list">
    {#each items as item (item.href)}
      <li>
        <a
          href={item.href}
          class={['admin-nav__link', isActive(item.href) ? 'admin-nav__link--active' : '']
            .filter(Boolean)
            .join(' ')}
          aria-current={isActive(item.href) ? 'page' : undefined}
        >
          {item.label}
        </a>
      </li>
    {/each}
  </ul>
</nav>

<style>
  .admin-nav__list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .admin-nav__link {
    display: block;
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    color: var(--color-text-secondary, #888884);
    text-decoration: none;
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    letter-spacing: 0.02em;
    border-radius: var(--radius-sm, 4px);
  }

  .admin-nav__link:hover {
    background: var(--color-surface-alt, #141413);
    color: var(--color-text, #d8d5cf);
  }

  .admin-nav__link:focus {
    outline: none;
    border-color: var(--color-accent, #5b9cf6);
  }

  .admin-nav__link--active {
    background: var(--color-surface-alt, #141413);
    color: var(--color-accent, #5b9cf6);
    border-left: 2px solid var(--color-accent, #5b9cf6);
    border-radius: 0;
  }

  .admin-nav__link--active:hover {
    background: var(--color-surface-alt, #141413);
    color: var(--color-accent, #5b9cf6);
  }
</style>
