<script lang="ts">
  import { enhance } from '$app/forms';

  let {
    slug,
    userId,
    oncancel,
  }: {
    slug: string;
    userId: string;
    oncancel: () => void;
  } = $props();
</script>

<form method="POST" action="/communities/{slug}/settings?/ban" use:enhance class="ban-form">
  <input type="hidden" name="userId" value={userId} />

  <div class="form-field">
    <label for="ban-reason-{userId}">Reason (optional)</label>
    <input
      type="text"
      id="ban-reason-{userId}"
      name="reason"
      placeholder="Reason for ban..."
      maxlength="2000"
    />
  </div>

  <div class="form-field">
    <label for="ban-expiry-{userId}">Expires (optional)</label>
    <input type="datetime-local" id="ban-expiry-{userId}" name="expiresAt" />
  </div>

  <div class="form-actions">
    <button type="submit" class="btn btn-danger">Ban User</button>
    <button type="button" class="btn btn-secondary" onclick={oncancel}>Cancel</button>
  </div>
</form>

<style>
  .ban-form {
    padding: var(--space-4, 1rem);
    border: 1px solid var(--color-error, #dc2626);
    border-radius: var(--radius-md, 6px);
    background: var(--color-error-bg, #fef2f2);
    margin: var(--space-2, 0.5rem) 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
  }

  .form-field label {
    font-size: var(--text-sm, 0.875rem);
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #d8d5cf);
  }

  .form-field input {
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    font-size: var(--text-sm, 0.875rem);
    background: var(--color-surface, #0c0c0b);
    color: var(--color-text, #d8d5cf);
  }

  .form-actions {
    display: flex;
    gap: var(--space-2, 0.5rem);
  }

  .btn {
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    border: none;
    border-radius: var(--radius-sm, 4px);
    font-size: var(--text-sm, 0.875rem);
    cursor: pointer;
  }

  .btn-danger {
    background: var(--color-error, #dc2626);
    color: var(--color-on-primary, #ffffff);
  }

  .btn-secondary {
    background: var(--color-surface-alt, #1c1c1a);
    color: var(--color-text, #d8d5cf);
    border: 1px solid var(--color-border, #272725);
  }
</style>
