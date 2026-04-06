/**
 * Content save composable — manages draft creation, updates, autosave, and publishing.
 * Extracted from edit.vue to keep the page component thin.
 */
import type { BlockTuple } from '@commonpub/editor';
import type { WatchSource } from 'vue';

export interface ContentSaveOptions {
  contentType: Ref<string>;
  title: Ref<string>;
  metadata: Ref<Record<string, unknown>>;
  isNew: Ref<boolean>;
  contentId: Ref<string | null>;
  isDirty: Ref<boolean>;
  getBlockTuples: () => BlockTuple[];
  extractError: (err: unknown) => string;
  /** Called after every save to sync product links from partsList blocks */
  onAfterSave?: (id: string) => Promise<void>;
  /** Author username for user-scoped URLs (/u/{username}/{type}/{slug}) */
  username?: Ref<string>;
}

export interface ContentSaveReturn {
  saving: Ref<boolean>;
  error: Ref<string>;
  autoSaveStatus: Ref<'idle' | 'saving' | 'saved' | 'error'>;
  /** Save without navigating — used by Save Draft, autosave, Ctrl+S */
  silentSave: () => Promise<void>;
  /** Save and navigate to the content view page */
  handleSave: () => Promise<void>;
  /** Validate, save, publish, and navigate */
  handlePublish: (validate?: () => string[]) => Promise<string[]>;
  /** Build a clean save body from current state */
  buildSaveBody: () => Record<string, unknown>;
  /** Schedule an autosave after the debounce delay */
  scheduleAutoSave: () => void;
  /** Cancel any pending autosave timer */
  cancelAutoSave: () => void;
  /** Set up autosave watchers — call in onMounted or setup */
  initAutoSave: (watches: WatchSource[]) => void;
  /** Clean up timers — call in onUnmounted */
  cleanup: () => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 128);
}

const AUTO_SAVE_DELAY = 30_000;

export function useContentSave(opts: ContentSaveOptions): ContentSaveReturn {
  // URL helpers — use user-scoped paths when username is available
  function viewPath(type: string, slug: string): string {
    if (opts.username?.value) return `/u/${opts.username.value}/${type}/${slug}`;
    return `/${type}/${slug}`;
  }
  function editPath(type: string, slug: string): string {
    if (opts.username?.value) return `/u/${opts.username.value}/${type}/${slug}/edit`;
    return `/${type}/${slug}/edit`;
  }

  const saving = ref(false);
  const error = ref('');
  const autoSaveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle');
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

  function buildSaveBody(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      type: opts.contentType.value,
      title: opts.title.value,
      content: opts.getBlockTuples(),
      ...opts.metadata.value,
    };
    if (!body.slug) delete body.slug;
    for (const key of Object.keys(body)) {
      if (body[key] === '') body[key] = undefined;
    }
    return body;
  }

  async function createDraft(body: Record<string, unknown>): Promise<{ id: string; slug: string }> {
    try {
      return await $fetch<{ id: string; slug: string }>('/api/content', { method: 'POST', body });
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? '';
      if (msg.toLowerCase().includes('slug') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique')) {
        body.slug = `${body.slug || slugify(opts.title.value)}-${Date.now().toString(36).slice(-4)}`;
        return await $fetch<{ id: string; slug: string }>('/api/content', { method: 'POST', body });
      }
      throw err;
    }
  }

  async function silentSave(): Promise<void> {
    if (saving.value) return;
    if (!opts.title.value) {
      error.value = 'Please enter a title before saving.';
      return;
    }
    if (!opts.isNew.value && !opts.contentId.value) {
      opts.isNew.value = true;
    }
    saving.value = true;
    autoSaveStatus.value = 'saving';
    error.value = '';

    try {
      const body = buildSaveBody();

      if (opts.isNew.value) {
        const result = await createDraft(body);
        opts.contentId.value = result.id;
        opts.isNew.value = false;
        opts.isDirty.value = false;
        autoSaveStatus.value = 'saved';
        if (opts.onAfterSave) await opts.onAfterSave(result.id);
        history.replaceState({}, '', editPath(opts.contentType.value, result.slug));
      } else {
        const updated = await $fetch<{ slug: string }>(`/api/content/${opts.contentId.value}`, { method: 'PUT', body });
        opts.isDirty.value = false;
        autoSaveStatus.value = 'saved';
        if (opts.onAfterSave) await opts.onAfterSave(opts.contentId.value!);
        if (updated?.slug) {
          history.replaceState({}, '', editPath(opts.contentType.value, updated.slug));
        }
      }

      setTimeout(() => {
        if (autoSaveStatus.value === 'saved') autoSaveStatus.value = 'idle';
      }, 3000);
    } catch (err: unknown) {
      error.value = opts.extractError(err);
      autoSaveStatus.value = 'error';
    } finally {
      saving.value = false;
    }
  }

  async function handleSave(): Promise<void> {
    if (saving.value || !opts.title.value) return;
    cancelAutoSave();
    if (!opts.isNew.value && !opts.contentId.value) opts.isNew.value = true;
    saving.value = true;
    error.value = '';

    try {
      const body = buildSaveBody();
      if (opts.isNew.value) {
        const result = await createDraft(body);
        opts.contentId.value = result.id;
        opts.isNew.value = false;
        opts.isDirty.value = false;
        if (opts.onAfterSave) await opts.onAfterSave(result.id);
        await navigateTo(viewPath(opts.contentType.value, result.slug));
      } else {
        const updated = await $fetch<{ slug?: string }>(`/api/content/${opts.contentId.value}`, { method: 'PUT', body });
        opts.isDirty.value = false;
        if (opts.onAfterSave) await opts.onAfterSave(opts.contentId.value!);
        const currentSlug = updated?.slug || useRoute().params.slug as string;
        await navigateTo(viewPath(opts.contentType.value, currentSlug));
      }
    } catch (err: unknown) {
      error.value = opts.extractError(err);
    } finally {
      saving.value = false;
    }
  }

  async function handlePublish(validate?: () => string[]): Promise<string[]> {
    if (saving.value || !opts.title.value) return ['Title is required'];
    if (validate) {
      const errs = validate();
      if (errs.length > 0) return errs;
    }
    cancelAutoSave();
    saving.value = true;
    error.value = '';

    try {
      const body = buildSaveBody();
      let resultSlug = useRoute().params.slug as string;

      if (opts.isNew.value || !opts.contentId.value) {
        const result = await createDraft(body);
        opts.contentId.value = result.id;
        opts.isNew.value = false;
        resultSlug = result.slug;
        if (opts.onAfterSave) await opts.onAfterSave(result.id);
      } else {
        const updated = await $fetch<{ slug: string }>(`/api/content/${opts.contentId.value}`, { method: 'PUT', body });
        if (updated?.slug) resultSlug = updated.slug;
        if (opts.onAfterSave) await opts.onAfterSave(opts.contentId.value!);
      }

      await $fetch(`/api/content/${opts.contentId.value}/publish`, { method: 'POST' });

      // Share to hub if one is selected in metadata
      const hubSlug = opts.metadata.value?.hubSlug as string | undefined;
      if (hubSlug && opts.contentId.value) {
        try {
          await $fetch(`/api/hubs/${hubSlug}/share`, {
            method: 'POST',
            body: { contentId: opts.contentId.value },
          });
        } catch {
          // Non-fatal: content is published even if hub share fails
          console.warn(`[publish] Failed to share to hub ${hubSlug}`);
        }
      }

      opts.isDirty.value = false;
      await navigateTo(viewPath(opts.contentType.value, resultSlug));
      return [];
    } catch (err: unknown) {
      error.value = opts.extractError(err);
      return [];
    } finally {
      saving.value = false;
    }
  }

  function scheduleAutoSave(): void {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
      if (!opts.isDirty.value || saving.value || opts.isNew.value || !opts.contentId.value || !opts.title.value) return;
      await silentSave();
    }, AUTO_SAVE_DELAY);
  }

  function cancelAutoSave(): void {
    if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
  }

  function initAutoSave(watches: WatchSource[]): void {
    watch(watches, () => {
      if (!opts.isNew.value && opts.contentId.value) {
        scheduleAutoSave();
      }
    }, { deep: true });
  }

  function cleanup(): void {
    cancelAutoSave();
  }

  return {
    saving,
    error,
    autoSaveStatus,
    silentSave,
    handleSave,
    handlePublish,
    buildSaveBody,
    scheduleAutoSave,
    cancelAutoSave,
    initAutoSave,
    cleanup,
  };
}
