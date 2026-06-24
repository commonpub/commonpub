<script setup lang="ts">
/**
 * Edit component for the `table` block — an editable grid (header row + body
 * rows) with add/remove row + column. Cells are plain strings (rendered as text
 * in the view, so no HTML injection). House block-edit contract: `content` in,
 * `update` out. Provided via BLOCK_COMPONENTS_KEY.
 */
const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ update: [content: Record<string, unknown>] }>();

const caption = computed(() => (typeof props.content.caption === 'string' ? props.content.caption : ''));
const header = computed<string[]>(() => (Array.isArray(props.content.header) ? (props.content.header as string[]) : ['Column 1', 'Column 2']));
const rows = computed<string[][]>(() => (Array.isArray(props.content.rows) ? (props.content.rows as string[][]) : [['', '']]));

function commit(next: Partial<{ caption: string; header: string[]; rows: string[][] }>): void {
  emit('update', { caption: caption.value || undefined, header: header.value, rows: rows.value, ...next });
}
function setHeader(c: number, v: string): void {
  commit({ header: header.value.map((h, i) => (i === c ? v : h)) });
}
function setCell(r: number, c: number, v: string): void {
  commit({ rows: rows.value.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row)) });
}
function addColumn(): void {
  commit({ header: [...header.value, `Column ${header.value.length + 1}`], rows: rows.value.map((row) => [...row, '']) });
}
function removeColumn(c: number): void {
  if (header.value.length <= 1) return;
  commit({ header: header.value.filter((_, i) => i !== c), rows: rows.value.map((row) => row.filter((_, i) => i !== c)) });
}
function addRow(): void {
  commit({ rows: [...rows.value, header.value.map(() => '')] });
}
function removeRow(r: number): void {
  commit({ rows: rows.value.filter((_, i) => i !== r) });
}
</script>

<template>
  <div class="cpub-tedit">
    <div class="cpub-tedit-header">
      <div class="cpub-tedit-icon"><i class="fa-solid fa-table"></i></div>
      <span class="cpub-tedit-title">Table</span>
      <button type="button" class="cpub-tedit-act" @click="addColumn"><i class="fa-solid fa-plus"></i> Column</button>
      <button type="button" class="cpub-tedit-act" @click="addRow"><i class="fa-solid fa-plus"></i> Row</button>
    </div>

    <div class="cpub-tedit-body">
      <input class="cpub-tedit-input cpub-tedit-caption" type="text" :value="caption" placeholder="Caption (optional)" aria-label="Table caption" @input="commit({ caption: ($event.target as HTMLInputElement).value || undefined })" />

      <div class="cpub-tedit-scroll">
        <table class="cpub-tedit-grid">
          <thead>
            <tr>
              <th v-for="(h, c) in header" :key="c" class="cpub-tedit-th">
                <input class="cpub-tedit-input cpub-tedit-hcell" type="text" :value="h" :placeholder="`Column ${c + 1}`" :aria-label="`Header ${c + 1}`" @input="setHeader(c, ($event.target as HTMLInputElement).value)" />
                <button type="button" class="cpub-tedit-del" :disabled="header.length <= 1" :aria-label="`Remove column ${c + 1}`" title="Remove column" @click="removeColumn(c)"><i class="fa-solid fa-xmark"></i></button>
              </th>
              <th class="cpub-tedit-rowspacer" aria-hidden="true"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, r) in rows" :key="r">
              <td v-for="(_, c) in header" :key="c">
                <input class="cpub-tedit-input" type="text" :value="row[c] ?? ''" :aria-label="`Row ${r + 1} column ${c + 1}`" @input="setCell(r, c, ($event.target as HTMLInputElement).value)" />
              </td>
              <td class="cpub-tedit-rowdel">
                <button type="button" class="cpub-tedit-del" :aria-label="`Remove row ${r + 1}`" title="Remove row" @click="removeRow(r)"><i class="fa-solid fa-xmark"></i></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-tedit { border: var(--border-width-default) solid var(--border2); background: var(--surface); }
.cpub-tedit-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: var(--border-width-default) solid var(--border2); background: var(--surface2); }
.cpub-tedit-icon { font-size: 12px; color: var(--accent); }
.cpub-tedit-title { font-size: 12px; font-weight: 600; margin-right: auto; }
.cpub-tedit-act { font-family: var(--font-mono); font-size: 10px; padding: 3px 8px; background: transparent; border: var(--border-width-default) solid var(--border2); color: var(--text-dim); cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
.cpub-tedit-act:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-bg); }
.cpub-tedit-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.cpub-tedit-input { width: 100%; padding: 6px 8px; font-size: 12px; background: var(--surface); border: var(--border-width-default) solid var(--border); color: var(--text); outline: none; }
.cpub-tedit-input:focus { border-color: var(--accent); }
.cpub-tedit-input::placeholder { color: var(--text-faint); }
.cpub-tedit-caption { font-style: italic; }
.cpub-tedit-scroll { overflow-x: auto; }
.cpub-tedit-grid { border-collapse: collapse; }
.cpub-tedit-th { padding: 0 4px 6px 0; vertical-align: bottom; }
.cpub-tedit-hcell { font-weight: 700; min-width: 120px; }
.cpub-tedit-grid td { padding: 0 4px 4px 0; }
.cpub-tedit-grid td .cpub-tedit-input { min-width: 120px; }
.cpub-tedit-del { background: none; border: var(--border-width-default) solid var(--border); color: var(--text-faint); cursor: pointer; font-size: 10px; padding: 4px 6px; margin-top: 3px; }
.cpub-tedit-del:hover:not(:disabled) { border-color: var(--red-border); color: var(--red-text); }
.cpub-tedit-del:disabled { opacity: 0.35; cursor: not-allowed; }
.cpub-tedit-rowspacer { width: 28px; }
.cpub-tedit-rowdel { width: 28px; text-align: center; }
</style>
