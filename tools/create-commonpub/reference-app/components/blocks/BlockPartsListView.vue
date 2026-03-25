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
  border: 2px solid var(--border);
  margin: 24px 0;
  overflow: hidden;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-parts-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--surface2);
  border-bottom: 2px solid var(--border);
}

.cpub-parts-icon { font-size: 12px; color: var(--accent); }
.cpub-parts-title { font-size: 12px; font-weight: 600; color: var(--text); }
.cpub-parts-count { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); margin-left: auto; }

.cpub-parts-table { width: 100%; border-collapse: collapse; }

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
}

.cpub-parts-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border2);
  font-size: 13px;
  color: var(--text-dim);
}

.cpub-part-name { font-weight: 500; color: var(--text); }
.cpub-part-name a { color: var(--accent); text-decoration: none; }
.cpub-part-name a:hover { text-decoration: underline; }
.cpub-col-qty { width: 50px; text-align: center; font-family: var(--font-mono); font-size: 12px; }
.cpub-part-notes { font-size: 12px; color: var(--text-faint); }
</style>
