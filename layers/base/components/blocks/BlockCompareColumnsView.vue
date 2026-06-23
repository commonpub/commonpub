<script setup lang="ts">
/**
 * Read-side renderer for the `compareColumns` block — side-by-side guidance
 * columns (the "Encouraged / Out of scope" do-vs-don't pattern). Each column is
 * tinted by its tone (positive=green, negative=red, neutral=accent) with a matching
 * header + per-item icon, plus an optional eyebrow, heading, and footer note.
 * Registered in BlockContentRenderer's map. All colors via var(--*).
 */
import type { CompareColumn, CompareTone } from '../../types/contestBlocks';

const props = defineProps<{ content: Record<string, unknown> }>();

const eyebrow = computed(() => (typeof props.content.eyebrow === 'string' ? props.content.eyebrow.trim() : ''));
const heading = computed(() => (typeof props.content.heading === 'string' ? props.content.heading.trim() : ''));
const note = computed(() => (typeof props.content.note === 'string' ? props.content.note.trim() : ''));
const columns = computed<CompareColumn[]>(() =>
  Array.isArray(props.content.columns)
    ? (props.content.columns as CompareColumn[])
        .filter((c) => c && (c.title?.trim() || (c.items ?? []).some((i) => (i ?? '').trim())))
        .map((c) => ({ tone: c.tone ?? 'neutral', title: (c.title ?? '').trim(), items: (c.items ?? []).filter((i) => (i ?? '').trim()) }))
    : [],
);

const toneIcon = (tone: CompareTone): string =>
  tone === 'positive' ? 'fa-circle-check' : tone === 'negative' ? 'fa-circle-xmark' : 'fa-circle-info';
</script>

<template>
  <section v-if="columns.length" class="cpub-cmp">
    <p v-if="eyebrow" class="cpub-cmp-eyebrow"><i class="fa-solid fa-circle-dot" aria-hidden="true"></i> {{ eyebrow }}</p>
    <h3 v-if="heading" class="cpub-cmp-heading">{{ heading }}</h3>

    <div class="cpub-cmp-grid" :style="{ '--cpub-cmp-cols': Math.min(columns.length, 3) }">
      <div v-for="(c, ci) in columns" :key="ci" class="cpub-cmp-col" :class="`cpub-cmp-${c.tone}`">
        <p class="cpub-cmp-col-head"><i class="fa-solid" :class="toneIcon(c.tone)" aria-hidden="true"></i> {{ c.title }}</p>
        <ul class="cpub-cmp-list">
          <li v-for="(item, ii) in c.items" :key="ii" class="cpub-cmp-item">
            <i class="fa-solid cpub-cmp-item-icon" :class="toneIcon(c.tone)" aria-hidden="true"></i>
            <span>{{ item }}</span>
          </li>
        </ul>
      </div>
    </div>

    <p v-if="note" class="cpub-cmp-note"><i class="fa-regular fa-circle-question" aria-hidden="true"></i> {{ note }}</p>
  </section>
</template>

<style scoped>
.cpub-cmp { margin: var(--space-4) 0; }
.cpub-cmp-eyebrow {
  font-family: var(--font-mono); font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--accent); margin: 0 0 8px; display: flex; align-items: center; gap: 7px;
}
.cpub-cmp-eyebrow i { font-size: 8px; }
.cpub-cmp-heading { font-size: var(--text-lg); font-weight: 700; color: var(--text); margin: 0 0 16px; line-height: 1.3; }

.cpub-cmp-grid { display: grid; grid-template-columns: repeat(var(--cpub-cmp-cols, 2), 1fr); gap: 16px; }

.cpub-cmp-col {
  border: var(--border-width-default) solid var(--border); border-radius: var(--radius);
  padding: 16px 18px; background: var(--surface);
}
/* Tone tints — left accent edge + tinted surface, mirroring the callout family. */
.cpub-cmp-positive { background: var(--green-bg); border-color: var(--green-border); }
.cpub-cmp-negative { background: var(--red-bg); border-color: var(--red-border); }
.cpub-cmp-neutral { background: var(--accent-bg); border-color: var(--accent-border); }

.cpub-cmp-col-head {
  display: flex; align-items: center; gap: 8px; margin: 0 0 12px;
  font-size: var(--text-sm); font-weight: 700;
}
.cpub-cmp-positive .cpub-cmp-col-head { color: var(--green); }
.cpub-cmp-negative .cpub-cmp-col-head { color: var(--red); }
.cpub-cmp-neutral .cpub-cmp-col-head { color: var(--accent); }

.cpub-cmp-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.cpub-cmp-item { display: flex; gap: 9px; font-size: var(--text-sm); line-height: 1.55; color: var(--text-dim); }
.cpub-cmp-item-icon { flex-shrink: 0; margin-top: 3px; font-size: 12px; }
.cpub-cmp-positive .cpub-cmp-item-icon { color: var(--green); }
.cpub-cmp-negative .cpub-cmp-item-icon { color: var(--red); }
.cpub-cmp-neutral .cpub-cmp-item-icon { color: var(--accent); }

.cpub-cmp-note {
  margin: 16px 0 0; padding: 12px 14px; font-size: var(--text-sm); color: var(--text-dim); line-height: 1.55;
  background: var(--surface2); border: var(--border-width-default) solid var(--border);
  border-radius: var(--radius); display: flex; gap: 9px; align-items: baseline;
}
.cpub-cmp-note i { color: var(--text-faint); flex-shrink: 0; }

@media (max-width: 640px) { .cpub-cmp-grid { grid-template-columns: 1fr; } }
</style>
