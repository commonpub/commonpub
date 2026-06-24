<script setup lang="ts">
/**
 * Edit component for the `judgesShowcase` contest block (avatar + name + title +
 * bio cards). Provided to BlockCanvas via BLOCK_COMPONENTS_KEY by the contest
 * editor. Follows the house block-edit contract: `content` in, `update` out,
 * immutable list ops.
 *
 * P6 de-friction: avatars now upload via the contest editor's UPLOAD_HANDLER_KEY
 * (URL still accepted), rows reorder, and "Import panel judges" seeds rows from
 * the real scoring panel (CONTEST_JUDGES_KEY) in one click. The Judges Showcase
 * is the curated PUBLIC face (custom photos/titles); the scoring panel (People
 * rail) is the real accounts who score — two distinct concepts, hence the note.
 */
import { inject, ref } from 'vue';
import { UPLOAD_HANDLER_KEY } from '@commonpub/editor/vue';
import { CONTEST_JUDGES_KEY } from '../../../utils/contestBlocks';
import type { JudgeShowcaseEntry, JudgesShowcaseContent } from '../../../types/contestBlocks';

const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ update: [content: Record<string, unknown>] }>();

const uploadHandler = inject(UPLOAD_HANDLER_KEY, undefined);
const loadPanelJudges = inject(CONTEST_JUDGES_KEY, null);
const uploadingIndex = ref<number | null>(null);
const importing = ref(false);
const importNote = ref('');

const heading = computed(() => (typeof props.content.heading === 'string' ? props.content.heading : ''));
const judges = computed<JudgeShowcaseEntry[]>(() =>
  Array.isArray(props.content.judges) ? (props.content.judges as JudgeShowcaseEntry[]) : [],
);

function commit(next: Partial<JudgesShowcaseContent>): void {
  emit('update', { heading: heading.value || undefined, judges: judges.value, ...next });
}
function setHeading(v: string): void {
  commit({ heading: v || undefined });
}
function addJudge(): void {
  commit({ judges: [...judges.value, { name: '' }] });
}
function setJudge(i: number, field: keyof JudgeShowcaseEntry, v: string): void {
  commit({ judges: judges.value.map((j, idx) => (idx === i ? { ...j, [field]: v || undefined } : j)) });
}
function removeJudge(i: number): void {
  commit({ judges: judges.value.filter((_, idx) => idx !== i) });
}
function moveJudge(i: number, dir: -1 | 1): void {
  const j = i + dir;
  if (j < 0 || j >= judges.value.length) return;
  const next = [...judges.value];
  [next[i], next[j]] = [next[j]!, next[i]!];
  commit({ judges: next });
}

async function onFile(i: number, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !uploadHandler) return;
  uploadingIndex.value = i;
  try {
    const res = await uploadHandler(file);
    setJudge(i, 'avatarUrl', res.url);
  } finally {
    uploadingIndex.value = null;
  }
}

async function importPanelJudges(): Promise<void> {
  if (!loadPanelJudges || importing.value) return;
  importing.value = true;
  importNote.value = '';
  try {
    const panel = await loadPanelJudges();
    const have = new Set(judges.value.map((j) => (j.name ?? '').trim().toLowerCase()).filter(Boolean));
    const additions: JudgeShowcaseEntry[] = panel
      .filter((p) => p.name.trim() && !have.has(p.name.trim().toLowerCase()))
      .map((p) => ({ name: p.name, avatarUrl: p.avatarUrl, title: p.title, link: p.link }));
    if (!additions.length) {
      importNote.value = panel.length ? 'All panel judges are already shown.' : 'No panel judges to import yet.';
      return;
    }
    commit({ judges: [...judges.value, ...additions] });
    importNote.value = `Imported ${additions.length} judge${additions.length === 1 ? '' : 's'}. Add photos and titles below.`;
  } catch {
    importNote.value = 'Could not load the judges panel.';
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <div class="cpub-jedit">
    <div class="cpub-jedit-header">
      <div class="cpub-jedit-icon"><i class="fa-solid fa-user-group"></i></div>
      <span class="cpub-jedit-title">Judges Showcase</span>
      <span class="cpub-jedit-count">{{ judges.length }} {{ judges.length === 1 ? 'person' : 'people' }}</span>
      <button
        v-if="loadPanelJudges"
        type="button"
        class="cpub-jedit-add"
        :disabled="importing"
        @click="importPanelJudges"
      >
        <i class="fa-solid fa-user-plus"></i> {{ importing ? 'Importing...' : 'Import panel judges' }}
      </button>
      <button type="button" class="cpub-jedit-add" @click="addJudge"><i class="fa-solid fa-plus"></i> Add person</button>
    </div>

    <div class="cpub-jedit-body">
      <p class="cpub-jedit-explain">
        <i class="fa-solid fa-circle-info"></i>
        These are the curated public faces (custom photos and titles). The scoring panel, who actually
        rate entries, is managed under People. Use Import panel judges to start from that list.
      </p>

      <input
        class="cpub-jedit-input cpub-jedit-heading"
        type="text"
        :value="heading"
        placeholder="Section heading (optional), e.g. Meet the Judges"
        aria-label="Showcase heading"
        @input="setHeading(($event.target as HTMLInputElement).value)"
      />

      <p v-if="importNote" class="cpub-jedit-note" role="status">{{ importNote }}</p>

      <div v-for="(j, i) in judges" :key="i" class="cpub-jedit-row">
        <div class="cpub-jedit-row-main">
          <input class="cpub-jedit-input" type="text" :value="j.name" placeholder="Name" :aria-label="`Person ${i + 1} name`" @input="setJudge(i, 'name', ($event.target as HTMLInputElement).value)" />
          <input class="cpub-jedit-input" type="text" :value="j.title ?? ''" placeholder="Title / affiliation" :aria-label="`Person ${i + 1} title`" @input="setJudge(i, 'title', ($event.target as HTMLInputElement).value)" />
          <button type="button" class="cpub-jedit-iconbtn" :disabled="i === 0" :aria-label="`Move person ${i + 1} up`" @click="moveJudge(i, -1)"><i class="fa-solid fa-arrow-up"></i></button>
          <button type="button" class="cpub-jedit-iconbtn" :disabled="i === judges.length - 1" :aria-label="`Move person ${i + 1} down`" @click="moveJudge(i, 1)"><i class="fa-solid fa-arrow-down"></i></button>
          <button type="button" class="cpub-jedit-remove" :aria-label="`Remove person ${i + 1}`" @click="removeJudge(i)"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div class="cpub-jedit-avatar-row">
          <span class="cpub-jedit-avatar-prev">
            <img v-if="j.avatarUrl" :src="j.avatarUrl" :alt="`${j.name || 'Judge'} photo`" />
            <i v-else class="fa-solid fa-user"></i>
          </span>
          <input class="cpub-jedit-input" type="url" :value="j.avatarUrl ?? ''" placeholder="Photo URL (https://…)" :aria-label="`Person ${i + 1} photo URL`" @input="setJudge(i, 'avatarUrl', ($event.target as HTMLInputElement).value)" />
          <label v-if="uploadHandler" class="cpub-jedit-upload" :class="{ 'cpub-jedit-upload-busy': uploadingIndex === i }">
            <i class="fa-solid" :class="uploadingIndex === i ? 'fa-spinner fa-spin' : 'fa-arrow-up-from-bracket'"></i>
            <span>{{ uploadingIndex === i ? 'Uploading' : 'Upload' }}</span>
            <input type="file" accept="image/*" class="cpub-jedit-file" :aria-label="`Upload photo for person ${i + 1}`" @change="onFile(i, $event)" />
          </label>
        </div>

        <input class="cpub-jedit-input" type="url" :value="j.link ?? ''" placeholder="Profile / link (https://…, optional)" :aria-label="`Person ${i + 1} link`" @input="setJudge(i, 'link', ($event.target as HTMLInputElement).value)" />
        <textarea class="cpub-jedit-input cpub-jedit-bio" rows="2" :value="j.bio ?? ''" placeholder="Short bio (optional)" :aria-label="`Person ${i + 1} bio`" @input="setJudge(i, 'bio', ($event.target as HTMLTextAreaElement).value)" />
      </div>

      <div v-if="!judges.length" class="cpub-jedit-empty" @click="addJudge">
        <i class="fa-solid fa-plus"></i> Add the first judge or mentor
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-jedit { border: var(--border-width-default) solid var(--border2); background: var(--surface); }
.cpub-jedit-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: var(--border-width-default) solid var(--border2); background: var(--surface2); flex-wrap: wrap; }
.cpub-jedit-icon { font-size: 12px; color: var(--accent); }
.cpub-jedit-title { font-size: 12px; font-weight: 600; }
.cpub-jedit-count { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); margin-left: auto; }
.cpub-jedit-add { font-family: var(--font-mono); font-size: 10px; padding: 3px 8px; background: transparent; border: var(--border-width-default) solid var(--border2); color: var(--text-dim); cursor: pointer; display: flex; align-items: center; gap: 4px; margin-left: 8px; }
.cpub-jedit-add:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); background: var(--accent-bg); }
.cpub-jedit-add:disabled { opacity: .5; cursor: default; }

.cpub-jedit-body { padding: 10px 14px; display: flex; flex-direction: column; gap: 10px; }
.cpub-jedit-explain { margin: 0; font-size: 11px; color: var(--text-faint); line-height: 1.5; display: flex; gap: 6px; }
.cpub-jedit-explain i { color: var(--accent); margin-top: 2px; flex-shrink: 0; }
.cpub-jedit-note { margin: 0; font-size: 11px; color: var(--accent); font-family: var(--font-mono); }
.cpub-jedit-input { width: 100%; padding: 6px 8px; font-size: 12px; background: var(--surface); border: var(--border-width-default) solid var(--border); color: var(--text); outline: none; }
.cpub-jedit-input:focus { border-color: var(--accent); }
.cpub-jedit-input::placeholder { color: var(--text-faint); }
.cpub-jedit-heading { font-weight: 600; }
.cpub-jedit-bio { resize: vertical; font-family: inherit; }

.cpub-jedit-row { border: var(--border-width-default) dashed var(--border2); padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.cpub-jedit-row-main { display: flex; gap: 6px; align-items: center; }
.cpub-jedit-row-main .cpub-jedit-input { flex: 1; }
.cpub-jedit-iconbtn { background: none; border: var(--border-width-default) solid var(--border); color: var(--text-faint); cursor: pointer; font-size: 11px; width: 26px; height: 26px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; }
.cpub-jedit-iconbtn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.cpub-jedit-iconbtn:disabled { opacity: .4; cursor: not-allowed; }
.cpub-jedit-remove { background: none; border: var(--border-width-default) solid var(--border); color: var(--text-faint); cursor: pointer; font-size: 11px; padding: 0 8px; flex-shrink: 0; }
.cpub-jedit-remove:hover { border-color: var(--red-border); color: var(--red); }

.cpub-jedit-avatar-row { display: flex; gap: 6px; align-items: center; }
.cpub-jedit-avatar-row .cpub-jedit-input { flex: 1; }
.cpub-jedit-avatar-prev { width: 30px; height: 30px; flex-shrink: 0; border: var(--border-width-default) solid var(--border); background: var(--surface2); display: inline-flex; align-items: center; justify-content: center; color: var(--text-faint); font-size: 12px; overflow: hidden; }
.cpub-jedit-avatar-prev img { width: 100%; height: 100%; object-fit: cover; }
.cpub-jedit-upload { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; padding: 6px 8px; border: var(--border-width-default) solid var(--border2); color: var(--text-dim); cursor: pointer; flex-shrink: 0; white-space: nowrap; }
.cpub-jedit-upload:hover { border-color: var(--accent); color: var(--accent); }
.cpub-jedit-upload-busy { opacity: .7; cursor: default; }
.cpub-jedit-file { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

.cpub-jedit-empty { padding: 20px; text-align: center; font-size: 12px; color: var(--text-faint); cursor: pointer; border: var(--border-width-default) dashed var(--border2); }
.cpub-jedit-empty:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-bg); }
</style>
