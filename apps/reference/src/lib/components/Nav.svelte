<script lang="ts">
  import type { AuthUser } from '@snaplify/auth';
  import { Button, Avatar } from '@snaplify/ui';
  import { page } from '$app/stores';

  let { user = null }: { user: AuthUser | null } = $props();

  const navLinks = [
    { href: '/projects', label: 'Projects' },
    { href: '/blog', label: 'Blog' },
    { href: '/articles', label: 'Articles' },
    { href: '/explainers', label: 'Explainers' },
    { href: '/learn', label: 'Learn' },
    { href: '/communities', label: 'Communities' },
  ];

  function isActive(href: string): boolean {
    return $page.url.pathname === href || $page.url.pathname.startsWith(href + '/');
  }
</script>

<nav class="nav" aria-label="Main navigation">
  <div class="nav-inner">
    <a href="/" class="nav-logo" aria-label="Home">
      <span class="nav-logo-text">snaplify</span>
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
        <a href="/create">
          <Button variant="primary" size="sm">Create</Button>
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
    background: var(--color-surface, #0c0c0b);
    height: var(--nav-height, 4rem);
  }

  .nav-inner {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    max-width: var(--content-max-width, 75rem);
    margin: 0 auto;
    padding: 0 var(--space-4, 1rem);
    height: 100%;
  }

  .nav-logo {
    text-decoration: none;
    display: flex;
    align-items: center;
    margin-right: var(--space-6, 1.5rem);
  }

  .nav-logo-text {
    font-family: var(--font-mono, monospace);
    font-weight: var(--font-weight-bold, 700);
    font-size: var(--text-md, 1rem);
    color: var(--color-text, #d8d5cf);
    letter-spacing: 0.02em;
  }

  .nav-links {
    display: flex;
    gap: var(--space-1, 0.25rem);
  }

  .nav-link {
    text-decoration: none;
    color: var(--color-text-secondary, #888884);
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border-radius: var(--radius-md, 0.25rem);
    font-size: var(--text-sm, 0.75rem);
    font-family: var(--font-mono, monospace);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: color var(--transition-fast, 0.1s ease), background var(--transition-fast, 0.1s ease);
    display: flex;
    align-items: center;
  }

  .nav-link:hover {
    color: var(--color-text, #d8d5cf);
    background: var(--color-surface-alt, #141413);
  }

  .nav-link-active {
    color: var(--color-text, #d8d5cf);
    background: var(--color-surface-alt, #141413);
    border: 1px solid var(--color-border, #272725);
  }

  .nav-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3, 0.75rem);
    margin-left: auto;
  }

  .nav-actions a {
    text-decoration: none;
  }

  .nav-avatar-link {
    display: flex;
    align-items: center;
  }
</style>
