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
  .admin-nav {
    font-family: var(--font-body, sans-serif);
  }

  .admin-nav__list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
  }

  .admin-nav__link {
    display: block;
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    color: var(--color-text-secondary, #555);
    text-decoration: none;
    font-size: var(--text-sm, 0.75rem);
    font-weight: var(--font-weight-medium, 500);
    border-radius: var(--radius-md, 0.25rem);
    transition: background var(--transition-fast, 0.1s ease);
  }

  .admin-nav__link:hover {
    background: var(--color-surface-alt, #f8f9fa);
    color: var(--color-text, #d8d5cf);
  }

  .admin-nav__link:focus {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .admin-nav__link--active {
    background: var(--color-primary, #3b82f6);
    color: var(--color-primary-text, #fff);
  }

  .admin-nav__link--active:hover {
    background: var(--color-primary-hover, #2563eb);
    color: var(--color-primary-text, #fff);
  }
</style>
