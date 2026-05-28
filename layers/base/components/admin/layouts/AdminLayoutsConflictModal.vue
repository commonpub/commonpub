<script setup lang="ts">
/**
 * Conflict resolution modal — appears when the server returns 409
 * on a save (another admin edited the layout in the same window).
 *
 * Phase 3a.6 ships two options:
 *   - "Refresh" — re-fetch from server; LOCAL CHANGES LOST
 *   - "Force save" — re-send PUT without If-Match (overwrites)
 *
 * A real diff view (showing what changed on the server side) is
 * deferred to Phase 7 (versioning UI). For v1 the operator-quality
 * choice (read-current vs force-overwrite) is enough — both paths
 * surface the conflict + give the admin agency.
 */

defineProps<{
  /** Show/hide the modal. */
  open: boolean;
  /** Optional error message from the server. */
  message?: string | null;
}>();

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'force-save'): void;
  (e: 'close'): void;
}>();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="cpub-admin-layouts-conflict-backdrop"
      role="presentation"
      @click.self="emit('close')"
    >
      <div
        class="cpub-admin-layouts-conflict-modal"
        role="alertdialog"
        aria-labelledby="cpub-admin-layouts-conflict-title"
        aria-describedby="cpub-admin-layouts-conflict-body"
      >
        <header class="cpub-admin-layouts-conflict-header">
          <i class="fa-solid fa-triangle-exclamation cpub-admin-layouts-conflict-icon"></i>
          <h2 id="cpub-admin-layouts-conflict-title" class="cpub-admin-layouts-conflict-title">
            Conflict
          </h2>
        </header>
        <div id="cpub-admin-layouts-conflict-body" class="cpub-admin-layouts-conflict-body">
          <p>{{ message ?? 'Another admin edited this layout while you were working.' }}</p>
          <p class="cpub-admin-layouts-conflict-body-hint">
            <strong>Refresh</strong> pulls the latest from the server and discards your changes.
            <strong>Force save</strong> overwrites the server with your draft. Choose carefully.
          </p>
        </div>
        <footer class="cpub-admin-layouts-conflict-footer">
          <button
            type="button"
            class="cpub-admin-layouts-conflict-btn"
            @click="emit('refresh')"
          >
            <i class="fa-solid fa-arrows-rotate"></i>
            <span>Refresh — lose my changes</span>
          </button>
          <button
            type="button"
            class="cpub-admin-layouts-conflict-btn cpub-admin-layouts-conflict-btn--danger"
            @click="emit('force-save')"
          >
            <i class="fa-solid fa-cloud-arrow-up"></i>
            <span>Force save — overwrite server</span>
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cpub-admin-layouts-conflict-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.cpub-admin-layouts-conflict-modal {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-lg);
  max-width: 480px;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.cpub-admin-layouts-conflict-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border-bottom: 1px solid var(--border2);
}
.cpub-admin-layouts-conflict-icon {
  font-size: var(--text-xl);
  color: var(--red);
}
.cpub-admin-layouts-conflict-title {
  font-size: var(--text-lg);
  font-weight: var(--font-weight-bold);
  margin: 0;
}

.cpub-admin-layouts-conflict-body {
  padding: var(--space-4);
  color: var(--text);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.cpub-admin-layouts-conflict-body-hint {
  font-size: var(--text-sm);
  color: var(--text-dim);
  margin: 0;
}
.cpub-admin-layouts-conflict-body p { margin: 0; }

.cpub-admin-layouts-conflict-footer {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-4);
  border-top: 1px solid var(--border2);
  justify-content: flex-end;
  flex-wrap: wrap;
}

.cpub-admin-layouts-conflict-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  cursor: pointer;
}
.cpub-admin-layouts-conflict-btn:hover { background: var(--surface2); }
.cpub-admin-layouts-conflict-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cpub-admin-layouts-conflict-btn--danger {
  color: var(--red);
  border-color: var(--red);
}
.cpub-admin-layouts-conflict-btn--danger:hover { background: var(--red); color: var(--surface); }
</style>
