<script setup lang="ts">
/**
 * Page-meta inspector form (Phase 3a.4).
 *
 * Fields: name (layout-table column) + title + description + ogImage +
 * ogType + access + frame + noindex. Hardcoded for v1 — Phase 3e
 * replaces this with a Zod-driven auto-form (FormKit). Until then,
 * the explicit form gives admins immediate control over the meta
 * tags + frame without depending on the form-generator work.
 *
 * Emits `update:page-meta` + `update:name` so the editor page can
 * mutate the draft (auto-save 3a.6 watches for dirty + persists).
 * No internal state — fully controlled component.
 */
import type { LayoutRecord } from '@commonpub/server';

const props = defineProps<{ draft: LayoutRecord }>();

const emit = defineEmits<{
  (e: 'update:page-meta', value: LayoutRecord['pageMeta']): void;
  (e: 'update:name', value: string): void;
}>();

// Local controlled values mirror the draft. Edits emit upward; the
// editor page mutates the draft ref; reactivity flows back here on
// next tick. No local state to keep in sync.
const name = computed<string>({
  get: () => props.draft.name,
  set: (v) => emit('update:name', v),
});

// Helper: build a patched pageMeta object preserving other fields.
// Title is required by the schema — never delete it; empty-string instead.
function patch<K extends keyof NonNullable<LayoutRecord['pageMeta']>>(
  key: K,
  value: NonNullable<LayoutRecord['pageMeta']>[K] | undefined,
): void {
  type PM = NonNullable<LayoutRecord['pageMeta']>;
  const current: PM = props.draft.pageMeta ?? { title: '' };
  const next: PM = { ...current };
  if (value === undefined || value === '') {
    if (key === 'title') {
      next.title = '';
    } else {
      delete next[key];
    }
  } else {
    next[key] = value;
  }
  emit('update:page-meta', next);
}

const title = computed<string>({
  get: () => props.draft.pageMeta?.title ?? '',
  set: (v) => patch('title', v),
});
const description = computed<string>({
  get: () => props.draft.pageMeta?.description ?? '',
  set: (v) => patch('description', v || undefined),
});
const ogImage = computed<string>({
  get: () => props.draft.pageMeta?.ogImage ?? '',
  set: (v) => patch('ogImage', v || undefined),
});
const ogType = computed<'website' | 'article' | 'profile'>({
  get: () => (props.draft.pageMeta?.ogType as 'website' | 'article' | 'profile') ?? 'website',
  set: (v) => patch('ogType', v),
});
const access = computed<'public' | 'members' | 'admin'>({
  get: () => (props.draft.pageMeta?.access as 'public' | 'members' | 'admin') ?? 'public',
  set: (v) => patch('access', v),
});
const frame = computed<'narrow' | 'wide' | 'two-column' | 'three-column' | 'sidebar-left' | 'sidebar-right'>({
  get: () => (props.draft.pageMeta?.frame as 'narrow' | 'wide' | 'two-column' | 'three-column' | 'sidebar-left' | 'sidebar-right') ?? 'wide',
  set: (v) => patch('frame', v),
});
const noindex = computed<boolean>({
  get: () => props.draft.pageMeta?.noindex ?? false,
  set: (v) => patch('noindex', v || undefined),
});

const id = (suffix: string): string => `cpub-inspector-page-${suffix}`;
</script>

<template>
  <form
    class="cpub-inspector-page-form"
    @submit.prevent
    aria-label="Page meta editor"
  >
    <div class="cpub-inspector-page-field">
      <label :for="id('name')">Layout name</label>
      <input
        :id="id('name')"
        v-model="name"
        type="text"
        autocomplete="off"
        :aria-describedby="id('name-hint')"
      />
      <p :id="id('name-hint')" class="cpub-inspector-page-hint">
        Internal label shown in the layouts list. Not user-facing.
      </p>
    </div>

    <div class="cpub-inspector-page-field">
      <label :for="id('title')">Page title</label>
      <input
        :id="id('title')"
        v-model="title"
        type="text"
        autocomplete="off"
        :aria-describedby="id('title-hint')"
      />
      <p :id="id('title-hint')" class="cpub-inspector-page-hint">
        Browser tab + Open Graph title. Required.
      </p>
    </div>

    <div class="cpub-inspector-page-field">
      <label :for="id('description')">Description</label>
      <textarea
        :id="id('description')"
        v-model="description"
        rows="3"
      ></textarea>
      <p class="cpub-inspector-page-hint">
        Meta description + Open Graph description.
      </p>
    </div>

    <div class="cpub-inspector-page-field">
      <label :for="id('ogImage')">OG image URL</label>
      <input
        :id="id('ogImage')"
        v-model="ogImage"
        type="url"
        autocomplete="off"
        placeholder="https://…"
      />
    </div>

    <div class="cpub-inspector-page-field-grid">
      <div class="cpub-inspector-page-field">
        <label :for="id('ogType')">OG type</label>
        <select :id="id('ogType')" v-model="ogType">
          <option value="website">website</option>
          <option value="article">article</option>
          <option value="profile">profile</option>
        </select>
      </div>

      <div class="cpub-inspector-page-field">
        <label :for="id('access')">Access</label>
        <select :id="id('access')" v-model="access">
          <option value="public">public</option>
          <option value="members">members</option>
          <option value="admin">admin</option>
        </select>
      </div>
    </div>

    <div class="cpub-inspector-page-field">
      <label :for="id('frame')">Frame</label>
      <select :id="id('frame')" v-model="frame">
        <option value="narrow">narrow</option>
        <option value="wide">wide</option>
        <option value="two-column">two-column</option>
        <option value="three-column">three-column</option>
        <option value="sidebar-left">sidebar-left</option>
        <option value="sidebar-right">sidebar-right</option>
      </select>
      <p class="cpub-inspector-page-hint">
        Page chrome shape — drives the zones the layout exposes.
      </p>
    </div>

    <div class="cpub-inspector-page-checkbox">
      <input
        :id="id('noindex')"
        v-model="noindex"
        type="checkbox"
      />
      <label :for="id('noindex')">noindex (hide from search engines)</label>
    </div>
  </form>
</template>

<style scoped>
.cpub-inspector-page-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.cpub-inspector-page-field { display: flex; flex-direction: column; gap: var(--space-1); }
.cpub-inspector-page-field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.cpub-inspector-page-field label {
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--text-dim);
  font-weight: var(--font-weight-semibold);
}

.cpub-inspector-page-field input,
.cpub-inspector-page-field textarea,
.cpub-inspector-page-field select {
  padding: var(--space-2) var(--space-3);
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  color: var(--text);
  font-family: var(--font-body);
  font-size: var(--text-sm);
}
.cpub-inspector-page-field input:focus-visible,
.cpub-inspector-page-field textarea:focus-visible,
.cpub-inspector-page-field select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  border-color: var(--accent);
}
.cpub-inspector-page-field textarea {
  resize: vertical;
  font-family: var(--font-body);
}

.cpub-inspector-page-hint {
  font-size: var(--text-xs);
  color: var(--text-faint);
  margin: 0;
}

.cpub-inspector-page-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.cpub-inspector-page-checkbox label {
  font-size: var(--text-sm);
  color: var(--text);
}
.cpub-inspector-page-checkbox input { cursor: pointer; }
</style>
