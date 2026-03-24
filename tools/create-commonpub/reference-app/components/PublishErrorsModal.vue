<script setup lang="ts">
/**
 * Modal showing publish validation errors.
 * Displayed when the user tries to publish content that's missing required fields.
 */
defineProps<{
  errors: string[];
  show: boolean;
}>();

const emit = defineEmits<{
  dismiss: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="cpub-publish-errors-overlay" @click.self="emit('dismiss')">
      <div class="cpub-publish-errors-card" role="alertdialog" aria-labelledby="publish-errors-title">
        <h3 id="publish-errors-title" class="cpub-publish-errors-title">
          <i class="fa-solid fa-circle-exclamation" /> Not ready to publish
        </h3>
        <p class="cpub-publish-errors-subtitle">Please fix the following before publishing:</p>
        <ul class="cpub-publish-errors-list">
          <li v-for="(err, i) in errors" :key="i">{{ err }}</li>
        </ul>
        <button class="cpub-publish-errors-btn" @click="emit('dismiss')" autofocus>Got it</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cpub-publish-errors-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.cpub-publish-errors-card {
  background: var(--surface);
  border: 2px solid var(--border);
  padding: 28px;
  max-width: 420px;
  width: 100%;
  box-shadow: 8px 8px 0 var(--border);
}

.cpub-publish-errors-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--red);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.cpub-publish-errors-subtitle {
  font-size: 0.875rem;
  color: var(--text-dim);
  margin-bottom: 16px;
}

.cpub-publish-errors-list {
  list-style: none;
  padding: 0;
  margin: 0 0 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cpub-publish-errors-list li {
  font-size: 0.8125rem;
  color: var(--text);
  padding: 8px 12px;
  background: var(--red-bg);
  border: 1px solid var(--red-border, var(--red));
  display: flex;
  align-items: center;
  gap: 8px;
}
.cpub-publish-errors-list li::before {
  content: '•';
  color: var(--red);
  font-weight: 700;
}

.cpub-publish-errors-btn {
  padding: 8px 20px;
  background: var(--surface);
  border: 2px solid var(--border);
  color: var(--text);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 4px 4px 0 var(--border);
  transition: box-shadow 0.1s;
}
.cpub-publish-errors-btn:hover { box-shadow: 2px 2px 0 var(--border); }
</style>
