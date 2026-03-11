<script lang="ts">
  let email = $state('');
  let username = $state('');
  let password = $state('');
  let displayName = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleSignUp(e: SubmitEvent) {
    e.preventDefault();
    loading = true;
    error = '';

    try {
      const res = await fetch('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          username,
          name: displayName || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        error = data.message ?? 'Registration failed. Please try again.';
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
  <title>Sign Up — Snaplify</title>
</svelte:head>

<div class="auth-page">
  <div class="auth-card">
    <h1>Create Account</h1>

    {#if error}
      <div class="auth-error" role="alert">{error}</div>
    {/if}

    <form onsubmit={handleSignUp}>
      <div class="form-field">
        <label for="email">Email</label>
        <input id="email" type="email" bind:value={email} required autocomplete="email" />
      </div>

      <div class="form-field">
        <label for="username">Username</label>
        <input
          id="username"
          type="text"
          bind:value={username}
          required
          minlength="3"
          maxlength="64"
          pattern="[a-zA-Z0-9_\-]+"
          autocomplete="username"
        />
      </div>

      <div class="form-field">
        <label for="displayName">Display Name <span class="optional">(optional)</span></label>
        <input id="displayName" type="text" bind:value={displayName} maxlength="128" />
      </div>

      <div class="form-field">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          minlength="8"
          autocomplete="new-password"
        />
      </div>

      <button type="submit" class="auth-submit" disabled={loading}>
        {loading ? 'Creating account...' : 'Sign Up'}
      </button>
    </form>

    <p class="auth-switch">
      Already have an account? <a href="/auth/sign-in">Sign in</a>
    </p>
  </div>
</div>

<style>
  .auth-page {
    display: flex;
    justify-content: center;
    padding: var(--space-12, 3rem) var(--space-4, 1rem);
  }

  .auth-card {
    width: 100%;
    max-width: 400px;
  }

  .auth-card h1 {
    font-size: var(--text-xl, 1.5rem);
    margin-bottom: var(--space-6, 2rem);
  }

  .auth-error {
    padding: var(--space-2, 0.5rem);
    margin-bottom: var(--space-4, 1rem);
    background: var(--color-error-bg, #fef2f2);
    color: var(--color-error, #dc2626);
    border-radius: var(--radius-sm, 4px);
    font-size: var(--text-sm, 0.875rem);
  }

  .form-field {
    margin-bottom: var(--space-4, 1rem);
  }

  .form-field label {
    display: block;
    margin-bottom: var(--space-1, 0.25rem);
    font-size: var(--text-sm, 0.875rem);
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #d8d5cf);
  }

  .optional {
    font-weight: var(--font-weight-normal, 400);
    color: var(--color-text-secondary, #888884);
  }

  .form-field input {
    width: 100%;
    padding: var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    font-size: var(--text-md, 1rem);
    background: var(--color-surface, #0c0c0b);
    color: var(--color-text, #d8d5cf);
    box-sizing: border-box;
  }

  .auth-submit {
    width: 100%;
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
    border: none;
    border-radius: var(--radius-md, 6px);
    font-size: var(--text-md, 1rem);
    cursor: pointer;
    margin-top: var(--space-2, 0.5rem);
  }

  .auth-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .auth-switch {
    text-align: center;
    margin-top: var(--space-4, 1rem);
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-secondary, #888884);
  }

  .auth-switch a {
    color: var(--color-primary, #2563eb);
    text-decoration: none;
  }
</style>
