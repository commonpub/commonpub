<script setup lang="ts">
interface RequestView {
  id: string;
  remoteDomain: string;
  remoteActorUri: string;
  createdAt: string;
}

const props = defineProps<{ request: RequestView }>();
const emit = defineEmits<{ close: []; changed: [] }>();

const toast = useToast();

// Activate the focus trap once mounted (parent gates with v-if).
const contentRef = ref<HTMLElement | null>(null);
const visible = ref(false);
onMounted(() => { visible.value = true; });
useFocusTrap(contentRef, () => visible.value, () => emit('close'));

// Same bounded depth choices as the create form — what history to pull when we approve.
const DEPTH_OPTIONS: Array<{ label: string; body: Record<string, number> | null }> = [
  { label: 'None, forward only (default)', body: null },
  { label: 'Last 7 days', body: { sinceDays: 7 } },
  { label: 'Last 30 days', body: { sinceDays: 30 } },
  { label: 'Last 90 days', body: { sinceDays: 90 } },
  { label: 'Last 200 items', body: { maxItems: 200 } },
  { label: 'Everything (up to limit)', body: {} },
];
const depthIndex = ref(0); // default forward-only

const FEDERATABLE_TYPES = ['project', 'blog', 'explainer'] as const;
const types = ref<string[]>([]);
const tagsRaw = ref('');

function toggleType(t: string): void {
  const i = types.value.indexOf(t);
  if (i === -1) types.value.push(t);
  else types.value.splice(i, 1);
}

const busy = ref<'' | 'approve' | 'reject'>('');

async function approve(): Promise<void> {
  busy.value = 'approve';
  const tags = tagsRaw.value.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
  const depth = DEPTH_OPTIONS[depthIndex.value]!.body;
  const body: Record<string, unknown> = { ...(depth ?? {}) };
  if (types.value.length) body.filterContentTypes = types.value;
  if (tags.length) body.filterTags = tags;
  const url: string = `/api/admin/federation/mirror-requests/${props.request.id}/approve`;
  try {
    await $fetch(url, { method: 'POST', body });
    toast.success(`Approved, now mirroring ${props.request.remoteDomain}`);
    emit('changed');
    emit('close');
  } catch {
    toast.error('Failed to approve request');
  } finally {
    busy.value = '';
  }
}

async function reject(): Promise<void> {
  busy.value = 'reject';
  const url: string = `/api/admin/federation/mirror-requests/${props.request.id}/reject`;
  try {
    await $fetch(url, { method: 'POST' });
    toast.success('Request rejected');
    emit('changed');
    emit('close');
  } catch {
    toast.error('Failed to reject request');
  } finally {
    busy.value = '';
  }
}
</script>

<template>
  <Teleport to="body">
  <div class="cpub-modal-backdrop" @click.self="emit('close')">
    <div ref="contentRef" class="cpub-modal-content" role="dialog" aria-modal="true" aria-labelledby="cpub-mr-modal-title">
      <div class="cpub-modal-header">
        <h3 id="cpub-mr-modal-title" class="cpub-modal-title">Approve mirror request</h3>
        <button class="cpub-modal-close" aria-label="Close" @click="emit('close')"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <p class="cpub-mr-sub">
        <strong>{{ request.remoteDomain }}</strong> asked you to mirror your instance. Approving creates a
        <strong>pull mirror</strong> of them, you'll receive their public content, with the depth and
        filters you choose below. (One-directional: they still receive nothing from you.)
      </p>

      <!-- History depth -->
      <div class="cpub-mr-section">
        <label class="cpub-mr-label" for="cpub-mr-depth">Import history</label>
        <select id="cpub-mr-depth" v-model.number="depthIndex" class="cpub-fed-input" style="width:100%;">
          <option v-for="(opt, i) in DEPTH_OPTIONS" :key="i" :value="i">{{ opt.label }}</option>
        </select>
        <p class="cpub-mr-hint">Bounded so you don't pull an entire large instance at once. New posts arrive automatically regardless.</p>
      </div>

      <!-- Filters -->
      <div class="cpub-mr-section">
        <span class="cpub-mr-label">Content types <span class="cpub-mr-faint">(none = all)</span></span>
        <div class="cpub-mr-checks">
          <label v-for="t in FEDERATABLE_TYPES" :key="t" class="cpub-mr-check">
            <input type="checkbox" :checked="types.includes(t)" @change="toggleType(t)" /> {{ t }}
          </label>
        </div>
        <label class="cpub-mr-label" for="cpub-mr-tags">Tags <span class="cpub-mr-faint">(comma-separated, none = all)</span></label>
        <input id="cpub-mr-tags" v-model="tagsRaw" placeholder="arduino, 3dprinting" class="cpub-fed-input" style="width:100%;" />
      </div>

      <!-- Actions -->
      <div class="cpub-modal-actions">
        <button class="cpub-fed-btn" :disabled="busy === 'approve'" @click="approve">
          {{ busy === 'approve' ? 'Approving…' : 'Approve & mirror' }}
        </button>
        <button class="cpub-fed-btn-sm cpub-fed-btn-danger" :disabled="busy === 'reject'" @click="reject">
          {{ busy === 'reject' ? 'Rejecting…' : 'Reject' }}
        </button>
        <button class="cpub-fed-btn-sm" @click="emit('close')">Cancel</button>
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

.cpub-mr-sub { font-size: 0.8125rem; color: var(--text-dim); line-height: 1.5; margin-bottom: 16px; }
.cpub-mr-section { margin-bottom: 16px; }
.cpub-mr-label { display: block; font-family: var(--font-mono); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); margin-bottom: 6px; }
.cpub-mr-faint { color: var(--text-faint); text-transform: none; letter-spacing: 0; font-weight: 400; }
.cpub-mr-hint { font-size: 0.75rem; color: var(--text-faint); margin-top: 6px; line-height: 1.4; }
.cpub-mr-checks { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.cpub-mr-check { display: flex; align-items: center; gap: 4px; font-size: 0.8125rem; color: var(--text); cursor: pointer; }

.cpub-modal-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; border-top: var(--border-width-default) solid var(--border); padding-top: 16px; }

/* Shared federation control styles (repeated for the modal's scope). */
.cpub-fed-input { padding: 8px 12px; font-family: var(--font-mono); font-size: 0.8125rem; border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); }
.cpub-fed-btn { padding: 8px 16px; font-family: var(--font-mono); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; cursor: pointer; background: var(--accent); color: var(--color-text-inverse); border: var(--border-width-default) solid var(--accent); box-shadow: var(--shadow-sm); }
.cpub-fed-btn:hover { box-shadow: none; transform: translate(2px, 2px); }
.cpub-fed-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
.cpub-fed-btn-sm { padding: 4px 10px; font-family: var(--font-mono); font-size: 10px; font-weight: 600; text-transform: uppercase; cursor: pointer; background: transparent; border: var(--border-width-default) solid var(--border); color: var(--text-dim); }
.cpub-fed-btn-sm:hover { border-color: var(--accent); color: var(--accent); }
.cpub-fed-btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.cpub-fed-btn-danger { color: var(--red-text); border-color: var(--red); }
.cpub-fed-btn-danger:hover { border-color: var(--red); color: var(--red-text); background: var(--surface2); }
</style>
