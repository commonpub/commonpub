<script setup lang="ts">
/**
 * Read-side renderer for the `roadmap` block — a vertical schedule timeline with a
 * connector line + nodes. Each milestone shows a date, an optional badge, a title,
 * and a blurb; node + date color follow the item's tone (default=hollow accent
 * ring, accent=filled accent, highlight=filled warm "finale"). Registered in
 * BlockContentRenderer's map. All colors via var(--*).
 */
import type { RoadmapItem, RoadmapTone } from '../../types/contestBlocks';

const props = defineProps<{ content: Record<string, unknown> }>();

const eyebrow = computed(() => (typeof props.content.eyebrow === 'string' ? props.content.eyebrow.trim() : ''));
const heading = computed(() => (typeof props.content.heading === 'string' ? props.content.heading.trim() : ''));
const items = computed<RoadmapItem[]>(() =>
  Array.isArray(props.content.items)
    ? (props.content.items as RoadmapItem[]).filter((i) => i && ((i.title ?? '').trim() || (i.date ?? '').trim()))
    : [],
);

const nodeColor = (tone?: RoadmapTone): string => (tone === 'highlight' ? 'var(--yellow)' : 'var(--accent)');
const filled = (tone?: RoadmapTone): boolean => tone === 'accent' || tone === 'highlight';
</script>

<template>
  <section v-if="items.length" class="cpub-rmap">
    <p v-if="eyebrow" class="cpub-rmap-eyebrow"><i class="fa-regular fa-calendar" aria-hidden="true"></i> {{ eyebrow }}</p>
    <h3 v-if="heading" class="cpub-rmap-heading">{{ heading }}</h3>

    <ol class="cpub-rmap-list">
      <li v-for="(item, i) in items" :key="i" class="cpub-rmap-item" :class="`cpub-rmap-${item.tone ?? 'default'}`">
        <div class="cpub-rmap-rail" aria-hidden="true">
          <span class="cpub-rmap-dot" :style="{ borderColor: nodeColor(item.tone), background: filled(item.tone) ? nodeColor(item.tone) : 'var(--bg)' }" />
        </div>
        <div class="cpub-rmap-body">
          <div v-if="(item.date ?? '').trim() || (item.badge ?? '').trim()" class="cpub-rmap-meta">
            <span v-if="(item.date ?? '').trim()" class="cpub-rmap-date" :style="{ color: nodeColor(item.tone) }">{{ item.date }}</span>
            <span v-if="(item.badge ?? '').trim()" class="cpub-rmap-badge">{{ item.badge }}</span>
          </div>
          <p v-if="(item.title ?? '').trim()" class="cpub-rmap-title">{{ item.title }}</p>
          <p v-if="(item.description ?? '').trim()" class="cpub-rmap-desc">{{ item.description }}</p>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.cpub-rmap { margin: var(--space-4) 0; }
.cpub-rmap-eyebrow {
  font-family: var(--font-mono); font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--accent); margin: 0 0 8px; display: flex; align-items: center; gap: 7px;
}
.cpub-rmap-eyebrow i { font-size: 11px; }
.cpub-rmap-heading { font-size: var(--text-lg); font-weight: 700; color: var(--text); margin: 0 0 18px; line-height: 1.3; }

.cpub-rmap-list { list-style: none; margin: 0; padding: 0; }
.cpub-rmap-item { display: grid; grid-template-columns: 18px 1fr; gap: 14px; }
/* The connector line lives on the rail column; it runs from each node down into
   the gap to meet the next, and is trimmed on the last item. */
.cpub-rmap-rail { position: relative; display: flex; justify-content: center; }
.cpub-rmap-rail::before {
  content: ''; position: absolute; top: 4px; bottom: -8px; left: 50%; width: 2px;
  transform: translateX(-50%); background: var(--border);
}
.cpub-rmap-item:last-child .cpub-rmap-rail::before { display: none; }
.cpub-rmap-dot {
  position: relative; z-index: 1; width: 13px; height: 13px; margin-top: 3px; border-radius: 50%;
  border: 2px solid var(--accent); background: var(--bg); box-sizing: border-box; flex-shrink: 0;
}
.cpub-rmap-body { padding-bottom: 22px; min-width: 0; }
.cpub-rmap-item:last-child .cpub-rmap-body { padding-bottom: 0; }
.cpub-rmap-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
.cpub-rmap-date { font-family: var(--font-mono); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
.cpub-rmap-badge {
  font-family: var(--font-mono); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--text-dim); background: var(--surface2); border: var(--border-width-default) solid var(--border2);
  padding: 1px 6px;
}
.cpub-rmap-title { font-size: var(--text-md); font-weight: 700; color: var(--text); margin: 0; line-height: 1.35; }
.cpub-rmap-desc { font-size: var(--text-sm); color: var(--text-dim); line-height: 1.55; margin: 4px 0 0; }

.cpub-rmap-highlight .cpub-rmap-title { color: var(--text); }
</style>
