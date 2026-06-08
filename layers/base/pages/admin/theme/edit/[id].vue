<script setup lang="ts">
/**
 * /admin/theme/edit/[id] — full theme editor.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  Toolbar: name • family • parent • dark? • save • export    │
 *   ├──────────────────────┬──────────────────────────────────────┤
 *   │  Token editor pane    │  Preview pane                       │
 *   │  (grouped, collapsible│  (scene picker, live tokens applied)│
 *   │   token rows)         │                                     │
 *   └───────────────────────┴─────────────────────────────────────┘
 *
 * Special URL: /admin/theme/edit/__new
 *   The list page stashes a seed in sessionStorage and pushes the user here.
 *   On save, the seed is POSTed and the user is redirected to the real ID.
 */
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { TOKEN_GROUP_LABELS, TOKEN_GROUP_ORDER, tokensByGroup } from '@commonpub/ui';
import { googleHref, type ThemeRecipe } from '@commonpub/theme-studio';

definePageMeta({ layout: 'admin', middleware: 'auth' });

const route = useRoute();
const router = useRouter();
const themesApi = useThemeAdmin();

const rawId = String(route.params.id ?? '');
const isCreating = rawId === '__new';

const loading = ref(true);
const saving = ref(false);
const dirty = ref(false);
const error = ref<string | null>(null);
const toast = ref<{ msg: string; tone: 'success' | 'error' } | null>(null);

interface DraftTheme {
  id: string;
  name: string;
  description: string;
  family: string;
  isDark: boolean;
  pairId?: string;
  parentTheme: string;
  tokens: Record<string, string>;
  recipe?: ThemeRecipe;
  fonts?: string[];
  createdAt?: string;
}

const draft = ref<DraftTheme>({
  id: '',
  name: '',
  description: '',
  family: 'custom',
  isDark: false,
  parentTheme: 'base',
  tokens: {},
});

const { themeStudio } = useFeatures();
/** Which left-pane editor is showing: the Studio wizard or the token grid. */
const studioMode = ref(false);

// Load the draft's chosen Google Fonts while editing so the preview + sheet
// render them live (mirrors the SSR <link> the active theme gets in prod).
useHead({
  link: computed(() => {
    const fonts = draft.value.fonts ?? [];
    const href = fonts.length ? googleHref(fonts) : '';
    return href ? [{ key: 'cpub-studio-preview-fonts', rel: 'stylesheet', href }] : [];
  }),
});

// --- Load -------------------------------------------------------------

onMounted(async () => {
  if (isCreating) {
    const raw = sessionStorage.getItem('cpub-theme-editor-seed');
    if (raw) {
      try {
        const seed = JSON.parse(raw);
        draft.value = {
          id: seed.id ?? '',
          name: seed.name ?? 'My theme',
          description: seed.description ?? '',
          family: seed.family ?? 'custom',
          isDark: Boolean(seed.isDark),
          pairId: seed.pairId,
          parentTheme: seed.parentTheme ?? 'base',
          tokens: seed.tokens ?? {},
          recipe: seed.recipe,
          fonts: seed.fonts,
        };
        // The create chooser flags Guided/Dice seeds to open Studio first.
        if (seed.openStudio && themeStudio.value) studioMode.value = true;
      } catch {
        // Bad seed — start blank
        draft.value.id = 'my-theme';
        draft.value.name = 'My theme';
      }
      sessionStorage.removeItem('cpub-theme-editor-seed');
    } else {
      // Direct navigation to /__new with no seed — give a blank draft
      draft.value.id = 'my-theme';
      draft.value.name = 'My theme';
    }
  } else {
    try {
      const theme = await $fetch<DraftTheme>(`/api/admin/themes/${rawId}`);
      draft.value = {
        id: theme.id,
        name: theme.name,
        description: theme.description ?? '',
        family: theme.family,
        isDark: theme.isDark,
        pairId: theme.pairId,
        parentTheme: theme.parentTheme,
        tokens: { ...theme.tokens },
        recipe: theme.recipe,
        fonts: theme.fonts,
        createdAt: theme.createdAt,
      };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load theme';
    }
  }

  // Load themes for the parent/pair pickers
  if (!themesApi.data.value) await themesApi.refresh();
  loading.value = false;
});

// --- Token editing ----------------------------------------------------

const groups = computed(() => tokensByGroup());

function updateToken(key: string, value: string): void {
  if (value === '') {
    // Empty input — treat as "use parent's value" (delete the override)
    const next = { ...draft.value.tokens };
    delete next[key];
    draft.value.tokens = next;
  } else {
    draft.value.tokens = { ...draft.value.tokens, [key]: value };
  }
  dirty.value = true;
}

function resetToken(key: string): void {
  const next = { ...draft.value.tokens };
  delete next[key];
  draft.value.tokens = next;
  dirty.value = true;
}

const modifiedTotal = computed(() => Object.keys(draft.value.tokens).length);

// --- Studio (guided generator) ---------------------------------------

/** Studio regenerated the whole token set — replace the draft's tokens. */
function onStudioGenerate(payload: {
  recipe: ThemeRecipe;
  tokens: Record<string, string>;
  fonts: string[];
  parentTheme: 'base' | 'dark';
  isDark: boolean;
}): void {
  draft.value.tokens = { ...payload.tokens };
  draft.value.recipe = payload.recipe;
  draft.value.fonts = payload.fonts;
  draft.value.parentTheme = payload.parentTheme;
  draft.value.isDark = payload.isDark;
  dirty.value = true;
}

/** "Generate & edit" — leave Studio for the granular token editor. */
function onStudioFinish(): void {
  studioMode.value = false;
}

/** Dice roll suggests a name; adopt it only if the user hasn't named it. */
function onStudioRoll(payload: { name: string }): void {
  const cur = draft.value.name.trim();
  if (!cur || cur === 'My theme') {
    draft.value.name = payload.name.charAt(0) + payload.name.slice(1).toLowerCase();
    dirty.value = true;
  }
}

// --- Metadata edits ---------------------------------------------------

function onMetaChange(): void { dirty.value = true; }

// Available parent themes — built-in only (custom-as-parent gets complex)
const parentOptions = computed(() => themesApi.data.value?.builtIn.map((t) => ({ id: t.id, name: t.name })) ?? []);

// Available pair candidates — same family, opposite mode, custom themes only
const pairCandidates = computed(() =>
  (themesApi.data.value?.custom ?? []).filter(
    (t) => t.family === draft.value.family && t.isDark !== draft.value.isDark && t.id !== draft.value.id,
  ),
);

// --- Save / cancel / export -----------------------------------------

/**
 * Save the draft. If `apply` is true, ALSO set this theme as the
 * instance default in the same await chain — must happen BEFORE the
 * create-mode router.replace, otherwise the navigation could unmount
 * the component mid-PUT and lose the apply.
 */
async function save({ apply = false }: { apply?: boolean } = {}): Promise<void> {
  saving.value = true;
  error.value = null;
  try {
    const payload = {
      id: draft.value.id,
      name: draft.value.name,
      description: draft.value.description,
      family: draft.value.family,
      isDark: draft.value.isDark,
      pairId: draft.value.pairId,
      parentTheme: draft.value.parentTheme,
      tokens: draft.value.tokens,
      recipe: draft.value.recipe,
      fonts: draft.value.fonts,
    };

    let savedId: string;
    if (isCreating) {
      const created = await $fetch('/api/admin/themes', {
        method: 'POST',
        body: payload,
      });
      savedId = (created as { id: string }).id;
    } else {
      // Cast: Nuxt's typed-route inference for dynamic URLs picks the
      // narrowest method overload (GET) — same workaround used in
      // learn/[slug]/edit.vue.
      await ($fetch as (url: string, opts: Record<string, unknown>) => Promise<unknown>)(
        `/api/admin/themes/${draft.value.id}`,
        { method: 'PUT', body: payload },
      );
      savedId = draft.value.id;
    }

    // Apply BEFORE refresh/navigation so the navigate doesn't unmount us
    // mid-PUT (would lose the apply + the success toast).
    if (apply) {
      await $fetch('/api/admin/settings', {
        method: 'PUT',
        body: { key: 'theme.default', value: `cpub-custom-${savedId}` },
      });
    }

    notify(apply ? 'Saved & applied' : (isCreating ? 'Theme created' : 'Saved'), 'success');
    dirty.value = false;
    await themesApi.refresh();

    // Navigate LAST so all the awaits above have observable effects.
    if (isCreating) {
      router.replace(`/admin/theme/edit/${savedId}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Save failed';
    error.value = msg;
    notify(msg, 'error');
  } finally {
    saving.value = false;
  }
}

async function applyAndSave(): Promise<void> {
  await save({ apply: true });
}

function exportTheme(): void {
  // Snapshot the in-progress draft (unsaved tokens included) so the
  // admin can export-while-editing without committing first.
  downloadThemeFile({
    id: draft.value.id,
    name: draft.value.name,
    description: draft.value.description,
    family: draft.value.family,
    isDark: draft.value.isDark,
    pairId: draft.value.pairId,
    parentTheme: draft.value.parentTheme,
    tokens: draft.value.tokens,
    recipe: draft.value.recipe,
    fonts: draft.value.fonts,
    createdAt: draft.value.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

function cancel(): void {
  if (dirty.value && !confirm('Discard unsaved changes?')) return;
  router.push('/admin/theme');
}

function notify(msg: string, tone: 'success' | 'error'): void {
  toast.value = { msg, tone };
  setTimeout(() => { toast.value = null; }, 2400);
}

// Browser leave guard — warn before refresh/close when there are unsaved changes
function beforeUnloadGuard(e: BeforeUnloadEvent): void {
  if (dirty.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}
onMounted(() => {
  if (typeof window !== 'undefined') window.addEventListener('beforeunload', beforeUnloadGuard);
});
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('beforeunload', beforeUnloadGuard);
});
</script>

<template>
  <div class="theme-editor">
    <header class="theme-editor-toolbar">
      <button
        class="cpub-btn cpub-btn-sm theme-editor-back"
        :title="dirty ? 'You have unsaved changes' : 'Back to themes list'"
        @click="cancel"
      >
        <i class="fa-solid fa-arrow-left" aria-hidden="true" />
        <span>Themes</span>
        <span v-if="dirty" class="theme-editor-dirty-dot" aria-label="unsaved changes"></span>
      </button>

      <div class="theme-editor-meta">
        <label class="theme-editor-field theme-editor-field-name">
          <span class="theme-editor-field-label">Name</span>
          <input
            v-model="draft.name"
            class="theme-editor-input theme-editor-input-name"
            type="text"
            placeholder="My theme"
            @input="onMetaChange"
          />
        </label>

        <label class="theme-editor-field">
          <span class="theme-editor-field-label">ID</span>
          <input
            v-model="draft.id"
            class="theme-editor-input theme-editor-input-id"
            type="text"
            placeholder="my-theme"
            :disabled="!isCreating"
            @input="onMetaChange"
          />
        </label>

        <label class="theme-editor-field">
          <span class="theme-editor-field-label">Family</span>
          <input
            v-model="draft.family"
            class="theme-editor-input theme-editor-input-family"
            type="text"
            placeholder="custom"
            @input="onMetaChange"
          />
        </label>

        <label class="theme-editor-field">
          <span class="theme-editor-field-label">Inherits from</span>
          <select v-model="draft.parentTheme" class="theme-editor-input" @change="onMetaChange">
            <option v-for="p in parentOptions" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>

        <label class="theme-editor-field theme-editor-field-toggle">
          <span class="theme-editor-field-label">Mode</span>
          <div class="theme-editor-mode-pill" role="group">
            <button
              type="button"
              class="theme-editor-mode-btn"
              :class="{ active: !draft.isDark }"
              @click="(() => { draft.isDark = false; onMetaChange(); })()"
            >Light</button>
            <button
              type="button"
              class="theme-editor-mode-btn"
              :class="{ active: draft.isDark }"
              @click="(() => { draft.isDark = true; onMetaChange(); })()"
            >Dark</button>
          </div>
        </label>

        <label v-if="pairCandidates.length" class="theme-editor-field">
          <span class="theme-editor-field-label">Pair with</span>
          <select v-model="draft.pairId" class="theme-editor-input" @change="onMetaChange">
            <option :value="undefined">- none -</option>
            <option v-for="p in pairCandidates" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
      </div>

      <div class="theme-editor-actions">
        <div
          v-if="themeStudio && (draft.recipe || studioMode)"
          class="theme-editor-mode-pill"
          role="group"
          aria-label="Editor mode"
        >
          <button
            type="button"
            class="theme-editor-mode-btn"
            :class="{ active: studioMode }"
            @click="studioMode = true"
          ><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Studio</button>
          <button
            type="button"
            class="theme-editor-mode-btn"
            :class="{ active: !studioMode }"
            @click="studioMode = false"
          ><i class="fa-solid fa-sliders" aria-hidden="true" /> Advanced</button>
        </div>
        <span v-if="modifiedTotal > 0" class="theme-editor-modified">
          {{ modifiedTotal }} token{{ modifiedTotal === 1 ? '' : 's' }} customized
        </span>
        <button class="cpub-btn cpub-btn-sm" @click="exportTheme" title="Download .cpub-theme.json">
          <i class="fa-solid fa-file-export" aria-hidden="true" /> Export
        </button>
        <button class="cpub-btn cpub-btn-sm" :disabled="saving || !dirty" @click="() => save()">
          <i :class="['fa-solid', saving ? 'fa-circle-notch fa-spin' : 'fa-floppy-disk']" aria-hidden="true" />
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
        <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="saving" @click="applyAndSave">
          <i :class="['fa-solid', saving ? 'fa-circle-notch fa-spin' : 'fa-rocket']" aria-hidden="true" />
          {{ saving ? 'Applying…' : 'Save & apply' }}
        </button>
      </div>
    </header>

    <p v-if="error" class="theme-editor-error">
      <i class="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {{ error }}
    </p>

    <textarea
      v-model="draft.description"
      class="theme-editor-description"
      placeholder="Description, shown on the theme list (optional)"
      rows="2"
      @input="onMetaChange"
    />

    <p v-if="loading" class="admin-empty">
      <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true" /> Loading editor…
    </p>

    <div v-else class="theme-editor-body">
      <AdminThemeStudio
        v-if="studioMode"
        class="theme-editor-studio"
        :recipe="draft.recipe"
        @generate="onStudioGenerate"
        @finish="onStudioFinish"
        @roll="onStudioRoll"
      />
      <section v-else class="theme-editor-tokens" aria-label="Token editor">
        <p v-if="draft.recipe" class="theme-editor-studio-hint">
          <i class="fa-solid fa-circle-info" aria-hidden="true" />
          This theme was built with Studio. Re-opening Studio and changing it overwrites manual token tweaks here.
        </p>
        <AdminThemeTokenGroup
          v-for="group in TOKEN_GROUP_ORDER"
          :key="group"
          :group="group"
          :label="TOKEN_GROUP_LABELS[group].label"
          :icon="TOKEN_GROUP_LABELS[group].icon"
          :description="TOKEN_GROUP_LABELS[group].description"
          :specs="groups[group]"
          :tokens="draft.tokens"
          :open="group === 'surfaces' || group === 'accent'"
          @update="updateToken"
          @reset="resetToken"
        />
      </section>

      <AdminThemePreviewPane
        class="theme-editor-preview"
        :tokens="draft.tokens"
        :parent-theme="draft.parentTheme"
        :is-dark="draft.isDark"
      />
    </div>

    <div v-if="toast" class="admin-theme-toast" :class="`tone-${toast.tone}`">
      <i :class="['fa-solid', toast.tone === 'success' ? 'fa-check' : 'fa-triangle-exclamation']" aria-hidden="true" />
      {{ toast.msg }}
    </div>
  </div>
</template>

<style scoped>
.theme-editor {
  display: flex;
  flex-direction: column;
  margin: calc(-1 * var(--space-6));
  min-height: calc(100vh - var(--nav-height));
  background: var(--bg);
}

/* Toolbar */
.theme-editor-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--surface);
  border-bottom: var(--border-width-default) solid var(--border);
  flex-wrap: wrap;
}

.theme-editor-back {
  flex-shrink: 0;
  position: relative;
}

.theme-editor-dirty-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  background: var(--accent);
  border-radius: var(--radius-full);
  margin-left: 4px;
  /* Subtle pulse so it draws the eye without being noisy */
  animation: theme-editor-dirty-pulse 2s ease-in-out infinite;
}

@keyframes theme-editor-dirty-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
@media (prefers-reduced-motion: reduce) {
  .theme-editor-dirty-dot { animation: none; }
}

.theme-editor-input-name {
  font-weight: var(--font-weight-semibold);
}

.theme-editor-meta {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.theme-editor-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.theme-editor-field-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  color: var(--text-faint);
}

.theme-editor-input {
  background: var(--surface2);
  color: var(--text);
  border: var(--border-width-thin) solid var(--border2);
  padding: 6px 10px;
  font-size: var(--text-sm);
  font-family: var(--font-body);
  min-width: 0;
}
.theme-editor-input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
.theme-editor-input:disabled { color: var(--text-faint); background: var(--surface); }

.theme-editor-input-name { min-width: 160px; }
.theme-editor-input-id { font-family: var(--font-mono); min-width: 120px; max-width: 180px; }
.theme-editor-input-family { font-family: var(--font-mono); min-width: 100px; max-width: 140px; }

.theme-editor-mode-pill {
  display: inline-flex;
  background: var(--surface2);
  border: var(--border-width-thin) solid var(--border2);
  padding: 2px;
}
.theme-editor-mode-btn {
  background: none;
  border: 0;
  padding: 4px 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  color: var(--text-dim);
  cursor: pointer;
}
.theme-editor-mode-btn.active { background: var(--surface); color: var(--accent); }

.theme-editor-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
  flex-wrap: wrap;
}
.theme-editor-modified {
  font-family: var(--font-mono);
  font-size: var(--text-label);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  color: var(--accent);
}

.theme-editor-error {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  background: var(--red-bg);
  border-bottom: var(--border-width-default) solid var(--red);
  color: var(--red);
  font-size: var(--text-sm);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.theme-editor-description {
  background: var(--surface);
  border: 0;
  border-bottom: var(--border-width-default) solid var(--border);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  font-family: var(--font-body);
  color: var(--text);
  resize: vertical;
  width: 100%;
}
.theme-editor-description:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }

.theme-editor-body {
  display: grid;
  grid-template-columns: minmax(320px, 380px) 1fr;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.theme-editor-tokens {
  background: var(--surface);
  border-right: var(--border-width-default) solid var(--border);
  overflow: auto;
  min-height: 0;
}

.theme-editor-studio {
  border-right: var(--border-width-default) solid var(--border);
  min-height: 0;
}

.theme-editor-studio-hint {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-3) var(--space-4);
  background: var(--accent-bg);
  border-bottom: var(--border-width-thin) solid var(--accent-border);
  color: var(--text-dim);
  font-size: var(--text-sm);
  line-height: var(--leading-snug);
}
.theme-editor-studio-hint i { color: var(--accent); margin-top: 2px; }

.theme-editor-preview {
  min-height: 0;
  overflow: hidden;
}

/* Toast reuses the list page's style */
.admin-theme-toast {
  position: fixed;
  top: calc(var(--nav-height) + var(--space-4));
  right: var(--space-4);
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-semibold);
  z-index: var(--z-toast);
  border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-inverse);
}
.admin-theme-toast.tone-success { background: var(--green); }
.admin-theme-toast.tone-error { background: var(--red); }

@media (max-width: 900px) {
  .theme-editor-body { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
  .theme-editor-tokens { border-right: 0; border-bottom: var(--border-width-default) solid var(--border); }
}
</style>
