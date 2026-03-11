<script lang="ts">
  import type { AuthUser } from '@snaplify/auth';
  import { Avatar } from '@snaplify/ui';
  import { page } from '$app/stores';

  let { user = null }: { user: AuthUser | null } = $props();
  let createOpen = $state(false);

  const navLinks = [
    { href: '/projects', label: 'Projects' },
    { href: '/guides', label: 'Guides' },
    { href: '/explainers', label: 'Explainers' },
    { href: '/learn', label: 'Learn' },
    { href: '/communities', label: 'Communities' },
    { href: '/magazine', label: 'Magazine' },
  ];

  const createLinks = [
    { href: '/create/project', label: 'Project' },
    { href: '/create/article', label: 'Article' },
    { href: '/create/guide', label: 'Guide' },
    { href: '/create/blog', label: 'Blog Post' },
    { href: '/create/explainer', label: 'Explainer' },
    { href: '/create/path', label: 'Learning Path' },
  ];

  function isActive(href: string): boolean {
    return $page.url.pathname === href || $page.url.pathname.startsWith(href + '/');
  }
</script>

<nav class="nav" aria-label="Main navigation">
  <div class="nav-inner">
    <a href="/" class="nav-logo" aria-label="Home">
      <span class="nav-logo-text">[instance]</span>
      <small class="nav-logo-sub">powered by snaplify</small>
    </a>

    <div class="nav-links">
      {#each navLinks as link}
        <a
          href={link.href}
          class="nav-link"
          class:nav-link-active={isActive(link.href)}
          aria-current={isActive(link.href) ? 'page' : undefined}
        >
          {link.label}
        </a>
      {/each}
    </div>

    <div class="nav-actions">
      <a href="/search" class="nav-link" aria-label="Search">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M11 11L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </a>
      {#if user}
        <div class="nav-create-wrap">
          <button
            class="btn btn-primary btn-sm"
            onclick={() => createOpen = !createOpen}
            aria-expanded={createOpen}
            aria-haspopup="true"
          >
            + Create
          </button>
          {#if createOpen}
            <div class="nav-create-dropdown" role="menu">
              {#each createLinks as link}
                <a href={link.href} class="nav-create-item" role="menuitem" onclick={() => createOpen = false}>
                  {link.label}
                </a>
              {/each}
            </div>
          {/if}
        </div>
        <a href="/feed" class="nav-link" aria-label="Feed">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" fill="currentColor"/>
            <path d="M2 8a5 5 0 0 1 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M2 4a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </a>
        <a href="/dashboard" class="nav-avatar-link" aria-label="Dashboard">
          <Avatar
            src={user.avatarUrl ?? undefined}
            alt={user.displayName ?? user.username ?? ''}
            name={user.displayName ?? user.username ?? '?'}
            size="sm"
          />
        </a>
      {:else}
        <a href="/auth/sign-in" class="nav-link">Sign in</a>
      {/if}
    </div>
  </div>
</nav>

<style>
  .nav {
    position: sticky;
    top: 0;
    z-index: var(--z-sticky, 200);
    border-bottom: 1px solid var(--color-border, #272725);
    background: var(--color-surface-alt, #141413);
    height: var(--nav-height, 48px);
  }

  .nav-inner {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    padding: 0 32px;
    height: 100%;
  }

  .nav-logo {
    text-decoration: none;
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin-right: var(--space-6, 1.5rem);
  }

  .nav-logo-text {
    font-family: var(--font-mono, monospace);
    font-weight: var(--font-weight-bold, 700);
    font-size: 14px;
    color: var(--color-text, #d8d5cf);
    letter-spacing: -0.01em;
  }

  .nav-logo-sub {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--color-text-secondary, #888884);
    font-weight: 400;
  }

  .nav-links {
    display: flex;
    gap: 4px;
  }

  .nav-link {
    text-decoration: none;
    color: var(--color-text-secondary, #888884);
    padding: 4px 10px;
    border-radius: var(--radius-md, 0.25rem);
    font-size: 12px;
    cursor: pointer;
    border: 1px solid transparent;
    background: none;
    transition: color var(--transition-fast, 0.1s ease), background var(--transition-fast, 0.1s ease);
    display: flex;
    align-items: center;
  }

  .nav-link:hover {
    color: var(--color-text, #d8d5cf);
    background: var(--color-surface-raised, #1c1c1a);
  }

  .nav-link-active {
    color: var(--color-text, #d8d5cf);
    background: var(--color-surface-raised, #1c1c1a);
    border-color: var(--color-border, #272725);
  }

  .nav-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    margin-left: auto;
  }

  .nav-actions a {
    text-decoration: none;
  }

  .nav-avatar-link {
    display: flex;
    align-items: center;
  }

  .nav-create-wrap {
    position: relative;
  }

  .nav-create-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: var(--color-surface-alt, #141413);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 0.25rem);
    min-width: 160px;
    z-index: var(--z-dropdown, 100);
    padding: 4px 0;
  }

  .nav-create-item {
    display: block;
    padding: 8px 14px;
    font-size: 12px;
    color: var(--color-text-secondary, #888884);
    text-decoration: none;
    font-family: var(--font-mono, monospace);
  }

  .nav-create-item:hover {
    color: var(--color-text);
    background: var(--color-surface-raised, #1c1c1a);
  }

  @media (max-width: 768px) {
    .nav-links { display: none; }
    .nav-inner { padding: 0 16px; }
  }
</style>
