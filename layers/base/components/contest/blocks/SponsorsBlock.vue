<script setup lang="ts">
/**
 * Edit component for the `sponsors` block — a logo wall. House block-edit contract:
 * `content` in, `update` out, immutable list ops. Each logo can be uploaded (via
 * the contest editor's UPLOAD_HANDLER_KEY) or pasted as a URL, with an alt name,
 * an optional outbound link, and an optional tier label. Provided via
 * BLOCK_COMPONENTS_KEY.
 */
import { inject, ref } from 'vue';
import { UPLOAD_HANDLER_KEY } from '@commonpub/editor/vue';
import type { SponsorLogo, SponsorsContent } from '../../../types/contestBlocks';

const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ update: [content: Record<string, unknown>] }>();

const uploadHandler = inject(UPLOAD_HANDLER_KEY, undefined);
const uploadingIndex = ref<number | null>(null);

const heading = computed(() => (typeof props.content.heading === 'string' ? props.content.heading : ''));
const logos = computed<SponsorLogo[]>(() => (Array.isArray(props.content.logos) ? (props.content.logos as SponsorLogo[]) : []));

function commit(next: Partial<SponsorsContent>): void {
  emit('update', { heading: heading.value || undefined, logos: logos.value, ...next });
}
function addLogo(): void {
  commit({ logos: [...logos.value, { src: '', alt: '' }] });
}
function setLogo(i: number, field: keyof SponsorLogo, value: string): void {
  commit({ logos: logos.value.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)) });
}
function removeLogo(i: number): void {
  commit({ logos: logos.value.filter((_, idx) => idx !== i) });
}
async function onFile(i: number, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !uploadHandler) return;
  uploadingIndex.value = i;
  try {
    const res = await uploadHandler(file);
    setLogo(i, 'src', res.url);
  } finally {
    uploadingIndex.value = null;
  }
}
</script>

<template>
  <div class="cpub-spedit">
    <div class="cpub-spedit-header">
      <div class="cpub-spedit-icon"><i class="fa-solid fa-handshake-angle"></i></div>
      <span class="cpub-spedit-title">Sponsors</span>
      <span class="cpub-spedit-count">{{ logos.length }} {{ logos.length === 1 ? 'logo' : 'logos' }}</span>
      <button type="button" class="cpub-spedit-add" @click="addLogo"><i class="fa-solid fa-plus"></i> Add logo</button>
    </div>

    <div class="cpub-spedit-body">
      <input
        class="cpub-spedit-input cpub-spedit-heading"
        type="text"
        :value="heading"
        placeholder="Eyebrow heading (optional), e.g. Sponsors"
        aria-label="Sponsors heading"
        @input="commit({ heading: ($event.target as HTMLInputElement).value || undefined })"
      />

      <div v-for="(l, i) in logos" :key="i" class="cpub-spedit-row">
        <div class="cpub-spedit-thumb" :class="{ 'is-empty': !l.src }">
          <img v-if="l.src" :src="l.src" :alt="l.alt || 'Sponsor logo'" />
          <i v-else class="fa-regular fa-image"></i>
        </div>
        <div class="cpub-spedit-fields">
          <div class="cpub-spedit-srcrow">
            <input class="cpub-spedit-input" type="url" :value="l.src" placeholder="Logo image URL (https://…)" :aria-label="`Logo ${i + 1} image URL`" @input="setLogo(i, 'src', ($event.target as HTMLInputElement).value)" />
            <label v-if="uploadHandler" class="cpub-spedit-upload" :title="`Upload logo ${i + 1}`">
              <i class="fa-solid" :class="uploadingIndex === i ? 'fa-circle-notch fa-spin' : 'fa-arrow-up-from-bracket'"></i>
              <input type="file" accept="image/*" class="cpub-sr-only" :aria-label="`Upload logo ${i + 1}`" @change="onFile(i, $event)" />
            </label>
          </div>
          <div class="cpub-spedit-metarow">
            <input class="cpub-spedit-input" type="text" :value="l.alt" placeholder="Name (alt text)" :aria-label="`Logo ${i + 1} name`" @input="setLogo(i, 'alt', ($event.target as HTMLInputElement).value)" />
            <input class="cpub-spedit-input" type="text" :value="l.tier ?? ''" placeholder="Tier (optional)" :aria-label="`Logo ${i + 1} tier`" @input="setLogo(i, 'tier', ($event.target as HTMLInputElement).value)" />
          </div>
          <input class="cpub-spedit-input" type="url" :value="l.url ?? ''" placeholder="Link (https://…, optional)" :aria-label="`Logo ${i + 1} link`" @input="setLogo(i, 'url', ($event.target as HTMLInputElement).value)" />
        </div>
        <button type="button" class="cpub-spedit-remove" :aria-label="`Remove logo ${i + 1}`" @click="removeLogo(i)"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div v-if="!logos.length" class="cpub-spedit-empty" @click="addLogo"><i class="fa-solid fa-plus"></i> Add the first sponsor logo</div>
    </div>
  </div>
</template>

<style scoped>
.cpub-spedit { border: var(--border-width-default) solid var(--border2); background: var(--surface); }
.cpub-spedit-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: var(--border-width-default) solid var(--border2); background: var(--surface2); }
.cpub-spedit-icon { font-size: 12px; color: var(--accent); }
.cpub-spedit-title { font-size: 12px; font-weight: 600; }
.cpub-spedit-count { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); margin-left: auto; }
.cpub-spedit-add { font-family: var(--font-mono); font-size: 10px; padding: 3px 8px; background: transparent; border: var(--border-width-default) solid var(--border2); color: var(--text-dim); cursor: pointer; display: flex; align-items: center; gap: 4px; margin-left: 8px; }
.cpub-spedit-add:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-bg); }

.cpub-spedit-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.cpub-spedit-input { width: 100%; padding: 6px 8px; font-size: 12px; background: var(--surface); border: var(--border-width-default) solid var(--border); color: var(--text); outline: none; }
.cpub-spedit-input:focus { border-color: var(--accent); }
.cpub-spedit-input::placeholder { color: var(--text-faint); }
.cpub-spedit-heading { font-weight: 600; }

.cpub-spedit-row { display: flex; gap: 8px; align-items: flex-start; border: var(--border-width-default) dashed var(--border2); padding: 8px; }
.cpub-spedit-thumb { width: 56px; height: 56px; flex-shrink: 0; border: var(--border-width-default) solid var(--border); background: var(--surface2); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.cpub-spedit-thumb img { max-width: 100%; max-height: 100%; object-fit: contain; }
.cpub-spedit-thumb.is-empty { color: var(--text-faint); font-size: 16px; }
.cpub-spedit-fields { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.cpub-spedit-srcrow { display: flex; gap: 6px; }
.cpub-spedit-srcrow .cpub-spedit-input { flex: 1; }
.cpub-spedit-metarow { display: flex; gap: 6px; }
.cpub-spedit-metarow .cpub-spedit-input { flex: 1; }
.cpub-spedit-upload { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 30px; border: var(--border-width-default) solid var(--border); background: var(--surface2); color: var(--text-dim); cursor: pointer; }
.cpub-spedit-upload:hover { border-color: var(--accent); color: var(--accent); }
.cpub-spedit-remove { background: none; border: var(--border-width-default) solid var(--border); color: var(--text-faint); cursor: pointer; font-size: 11px; padding: 0 8px; flex-shrink: 0; align-self: stretch; }
.cpub-spedit-remove:hover { border-color: var(--red-border); color: var(--red); }

.cpub-spedit-empty { padding: 20px; text-align: center; font-size: 12px; color: var(--text-faint); cursor: pointer; border: var(--border-width-default) dashed var(--border2); }
.cpub-spedit-empty:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-bg); }
.cpub-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
</style>
