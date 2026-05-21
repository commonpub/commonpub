<script setup lang="ts">
interface Part {
  name: string;
  qty?: number;
  quantity?: number;
  price?: number;
  notes?: string;
  url?: string;
  required?: boolean;
}

const props = defineProps<{ content: Record<string, unknown> }>();

const parts = computed<Part[]>(() => {
  const raw = props.content.parts;
  if (!Array.isArray(raw)) return [];
  return raw as Part[];
});

const totalPrice = computed(() => {
  return parts.value.reduce((sum, p) => sum + (p.price ?? 0) * ((p.qty ?? p.quantity) ?? 1), 0);
});
</script>

<template>
  <div v-if="parts.length > 0" class="cpub-block-parts">
    <div class="cpub-parts-header">
      <i class="fa-solid fa-list-check cpub-parts-icon"></i>
      <span class="cpub-parts-title">Parts List</span>
      <span class="cpub-parts-count">
        {{ parts.length }} item{{ parts.length !== 1 ? 's' : '' }}
        <template v-if="totalPrice > 0"> · ${{ totalPrice.toFixed(2) }} est.</template>
      </span>
    </div>
    <table class="cpub-parts-table">
      <thead>
        <tr>
          <th>Component</th>
          <th class="cpub-col-qty">Qty</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(part, idx) in parts" :key="idx">
          <td class="cpub-part-name">
            <a v-if="part.url" :href="part.url" target="_blank" rel="noopener">{{ part.name }}</a>
            <span v-else>{{ part.name || 'Unknown' }}</span>
          </td>
          <td class="cpub-col-qty">{{ (part.qty ?? part.quantity) ?? 1 }}</td>
          <td class="cpub-part-notes">{{ part.notes || '—' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.cpub-block-parts {
  border: var(--border-width-default) solid var(--border);
  margin: 24px 0;
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.cpub-parts-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--surface2);
  border-bottom: var(--border-width-default) solid var(--border);
  /* Reset universal *,::before,::after{border-radius:var(--radius)} so the
     dark header tiles flush against the table below on themes with
     non-zero --radius (deveco). See BlockCodeView for the full pattern. */
  border-radius: 0;
}

.cpub-parts-icon { font-size: 12px; color: var(--accent); }
.cpub-parts-title { font-size: 12px; font-weight: 600; color: var(--text); }
.cpub-parts-count { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); margin-left: auto; }

.cpub-parts-table { width: 100%; border-collapse: collapse; }

/* Reset the global `.cpub-prose th` rule from prose.css that puts a
   1px border on every <th>. With `border-collapse: collapse`, those
   borders merge into thin lines that visually split the dark header
   row into separate "rounded gap" boxes against the var(--text)
   background. The container's outer border already frames the row;
   internal cell borders are not wanted (heatsynclabs.io report,
   2026-05-21). Use !important to beat the global rule (specificity
   0,2,0 vs 0,1,1 would normally win, but the global rule sets
   `border` which the scoped rule doesn't, so it leaks through). */
.cpub-parts-table th {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-align: left;
  padding: 8px 12px;
  background: var(--text);
  color: var(--surface);
  border: 0 !important;
  /* Universal radius leak — sharp cells tile flush with no rounded gaps
     between them on themes with non-zero --radius. */
  border-radius: 0;
}

.cpub-parts-table td {
  padding: 10px 12px;
  border: 0;
  border-bottom: var(--border-width-default) solid var(--border2);
  font-size: 13px;
  color: var(--text-dim);
  border-radius: 0;
}

.cpub-part-name { font-weight: 500; color: var(--text); }
.cpub-part-name a { color: var(--accent); text-decoration: none; }
.cpub-part-name a:hover { text-decoration: underline; }
.cpub-col-qty { width: 50px; text-align: center; font-family: var(--font-mono); font-size: 12px; }
.cpub-part-notes { font-size: 12px; color: var(--text-faint); }
</style>
