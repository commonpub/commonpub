<script setup lang="ts">
const props = defineProps<{
  /** The AP actor URI to follow (user or Group hub) */
  actorUri: string;
  /** Label for what's being followed */
  label?: string;
}>();

const open = ref(false);
const handle = ref('');
const error = ref('');

function show(): void {
  open.value = true;
  handle.value = '';
  error.value = '';
}

function close(): void {
  open.value = false;
}

function submit(): void {
  error.value = '';
  const input = handle.value.trim().replace(/^@/, '');
  const parts = input.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    error.value = 'Enter a valid handle like @user@instance.social';
    return;
  }
  const domain = parts[1];
  // Standard Mastodon/AP remote interaction endpoint
  const url = `https://${domain}/authorize_interaction?uri=${encodeURIComponent(props.actorUri)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  close();
}

defineExpose({ show });
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="cpub-rfd-overlay" @click.self="close">
      <div class="cpub-rfd-dialog" role="dialog" aria-modal="true">
        <div class="cpub-rfd-header">
          <h3>Follow from your instance</h3>
          <button class="cpub-rfd-close" aria-label="Close" @click="close">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <p class="cpub-rfd-desc">
          Enter your fediverse handle to follow {{ label || 'this account' }} from your instance.
        </p>
        <form class="cpub-rfd-form" @submit.prevent="submit">
          <input
            v-model="handle"
            type="text"
            class="cpub-input"
            placeholder="@you@your-instance.social"
            aria-label="Your fediverse handle"
            autofocus
          />
          <p v-if="error" class="cpub-rfd-error">{{ error }}</p>
          <div class="cpub-rfd-actions">
            <button type="button" class="cpub-btn cpub-btn-sm" @click="close">Cancel</button>
            <button type="submit" class="cpub-btn cpub-btn-primary cpub-btn-sm" :disabled="!handle.trim()">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Follow
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cpub-rfd-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0, 0, 0, 0.5); display: flex;
  align-items: center; justify-content: center;
  padding: 16px;
}
.cpub-rfd-dialog {
  background: var(--bg); border: var(--border-width-default) solid var(--border);
  width: 100%; max-width: 420px; padding: 24px;
  box-shadow: 4px 4px 0 var(--shadow);
}
.cpub-rfd-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.cpub-rfd-header h3 { font-size: 14px; font-weight: 700; margin: 0; }
.cpub-rfd-close {
  background: none; border: none; cursor: pointer;
  color: var(--text-dim); font-size: 14px; padding: 4px;
}
.cpub-rfd-close:hover { color: var(--text); }
.cpub-rfd-desc { font-size: 12px; color: var(--text-dim); line-height: 1.5; margin-bottom: 16px; }
.cpub-rfd-form { display: flex; flex-direction: column; gap: 12px; }
.cpub-rfd-form .cpub-input {
  width: 100%; font-size: 13px; padding: 8px 12px;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface); color: var(--text);
}
.cpub-rfd-error { font-size: 11px; color: var(--red, #ef4444); margin: 0; }
.cpub-rfd-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
