<script lang="ts">
  import type { AuthUser } from '@snaplify/auth';

  let { user = null }: { user: AuthUser | null } = $props();
</script>

<nav class="nav" aria-label="Main navigation">
  <div class="nav-inner">
    <a href="/" class="nav-logo" aria-label="Snaplify home">Snaplify</a>

    <div class="nav-links">
      <a href="/projects">Projects</a>
      <a href="/blog">Blog</a>
      <a href="/articles">Articles</a>
    </div>

    <div class="nav-actions">
      {#if user}
        <a href="/create" class="nav-create">Create</a>
        <a href="/dashboard" class="nav-user" aria-label="Dashboard">
          {#if user.avatarUrl}
            <img src={user.avatarUrl} alt="" class="nav-avatar" width="32" height="32" />
          {:else}
            <span class="nav-avatar-placeholder">{user.displayName?.[0] ?? user.username?.[0] ?? '?'}</span>
          {/if}
        </a>
      {:else}
        <a href="/auth/sign-in">Sign in</a>
        <a href="/auth/sign-up" class="nav-signup">Sign up</a>
      {/if}
    </div>
  </div>
</nav>

<style>
  .nav {
    border-bottom: 1px solid var(--color-border, #e5e5e5);
    background: var(--color-surface, #ffffff);
  }

  .nav-inner {
    display: flex;
    align-items: center;
    gap: var(--space-md, 1rem);
    max-width: var(--layout-max-width, 1200px);
    margin: 0 auto;
    padding: var(--space-sm, 0.5rem) var(--space-md, 1rem);
  }

  .nav-logo {
    font-weight: var(--font-weight-bold, 700);
    font-size: var(--font-size-lg, 1.25rem);
    text-decoration: none;
    color: var(--color-text, #1a1a1a);
  }

  .nav-links {
    display: flex;
    gap: var(--space-sm, 0.5rem);
    margin-left: var(--space-lg, 2rem);
  }

  .nav-links a {
    text-decoration: none;
    color: var(--color-text-secondary, #666);
    padding: var(--space-xs, 0.25rem) var(--space-sm, 0.5rem);
    border-radius: var(--radius-sm, 4px);
  }

  .nav-links a:hover {
    color: var(--color-text, #1a1a1a);
    background: var(--color-surface-hover, #f5f5f5);
  }

  .nav-actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm, 0.5rem);
    margin-left: auto;
  }

  .nav-actions a {
    text-decoration: none;
    color: var(--color-text-secondary, #666);
    padding: var(--space-xs, 0.25rem) var(--space-sm, 0.5rem);
    border-radius: var(--radius-sm, 4px);
  }

  .nav-create {
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff) !important;
    padding: var(--space-xs, 0.25rem) var(--space-md, 1rem) !important;
    border-radius: var(--radius-md, 6px) !important;
  }

  .nav-signup {
    border: 1px solid var(--color-border, #e5e5e5);
    border-radius: var(--radius-md, 6px) !important;
  }

  .nav-avatar {
    border-radius: 50%;
    object-fit: cover;
  }

  .nav-avatar-placeholder {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
    font-weight: var(--font-weight-bold, 700);
    font-size: var(--font-size-sm, 0.875rem);
  }
</style>
