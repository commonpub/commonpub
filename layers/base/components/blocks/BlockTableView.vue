<script setup lang="ts">
/**
 * Read-only view for the `table` block — a responsive data table (header row +
 * body rows). Cells are plain text (rendered via `{{ }}`, so HTML is escaped — no
 * injection surface). Horizontally scrolls on narrow viewports.
 */
const props = defineProps<{
  content: { caption?: string; header?: string[]; rows?: string[][] };
}>();

const header = computed<string[]>(() => (Array.isArray(props.content.header) ? props.content.header : []));
const rows = computed<string[][]>(() => (Array.isArray(props.content.rows) ? props.content.rows : []));
const cols = computed(() => Math.max(header.value.length, ...rows.value.map((r) => r.length), 0));
const hasContent = computed(() => header.value.some((h) => (h ?? '').trim()) || rows.value.length > 0);
</script>

<template>
  <figure v-if="hasContent" class="cpub-tbl">
    <figcaption v-if="content.caption" class="cpub-tbl-caption">{{ content.caption }}</figcaption>
    <div class="cpub-tbl-scroll">
      <table>
        <thead v-if="header.length">
          <tr>
            <th v-for="(h, i) in header" :key="i" scope="col">{{ h }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, r) in rows" :key="r">
            <td v-for="c in cols" :key="c">{{ row[c - 1] ?? '' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </figure>
</template>

<style scoped>
.cpub-tbl { margin: 0 0 18px; }
.cpub-tbl-caption { font-size: 12px; color: var(--text-faint); margin-bottom: 8px; font-style: italic; }
.cpub-tbl-scroll { overflow-x: auto; border: var(--border-width-default) solid var(--border); }
.cpub-tbl table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 420px; }
.cpub-tbl thead th {
  text-align: left; background: var(--surface2); color: var(--text); font-weight: 700;
  font-size: 11px; letter-spacing: 0.03em; text-transform: uppercase;
  padding: 10px 14px; border-bottom: var(--border-width-default) solid var(--border); vertical-align: top;
}
.cpub-tbl tbody td { padding: 10px 14px; border-top: var(--border-width-default) solid var(--border); color: var(--text-dim); vertical-align: top; }
.cpub-tbl tbody tr:first-child td { border-top: none; }
</style>
