<script setup lang="ts">
/**
 * Row-config inspector (Phase 3e). Edits a row's styling config — gap,
 * align, background, vertical padding. Dogfoods the SAME auto-form engine
 * as the section inspector, fed the canonical `layoutRowConfigSchema` from
 * `@commonpub/schema` (the exact schema the server validates row config
 * against — no drift).
 *
 * Controlled: emits `update:config` with a fresh config object. The page
 * replaces `row.config` → draft watcher → dirty → auto-save. Row config is
 * nullable; we present an empty object to the form so a fresh row starts
 * blank, and emit only the keys the admin actually sets.
 */
import type { LayoutRowResolved } from '@commonpub/server';
import { layoutRowConfigSchema } from '@commonpub/schema';
import { buildAutoForm } from '../../../composables/autoFormSchema';

const props = defineProps<{ row: LayoutRowResolved }>();

const emit = defineEmits<{
  (e: 'update:config', value: Record<string, unknown>): void;
}>();

const model = buildAutoForm(layoutRowConfigSchema);

const config = computed<Record<string, unknown>>(() => (props.row.config ?? {}) as Record<string, unknown>);

const errors = computed<Record<string, string>>(() => {
  const result = layoutRowConfigSchema.safeParse(config.value);
  if (result.success) return {};
  const map: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.map((p) => String(p)).join('.');
    if (!(key in map)) map[key] = issue.message;
  }
  return map;
});

function onUpdate(value: Record<string, unknown>): void {
  emit('update:config', value);
}
</script>

<template>
  <div class="cpub-inspector-row">
    <header class="cpub-inspector-row-head">
      <i class="fa-solid fa-grip-lines" aria-hidden="true"></i>
      <span class="cpub-inspector-row-name">Row</span>
    </header>

    <AdminLayoutsAutoForm
      :fields="model.fields"
      :model-value="config"
      :errors="errors"
      :id-seed="`row-${row.id}`"
      @update:model-value="onUpdate"
    />
  </div>
</template>

<style scoped>
.cpub-inspector-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.cpub-inspector-row-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border2);
}
.cpub-inspector-row-head > i { color: var(--accent); font-size: var(--text-base); }
.cpub-inspector-row-name {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text);
}
</style>
