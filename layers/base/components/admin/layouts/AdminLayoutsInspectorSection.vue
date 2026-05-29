<script setup lang="ts">
/**
 * Section-config inspector (Phase 3e). Renders the auto-generated form
 * for the selected section's `config` blob, driven by the section's
 * `configSchema` (Zod) via the `buildAutoForm` engine + the recursive
 * `<AdminLayoutsAutoForm>` renderer.
 *
 * Controlled component: emits `update:config` with a fresh config object
 * on every edit. The editor page replaces `section.config` with it →
 * draft deep-watcher fires → dirty → existing 1.5s auto-save debounce.
 * Single-flight save is untouched (we only mutate `draft`).
 *
 * Validation: the full config is `safeParse`d against the section's Zod
 * schema on every change; issues surface inline per field (keyed by
 * dot-joined path). This is the SOFT guide; the server's
 * `validateSectionConfigs` is the hard gate.
 *
 * Edge states handled (plan §7.15):
 *   - Unregistered section type (layer upgrade removed it) → error card.
 *   - Empty schema (e.g. `stats`) → "no options" note.
 *   - Schema-version drift → advisory banner.
 */
import type { LayoutSectionResolved } from '@commonpub/server';
import { buildAutoForm } from '../../../composables/autoFormSchema';
import { useSectionRegistry } from '../../../sections/registry';

const props = defineProps<{ section: LayoutSectionResolved }>();

const emit = defineEmits<{
  (e: 'update:config', value: Record<string, unknown>): void;
}>();

const registry = useSectionRegistry();

const def = computed(() => registry.get(props.section.type));

const model = computed(() => {
  const d = def.value;
  if (!d) return null;
  return buildAutoForm(d.configSchema);
});

/** Advisory only — the renderer migrates on load; this flags un-saved drift. */
const versionDrift = computed<boolean>(() => {
  const d = def.value;
  return !!d && typeof props.section.schemaVersion === 'number' && props.section.schemaVersion !== d.schemaVersion;
});

/**
 * Inline validation — safeParse the live config, flatten Zod issues into
 * a dot-joined-path → message map the AutoForm looks fields up in.
 */
const errors = computed<Record<string, string>>(() => {
  const d = def.value;
  if (!d) return {};
  const result = d.configSchema.safeParse(props.section.config);
  if (result.success) return {};
  const map: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.map((p) => String(p)).join('.');
    // First issue per path wins (matches FormKit/native single-message UX).
    if (!(key in map)) map[key] = issue.message;
  }
  return map;
});

function onUpdate(value: Record<string, unknown>): void {
  emit('update:config', value);
}
</script>

<template>
  <div class="cpub-inspector-section">
    <header class="cpub-inspector-section-head">
      <i :class="['fa-solid', def?.icon ?? 'fa-puzzle-piece']" aria-hidden="true"></i>
      <div class="cpub-inspector-section-head-text">
        <span class="cpub-inspector-section-name">{{ def?.name ?? section.type }}</span>
        <span class="cpub-inspector-section-type">{{ section.type }}</span>
      </div>
    </header>

    <!-- Unregistered type — the layer dropped this section since save. -->
    <div v-if="!def" class="cpub-inspector-section-unknown" role="alert">
      <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
      <p>
        Unknown section type <code>{{ section.type }}</code>. It may have been
        removed in a layer upgrade. Its config can’t be edited here; remove the
        section or restore the section type.
      </p>
    </div>

    <template v-else>
      <div v-if="versionDrift" class="cpub-inspector-section-drift" role="status">
        <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
        <span>
          This section was authored on schema v{{ section.schemaVersion }};
          the current version is v{{ def!.schemaVersion }}. Save to persist any upgrade.
        </span>
      </div>

      <p v-if="model?.isEmpty" class="cpub-inspector-section-empty">
        This section has no configurable options.
      </p>

      <AdminLayoutsAutoForm
        v-else-if="model"
        :fields="model.fields"
        :model-value="section.config"
        :errors="errors"
        :id-seed="`section-${section.id}`"
        @update:model-value="onUpdate"
      />
    </template>
  </div>
</template>

<style scoped>
.cpub-inspector-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.cpub-inspector-section-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border2);
}
.cpub-inspector-section-head > i { color: var(--accent); font-size: var(--text-base); }
.cpub-inspector-section-head-text { display: flex; flex-direction: column; gap: 1px; }
.cpub-inspector-section-name {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text);
}
.cpub-inspector-section-type {
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--text-faint);
}

.cpub-inspector-section-empty,
.cpub-inspector-section-unknown,
.cpub-inspector-section-drift {
  font-size: var(--text-sm);
  color: var(--text-dim);
  margin: 0;
}
.cpub-inspector-section-empty { color: var(--text-faint); }

.cpub-inspector-section-unknown,
.cpub-inspector-section-drift {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3);
  border: var(--border-width-default) solid var(--border2);
}
.cpub-inspector-section-unknown {
  background: var(--yellow-bg);
  border-color: var(--yellow-border);
}
.cpub-inspector-section-unknown i { color: var(--yellow); margin-top: 2px; }
.cpub-inspector-section-unknown code {
  font-family: var(--font-mono);
  background: var(--surface);
  padding: 0 4px;
}
.cpub-inspector-section-drift i { color: var(--accent); margin-top: 2px; }
.cpub-inspector-section-drift span { font-size: var(--text-xs); }
</style>
