<script lang="ts">
  let {
    locked = false,
    oncomplete,
  }: {
    locked: boolean;
    oncomplete?: () => void;
  } = $props();

  let completed = $state(false);

  function handleContinue() {
    completed = true;
    oncomplete?.();
  }
</script>

<div class="checkpoint" role="status" aria-live="polite">
  {#if locked}
    <p class="checkpoint__message checkpoint__message--locked">
      Complete all previous sections to continue.
    </p>
    <button class="checkpoint__btn" disabled aria-label="Continue (locked)">Continue</button>
  {:else if completed}
    <p class="checkpoint__message checkpoint__message--done">Checkpoint completed!</p>
  {:else}
    <p class="checkpoint__message">Ready to continue to the next section.</p>
    <button
      class="checkpoint__btn"
      onclick={handleContinue}
      aria-label="Mark checkpoint as complete"
    >
      Continue
    </button>
  {/if}
</div>

<style>
  .checkpoint {
    text-align: center;
    padding: var(--space-12, 3rem);
    border: 2px dashed var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    margin-top: var(--space-4, 1rem);
  }

  .checkpoint__message {
    margin-bottom: var(--space-4, 1rem);
    color: var(--color-text, #d8d5cf);
  }

  .checkpoint__message--locked {
    color: var(--color-text-secondary, #888884);
  }

  .checkpoint__message--done {
    color: var(--color-success, #22c55e);
    font-weight: var(--font-weight-semibold, 600);
  }

  .checkpoint__btn {
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
    border: none;
    padding: var(--space-2, 0.5rem) var(--space-6, 2rem);
    border-radius: var(--radius-md, 6px);
    font-size: var(--text-md, 1rem);
    cursor: pointer;
  }

  .checkpoint__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .checkpoint__btn:focus-visible {
    outline: 2px solid var(--color-primary, #2563eb);
    outline-offset: 2px;
  }
</style>
