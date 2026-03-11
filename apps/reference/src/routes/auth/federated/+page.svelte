<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();
</script>

<svelte:head>
  <title>Federated Login — {data.instanceName}</title>
</svelte:head>

<main class="federated-login">
  <h1>Federated Login</h1>
  <p>Sign in with your account from another Snaplify instance.</p>

  <form method="POST" use:enhance>
    <label for="identifier">Your federated identity</label>
    <input
      id="identifier"
      name="identifier"
      type="text"
      placeholder="user@instance.example.com"
      required
      aria-describedby="identifier-help"
    />
    <small id="identifier-help">
      Enter your username and instance domain, e.g. alice@makers.example.com
    </small>

    {#if form?.error}
      <p class="error" role="alert">{form.error}</p>
    {/if}

    <button type="submit">Sign in with remote instance</button>
  </form>
</main>

<style>
  .federated-login {
    max-width: 28rem;
    margin: 2rem auto;
    padding: var(--space-4, 1rem);
  }

  h1 {
    font-size: var(--text-xl, 1.25rem);
    font-weight: var(--font-weight-bold, 700);
    margin-bottom: var(--space-2, 0.5rem);
  }

  p {
    color: var(--color-text-secondary, #888884);
    margin-bottom: var(--space-4, 1rem);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
  }

  label {
    font-weight: var(--font-weight-medium, 500);
  }

  input {
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border: 1px solid var(--color-border, #ccc);
    border-radius: var(--radius-md, 0.375rem);
    font-size: var(--text-base, 1rem);
    background: var(--color-bg-input, #fff);
    color: var(--color-text, #111);
  }

  input:focus {
    outline: 2px solid var(--color-focus, #0066cc);
    outline-offset: 2px;
  }

  small {
    color: var(--color-text-tertiary, #444440);
  }

  .error {
    color: var(--color-error, #c00);
    font-size: var(--text-sm, 0.875rem);
  }

  button {
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    background: var(--color-primary, #0066cc);
    color: var(--color-text-on-primary, #fff);
    border: none;
    border-radius: var(--radius-md, 0.375rem);
    font-weight: var(--font-weight-medium, 500);
    cursor: pointer;
  }

  button:hover {
    background: var(--color-primary-hover, #0055aa);
  }

  button:focus-visible {
    outline: 2px solid var(--color-focus, #0066cc);
    outline-offset: 2px;
  }
</style>
