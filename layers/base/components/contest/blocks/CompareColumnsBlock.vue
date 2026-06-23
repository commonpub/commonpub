<script setup lang="ts">
/**
 * Edit component for the `compareColumns` block — side-by-side guidance columns
 * (the "Encouraged / Out of scope" pattern). House block-edit contract: `content`
 * in, `update` out, immutable list ops. Each column has a tone (color), a title,
 * and a list of items; the block also carries an optional eyebrow, heading, and
 * footer note. Provided via BLOCK_COMPONENTS_KEY.
 */
import type { CompareColumn, CompareColumnsContent, CompareTone } from '../../../types/contestBlocks';

const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ update: [content: Record<string, unknown>] }>();

const TONES: { value: CompareTone; label: string }[] = [
  { value: 'positive', label: 'Positive (green)' },
  { value: 'negative', label: 'Negative (red)' },
  { value: 'neutral', label: 'Neutral (accent)' },
];

const eyebrow = computed(() => (typeof props.content.eyebrow === 'string' ? props.content.eyebrow : ''));
const heading = computed(() => (typeof props.content.heading === 'string' ? props.content.heading : ''));
const note = computed(() => (typeof props.content.note === 'string' ? props.content.note : ''));
const columns = computed<CompareColumn[]>(() => (Array.isArray(props.content.columns) ? (props.content.columns as CompareColumn[]) : []));

function commit(next: Partial<CompareColumnsContent>): void {
  emit('update', {
    eyebrow: eyebrow.value || undefined,
    heading: heading.value || undefined,
    note: note.value || undefined,
    columns: columns.value,
    ...next,
  });
}
function patchColumn(ci: number, patch: Partial<CompareColumn>): void {
  commit({ columns: columns.value.map((c, idx) => (idx === ci ? { ...c, ...patch } : c)) });
}
function addColumn(): void {
  commit({ columns: [...columns.value, { tone: 'neutral', title: '', items: [''] }] });
}
function removeColumn(ci: number): void {
  commit({ columns: columns.value.filter((_, idx) => idx !== ci) });
}
function setItem(ci: number, ii: number, value: string): void {
  patchColumn(ci, { items: (columns.value[ci]?.items ?? []).map((it, idx) => (idx === ii ? value : it)) });
}
function addItem(ci: number): void {
  patchColumn(ci, { items: [...(columns.value[ci]?.items ?? []), ''] });
}
function removeItem(ci: number, ii: number): void {
  patchColumn(ci, { items: (columns.value[ci]?.items ?? []).filter((_, idx) => idx !== ii) });
}
</script>

<template>
  <div class="cpub-cmpedit">
    <div class="cpub-cmpedit-header">
      <div class="cpub-cmpedit-icon"><i class="fa-solid fa-table-columns"></i></div>
      <span class="cpub-cmpedit-title">Compare Columns</span>
      <span class="cpub-cmpedit-count">{{ columns.length }} {{ columns.length === 1 ? 'column' : 'columns' }}</span>
      <button type="button" class="cpub-cmpedit-add" @click="addColumn"><i class="fa-solid fa-plus"></i> Add column</button>
    </div>

    <div class="cpub-cmpedit-body">
      <input class="cpub-cmpedit-input" type="text" :value="eyebrow" placeholder="Eyebrow label (optional), e.g. What is in scope" aria-label="Eyebrow label" @input="commit({ eyebrow: ($event.target as HTMLInputElement).value || undefined })" />
      <input class="cpub-cmpedit-input cpub-cmpedit-heading" type="text" :value="heading" placeholder="Heading (optional), e.g. Build to help, not to harm" aria-label="Heading" @input="commit({ heading: ($event.target as HTMLInputElement).value || undefined })" />

      <div class="cpub-cmpedit-cols">
        <div v-for="(c, ci) in columns" :key="ci" class="cpub-cmpedit-col" :class="`cpub-cmpedit-${c.tone}`">
          <div class="cpub-cmpedit-col-head">
            <input class="cpub-cmpedit-input cpub-cmpedit-coltitle" type="text" :value="c.title" placeholder="Column title" :aria-label="`Column ${ci + 1} title`" @input="patchColumn(ci, { title: ($event.target as HTMLInputElement).value })" />
            <select class="cpub-cmpedit-input cpub-cmpedit-tone" :value="c.tone" :aria-label="`Column ${ci + 1} tone`" @change="patchColumn(ci, { tone: ($event.target as HTMLSelectElement).value as CompareTone })">
              <option v-for="t in TONES" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
            <button type="button" class="cpub-cmpedit-remove" :aria-label="`Remove column ${ci + 1}`" @click="removeColumn(ci)"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div v-for="(item, ii) in c.items" :key="ii" class="cpub-cmpedit-itemrow">
            <input class="cpub-cmpedit-input" type="text" :value="item" placeholder="Item" :aria-label="`Column ${ci + 1} item ${ii + 1}`" @input="setItem(ci, ii, ($event.target as HTMLInputElement).value)" />
            <button type="button" class="cpub-cmpedit-itemremove" :aria-label="`Remove item ${ii + 1} from column ${ci + 1}`" @click="removeItem(ci, ii)"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <button type="button" class="cpub-cmpedit-itemadd" @click="addItem(ci)"><i class="fa-solid fa-plus"></i> Add item</button>
        </div>
      </div>

      <div v-if="!columns.length" class="cpub-cmpedit-empty" @click="addColumn"><i class="fa-solid fa-plus"></i> Add the first column</div>

      <input class="cpub-cmpedit-input" type="text" :value="note" placeholder="Footer note (optional)" aria-label="Footer note" @input="commit({ note: ($event.target as HTMLInputElement).value || undefined })" />
    </div>
  </div>
</template>

<style scoped>
.cpub-cmpedit { border: var(--border-width-default) solid var(--border2); background: var(--surface); }
.cpub-cmpedit-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: var(--border-width-default) solid var(--border2); background: var(--surface2); }
.cpub-cmpedit-icon { font-size: 12px; color: var(--accent); }
.cpub-cmpedit-title { font-size: 12px; font-weight: 600; }
.cpub-cmpedit-count { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); margin-left: auto; }
.cpub-cmpedit-add { font-family: var(--font-mono); font-size: 10px; padding: 3px 8px; background: transparent; border: var(--border-width-default) solid var(--border2); color: var(--text-dim); cursor: pointer; display: flex; align-items: center; gap: 4px; margin-left: 8px; }
.cpub-cmpedit-add:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-bg); }

.cpub-cmpedit-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.cpub-cmpedit-input { width: 100%; padding: 6px 8px; font-size: 12px; background: var(--surface); border: var(--border-width-default) solid var(--border); color: var(--text); outline: none; }
.cpub-cmpedit-input:focus { border-color: var(--accent); }
.cpub-cmpedit-input::placeholder { color: var(--text-faint); }
.cpub-cmpedit-heading { font-weight: 600; }

.cpub-cmpedit-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.cpub-cmpedit-col { border: var(--border-width-default) solid var(--border2); border-left-width: 3px; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.cpub-cmpedit-positive { border-left-color: var(--green); }
.cpub-cmpedit-negative { border-left-color: var(--red); }
.cpub-cmpedit-neutral { border-left-color: var(--accent); }
.cpub-cmpedit-col-head { display: flex; gap: 6px; }
.cpub-cmpedit-coltitle { flex: 1; font-weight: 600; }
.cpub-cmpedit-tone { width: 130px; flex-shrink: 0; }
.cpub-cmpedit-itemrow { display: flex; gap: 6px; }
.cpub-cmpedit-itemrow .cpub-cmpedit-input { flex: 1; }
.cpub-cmpedit-remove,
.cpub-cmpedit-itemremove { background: none; border: var(--border-width-default) solid var(--border); color: var(--text-faint); cursor: pointer; font-size: 11px; padding: 0 8px; flex-shrink: 0; }
.cpub-cmpedit-remove:hover,
.cpub-cmpedit-itemremove:hover { border-color: var(--red-border); color: var(--red); }
.cpub-cmpedit-itemadd { align-self: flex-start; font-family: var(--font-mono); font-size: 10px; padding: 3px 8px; background: transparent; border: var(--border-width-default) solid var(--border2); color: var(--text-dim); cursor: pointer; display: flex; align-items: center; gap: 4px; }
.cpub-cmpedit-itemadd:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-bg); }

.cpub-cmpedit-empty { padding: 20px; text-align: center; font-size: 12px; color: var(--text-faint); cursor: pointer; border: var(--border-width-default) dashed var(--border2); }
.cpub-cmpedit-empty:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-bg); }

@media (max-width: 640px) { .cpub-cmpedit-cols { grid-template-columns: 1fr; } }
</style>
