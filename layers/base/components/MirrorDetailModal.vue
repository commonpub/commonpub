<script setup lang="ts">
interface MirrorView {
  id: string;
  remoteDomain: string;
  remoteActorUri: string;
  status: string;
  direction: string;
  filterContentTypes: string[] | null;
  filterTags: string[] | null;
  contentCount: number;
  errorCount: number;
  lastError: string | null;
  lastSyncAt: string | null;
  backfillCursor?: string | null;
}

const props = defineProps<{ mirror: MirrorView }>();
const emit = defineEmits<{ close: []; changed: [] }>();

const toast = useToast();

// Activate the focus trap once mounted (parent gates with v-if).
const contentRef = ref<HTMLElement | null>(null);
const visible = ref(false);
onMounted(() => { visible.value = true; });
useFocusTrap(contentRef, () => visible.value, () => emit('close'));

// Bounded "how far back" choices for re-backfill — mirrors the create form.
const DEPTH_OPTIONS: Array<{ label: string; body: Record<string, number> }> = [
  { label: 'Last 7 days', body: { sinceDays: 7 } },
  { label: 'Last 30 days', body: { sinceDays: 30 } },
  { label: 'Last 90 days', body: { sinceDays: 90 } },
  { label: 'Last 200 items', body: { maxItems: 200 } },
  { label: 'Everything (up to limit)', body: {} },
];
const depthIndex = ref(1); // default last 30 days

const busy = ref<'' | 'toggle' | 'backfill' | 'delete'>('');
const confirmingDelete = ref(false);
const backfillResult = ref<{ processed: number; errors: number; pages: number; complete: boolean } | null>(null);

const isPull = computed(() => props.mirror.direction !== 'push');

// `$fetch` typed-routes inference recurses over the full route union on dynamic template URLs
// (TS2321 "excessive stack depth"); a string-typed const forces the plain string overload.
async function toggle(): Promise<void> {
  busy.value = 'toggle';
  const url: string = `/api/admin/federation/mirrors/${props.mirror.id}`;
  try {
    await $fetch(url, { method: 'PUT', body: { action: props.mirror.status === 'active' ? 'pause' : 'resume' } });
    toast.success(props.mirror.status === 'active' ? 'Mirror paused' : 'Mirror resumed');
    emit('changed');
  } catch {
    toast.error('Failed to update mirror');
  } finally {
    busy.value = '';
  }
}

async function backfill(): Promise<void> {
  busy.value = 'backfill';
  backfillResult.value = null;
  const url: string = `/api/admin/federation/mirrors/${props.mirror.id}/backfill`;
  try {
    backfillResult.value = await $fetch<{ processed: number; errors: number; pages: number; complete: boolean }>(url, {
      method: 'POST',
      body: DEPTH_OPTIONS[depthIndex.value]!.body,
    });
    toast.success(`Imported ${backfillResult.value?.processed ?? 0} item(s)`);
    emit('changed');
  } catch {
    toast.error('Backfill failed');
  } finally {
    busy.value = '';
  }
}

async function remove(): Promise<void> {
  busy.value = 'delete';
  const url: string = `/api/admin/federation/mirrors/${props.mirror.id}`;
  try {
    await $fetch(url, { method: 'DELETE' });
    toast.success('Mirror deleted');
    emit('changed');
    emit('close');
  } catch {
    toast.error('Failed to delete mirror');
  } finally {
    busy.value = '';
  }
}
</script>

<template>
  <Teleport to="body">
  <div class="cpub-modal-backdrop" @click.self="emit('close')">
    <div ref="contentRef" class="cpub-modal-content" role="dialog" aria-modal="true" aria-labelledby="cpub-mirror-modal-title">
      <div class="cpub-modal-header">
        <h3 id="cpub-mirror-modal-title" class="cpub-modal-title">{{ mirror.remoteDomain }}</h3>
        <button class="cpub-modal-close" aria-label="Close" @click="emit('close')"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <p class="cpub-mm-sub">
        <span class="cpub-mm-dir">{{ isPull ? '↓ Pull (you receive their content)' : '↑ Push request' }}</span>
       , one-directional: this instance receives content from {{ mirror.remoteDomain }}; they receive nothing from you.
      </p>

      <!-- Facts -->
      <dl class="cpub-mm-facts">
        <div><dt>Status</dt><dd><span class="cpub-fed-status" :class="mirror.status">{{ mirror.status }}</span></dd></div>
        <div><dt>Items imported</dt><dd>{{ mirror.contentCount }}</dd></div>
        <div><dt>Errors</dt><dd>{{ mirror.errorCount }}</dd></div>
        <div><dt>Last sync</dt><dd>{{ mirror.lastSyncAt ? new Date(mirror.lastSyncAt).toLocaleString() : 'never' }}</dd></div>
        <div><dt>Actor</dt><dd class="cpub-mm-mono">{{ mirror.remoteActorUri }}</dd></div>
        <div>
          <dt>Content types</dt>
          <dd>
            <template v-if="mirror.filterContentTypes && mirror.filterContentTypes.length">
              <span v-for="t in mirror.filterContentTypes" :key="t" class="cpub-mm-chip">{{ t }}</span>
            </template>
            <span v-else class="cpub-mm-faint">all types</span>
          </dd>
        </div>
        <div>
          <dt>Tags</dt>
          <dd>
            <template v-if="mirror.filterTags && mirror.filterTags.length">
              <span v-for="t in mirror.filterTags" :key="t" class="cpub-mm-chip">#{{ t }}</span>
            </template>
            <span v-else class="cpub-mm-faint">all tags</span>
          </dd>
        </div>
      </dl>

      <div v-if="mirror.lastError" class="cpub-mm-error">
        <strong>Last error:</strong> {{ mirror.lastError }}
      </div>

      <!-- Re-backfill with bounded depth -->
      <div class="cpub-mm-section">
        <label class="cpub-mm-label" for="cpub-mm-depth">Import history</label>
        <div class="cpub-mm-row">
          <select id="cpub-mm-depth" v-model.number="depthIndex" class="cpub-fed-input">
            <option v-for="(opt, i) in DEPTH_OPTIONS" :key="i" :value="i">{{ opt.label }}</option>
          </select>
          <button class="cpub-fed-btn" :disabled="busy === 'backfill'" @click="backfill">
            {{ busy === 'backfill' ? 'Importing…' : 'Backfill' }}
          </button>
        </div>
        <p class="cpub-mm-hint">Crawls {{ mirror.remoteDomain }}'s outbox newest-first and stops at the chosen depth, bounded so you don't pull an entire large instance at once.</p>
        <div v-if="backfillResult" class="cpub-fed-result">
          Imported {{ backfillResult.processed }} item(s), {{ backfillResult.errors }} error(s), {{ backfillResult.pages }} page(s){{ backfillResult.complete ? ', complete.' : ', more available (run again).' }}
        </div>
      </div>

      <!-- Actions -->
      <div class="cpub-modal-actions">
        <button class="cpub-fed-btn" :disabled="busy === 'toggle'" @click="toggle">
          {{ mirror.status === 'active' ? 'Pause' : 'Resume' }}
        </button>
        <template v-if="!confirmingDelete">
          <button class="cpub-fed-btn-sm cpub-fed-btn-danger" @click="confirmingDelete = true">Delete mirror</button>
        </template>
        <template v-else>
          <span class="cpub-mm-confirm">Delete and hide its content?</span>
          <button class="cpub-fed-btn-sm cpub-fed-btn-danger" :disabled="busy === 'delete'" @click="remove">
            {{ busy === 'delete' ? 'Deleting…' : 'Confirm delete' }}
          </button>
          <button class="cpub-fed-btn-sm" @click="confirmingDelete = false">Cancel</button>
        </template>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<style scoped>
.cpub-modal-backdrop {
  position: fixed; inset: 0; background: var(--color-surface-scrim, rgba(0,0,0,0.5));
  z-index: var(--z-modal-backdrop); display: flex; align-items: center; justify-content: center; padding: 16px;
}
.cpub-modal-content {
  background: var(--surface); border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-lg); padding: 24px; max-width: 520px; width: 92vw;
  max-height: 90vh; overflow-y: auto;
}
.cpub-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.cpub-modal-title { font-size: 16px; font-weight: 700; font-family: var(--font-mono); }
.cpub-modal-close { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 14px; padding: 4px; }
.cpub-modal-close:hover { color: var(--text); }

.cpub-mm-sub { font-size: 0.8125rem; color: var(--text-dim); line-height: 1.5; margin-bottom: 16px; }
.cpub-mm-dir { font-weight: 700; color: var(--accent); font-family: var(--font-mono); }

.cpub-mm-facts { display: grid; grid-template-columns: 1fr; gap: 0; margin-bottom: 16px; border: var(--border-width-default) solid var(--border); }
.cpub-mm-facts > div { display: flex; gap: 12px; padding: 8px 12px; border-bottom: var(--border-width-default) solid var(--border); font-size: 0.8125rem; }
.cpub-mm-facts > div:last-child { border-bottom: none; }
.cpub-mm-facts dt { flex: 0 0 110px; color: var(--text-dim); font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; padding-top: 2px; }
.cpub-mm-facts dd { flex: 1; min-width: 0; margin: 0; word-break: break-word; }
.cpub-mm-mono { font-family: var(--font-mono); font-size: 0.75rem; }
.cpub-mm-faint { color: var(--text-faint); }
.cpub-mm-chip { display: inline-block; font-family: var(--font-mono); font-size: 10px; padding: 1px 6px; margin: 0 4px 4px 0; border: var(--border-width-default) solid var(--accent-border); background: var(--accent-bg); color: var(--accent); }

.cpub-mm-error { font-size: 0.75rem; color: var(--red); background: var(--surface2); padding: 8px 12px; margin-bottom: 16px; border: var(--border-width-default) solid var(--red); word-break: break-word; }

.cpub-mm-section { margin-bottom: 16px; }
.cpub-mm-label { display: block; font-family: var(--font-mono); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); margin-bottom: 6px; }
.cpub-mm-row { display: flex; gap: 8px; }
.cpub-mm-hint { font-size: 0.75rem; color: var(--text-faint); margin-top: 6px; line-height: 1.4; }

.cpub-modal-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; border-top: var(--border-width-default) solid var(--border); padding-top: 16px; }
.cpub-mm-confirm { font-size: 0.8125rem; color: var(--red); font-family: var(--font-mono); }

/* Shared federation control styles (also defined on the page; repeated here for the modal's scope). */
.cpub-fed-input { flex: 1; padding: 8px 12px; font-family: var(--font-mono); font-size: 0.8125rem; border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); }
.cpub-fed-btn { padding: 8px 16px; font-family: var(--font-mono); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; cursor: pointer; background: var(--accent); color: var(--color-text-inverse); border: var(--border-width-default) solid var(--accent); box-shadow: var(--shadow-sm); }
.cpub-fed-btn:hover { box-shadow: none; transform: translate(2px, 2px); }
.cpub-fed-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
.cpub-fed-btn-sm { padding: 4px 10px; font-family: var(--font-mono); font-size: 10px; font-weight: 600; text-transform: uppercase; cursor: pointer; background: transparent; border: var(--border-width-default) solid var(--border); color: var(--text-dim); }
.cpub-fed-btn-sm:hover { border-color: var(--accent); color: var(--accent); }
.cpub-fed-btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.cpub-fed-btn-danger { color: var(--red); border-color: var(--red); }
.cpub-fed-btn-danger:hover { border-color: var(--red); color: var(--red); background: var(--surface2); }
.cpub-fed-status { font-size: 10px; font-weight: 600; padding: 2px 6px; text-transform: uppercase; font-family: var(--font-mono); border: var(--border-width-default) solid var(--border); }
.cpub-fed-status.active { color: var(--accent); border-color: var(--accent-border); background: var(--accent-bg); }
.cpub-fed-status.pending { color: var(--text-dim); }
.cpub-fed-status.paused { color: var(--text-dim); background: var(--surface2); }
.cpub-fed-status.failed { color: var(--red); border-color: var(--red); }
.cpub-fed-result { margin-top: 8px; padding: 10px 14px; font-size: 0.8125rem; font-family: var(--font-mono); background: var(--accent-bg); border: var(--border-width-default) solid var(--accent-border); color: var(--text); }
</style>
