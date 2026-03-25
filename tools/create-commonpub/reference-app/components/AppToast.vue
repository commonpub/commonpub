<script setup lang="ts">
const { toasts, dismiss } = useToast();
</script>

<template>
  <Teleport to="body">
    <div v-if="toasts.length" class="cpub-toast-container" aria-live="polite">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="cpub-toast"
        :class="`cpub-toast--${toast.type}`"
        role="status"
      >
        <i
          :class="{
            'fa-solid fa-check': toast.type === 'success',
            'fa-solid fa-xmark': toast.type === 'error',
            'fa-solid fa-info': toast.type === 'info',
          }"
          class="cpub-toast-icon"
        />
        <span class="cpub-toast-msg">{{ toast.message }}</span>
        <button class="cpub-toast-close" aria-label="Dismiss" @click="dismiss(toast.id)">
          <i class="fa-solid fa-xmark" />
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cpub-toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.cpub-toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 12px;
  font-family: var(--font-mono);
  box-shadow: 4px 4px 0 var(--border);
  min-width: 240px;
  max-width: 400px;
  animation: cpub-toast-in 0.2s ease-out;
}

@keyframes cpub-toast-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.cpub-toast--success {
  border-color: var(--green);
  background: var(--green-bg);
  color: var(--green);
}

.cpub-toast--error {
  border-color: var(--red);
  background: var(--red-bg);
  color: var(--red);
}

.cpub-toast--info {
  border-color: var(--accent);
  background: var(--accent-bg);
  color: var(--accent);
}

.cpub-toast-icon {
  font-size: 11px;
  flex-shrink: 0;
}

.cpub-toast-msg {
  flex: 1;
  line-height: 1.4;
}

.cpub-toast-close {
  background: none;
  border: none;
  color: inherit;
  opacity: 0.6;
  cursor: pointer;
  font-size: 10px;
  padding: 2px;
  flex-shrink: 0;
}

.cpub-toast-close:hover {
  opacity: 1;
}
</style>
