<script setup lang="ts">
/**
 * Compact Markdown / HTML segmented toggle for a single rich-text field.
 * Used inline beside a field label so each field's render mode is set
 * independently. `html` mode renders the author's raw HTML (script-free).
 */
const model = defineModel<'markdown' | 'html'>({ default: 'markdown' });
</script>

<template>
  <div class="cpub-fmt-toggle" role="group" aria-label="Field format">
    <button
      type="button"
      class="cpub-fmt-opt"
      :class="{ 'cpub-fmt-active': model === 'markdown' }"
      :aria-pressed="model === 'markdown'"
      @click="model = 'markdown'"
    >Markdown</button>
    <button
      type="button"
      class="cpub-fmt-opt"
      :class="{ 'cpub-fmt-active': model === 'html' }"
      :aria-pressed="model === 'html'"
      @click="model = 'html'"
    >HTML</button>
  </div>
</template>

<style scoped>
.cpub-fmt-toggle {
  display: inline-flex;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface2);
}
.cpub-fmt-opt {
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 3px 10px;
  background: transparent;
  color: var(--text-faint);
  border: none;
  cursor: pointer;
}
.cpub-fmt-opt + .cpub-fmt-opt {
  border-left: var(--border-width-default) solid var(--border);
}
.cpub-fmt-active {
  background: var(--accent);
  color: var(--color-on-accent);
}
.cpub-fmt-opt:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
</style>
