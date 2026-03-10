<script lang="ts">
  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleSignIn(e: SubmitEvent) {
    e.preventDefault();
    loading = true;
    error = '';

    try {
      const res = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        error = data.message ?? 'Invalid email or password';
        return;
      }

      window.location.href = '/dashboard';
    } catch {
      error = 'An error occurred. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Sign In — Snaplify</title>
</svelte:head>

<div class="auth-page">
  <div class="auth-card">
    <h1>Sign In</h1>

    {#if error}
      <div class="auth-error" role="alert">{error}</div>
    {/if}

    <form onsubmit={handleSignIn}>
      <div class="form-field">
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          required
          autocomplete="email"
        />
      </div>

      <div class="form-field">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          autocomplete="current-password"
        />
      </div>

      <button type="submit" class="auth-submit" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>

    <p class="auth-switch">
      Don't have an account? <a href="/auth/sign-up">Sign up</a>
    </p>
  </div>
</div>

<style>
  .auth-page {
    display: flex;
    justify-content: center;
    padding: var(--space-xl, 3rem) var(--space-md, 1rem);
  }

  .auth-card {
    width: 100%;
    max-width: 400px;
  }

  .auth-card h1 {
    font-size: var(--font-size-xl, 1.5rem);
    margin-bottom: var(--space-lg, 2rem);
  }

  .auth-error {
    padding: var(--space-sm, 0.5rem);
    margin-bottom: var(--space-md, 1rem);
    background: var(--color-error-bg, #fef2f2);
    color: var(--color-error, #dc2626);
    border-radius: var(--radius-sm, 4px);
    font-size: var(--font-size-sm, 0.875rem);
  }

  .form-field {
    margin-bottom: var(--space-md, 1rem);
  }

  .form-field label {
    display: block;
    margin-bottom: var(--space-xs, 0.25rem);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #1a1a1a);
  }

  .form-field input {
    width: 100%;
    padding: var(--space-sm, 0.5rem);
    border: 1px solid var(--color-border, #e5e5e5);
    border-radius: var(--radius-sm, 4px);
    font-size: var(--font-size-md, 1rem);
    background: var(--color-surface, #ffffff);
    color: var(--color-text, #1a1a1a);
    box-sizing: border-box;
  }

  .auth-submit {
    width: 100%;
    padding: var(--space-sm, 0.5rem) var(--space-md, 1rem);
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
    border: none;
    border-radius: var(--radius-md, 6px);
    font-size: var(--font-size-md, 1rem);
    cursor: pointer;
    margin-top: var(--space-sm, 0.5rem);
  }

  .auth-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .auth-switch {
    text-align: center;
    margin-top: var(--space-md, 1rem);
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--color-text-secondary, #666);
  }

  .auth-switch a {
    color: var(--color-primary, #2563eb);
    text-decoration: none;
  }
</style>
