<script lang="ts">
  let { percentage = 0 }: { percentage: number } = $props();
</script>

<div
  class="progress-bar"
  role="progressbar"
  aria-label="Explainer progress"
  aria-valuenow={percentage}
  aria-valuemin={0}
  aria-valuemax={100}
>
  <div class="progress-bar__fill" style:width="{percentage}%"></div>
</div>

<style>
  .progress-bar {
    position: sticky;
    top: 0;
    z-index: 10;
    height: 4px;
    background: var(--color-border, #272725);
  }

  .progress-bar__fill {
    height: 100%;
    background: var(--color-primary, #2563eb);
    transition: width 0.3s ease;
  }
</style>
