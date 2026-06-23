<script setup lang="ts">
/**
 * Edit component for the `roadmap` block — a schedule timeline. House block-edit
 * contract: `content` in, `update` out, immutable list ops. The contest editor
 * provides a roadmap derived from the live stages/schedule under CONTEST_SCHEDULE_KEY,
 * so this offers a one-click "Pull from schedule" seed; from there each milestone
 * (date, title, blurb, badge, tone) is freely edited and reordered. Provided via
 * BLOCK_COMPONENTS_KEY.
 */
import { inject } from 'vue';
import { CONTEST_SCHEDULE_KEY } from '../../../utils/contestBlocks';
import type { RoadmapItem, RoadmapContent, RoadmapTone } from '../../../types/contestBlocks';

const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ update: [content: Record<string, unknown>] }>();

const TONES: { value: RoadmapTone; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'accent', label: 'Accent' },
  { value: 'highlight', label: 'Highlight' },
];

// The contest editor's live schedule (custom stages, else the core flow).
const schedule = inject(CONTEST_SCHEDULE_KEY, null);
const canPull = computed(() => !!schedule?.value?.length);

const eyebrow = computed(() => (typeof props.content.eyebrow === 'string' ? props.content.eyebrow : ''));
const heading = computed(() => (typeof props.content.heading === 'string' ? props.content.heading : ''));
const items = computed<RoadmapItem[]>(() => (Array.isArray(props.content.items) ? (props.content.items as RoadmapItem[]) : []));

function commit(next: Partial<RoadmapContent>): void {
  emit('update', { eyebrow: eyebrow.value || undefined, heading: heading.value || undefined, items: items.value, ...next });
}
function addItem(): void {
  commit({ items: [...items.value, { title: '', tone: 'default' }] });
}
function setItem(i: number, field: keyof RoadmapItem, value: string): void {
  commit({ items: items.value.map((it, idx) => (idx === i ? { ...it, [field]: value || undefined } : it)) });
}
function removeItem(i: number): void {
  commit({ items: items.value.filter((_, idx) => idx !== i) });
}
function move(i: number, dir: -1 | 1): void {
  const j = i + dir;
  if (j < 0 || j >= items.value.length) return;
  const next = [...items.value];
  [next[i], next[j]] = [next[j]!, next[i]!];
  commit({ items: next });
}
function pullFromSchedule(): void {
  commit({ items: (schedule?.value ?? []).map((it) => ({ ...it })) });
}
</script>

<template>
  <div class="cpub-rmedit">
    <div class="cpub-rmedit-header">
      <div class="cpub-rmedit-icon"><i class="fa-solid fa-timeline"></i></div>
      <span class="cpub-rmedit-title">Roadmap</span>
      <span class="cpub-rmedit-count">{{ items.length }} {{ items.length === 1 ? 'milestone' : 'milestones' }}</span>
      <button v-if="canPull" type="button" class="cpub-rmedit-add" title="Seed from this contest's stages / schedule" @click="pullFromSchedule"><i class="fa-solid fa-wand-magic-sparkles"></i> Pull from schedule</button>
      <button type="button" class="cpub-rmedit-add" @click="addItem"><i class="fa-solid fa-plus"></i> Add milestone</button>
    </div>

    <div class="cpub-rmedit-body">
      <input class="cpub-rmedit-input" type="text" :value="eyebrow" placeholder="Eyebrow (optional), e.g. Key dates, 2026" aria-label="Roadmap eyebrow" @input="commit({ eyebrow: ($event.target as HTMLInputElement).value || undefined })" />
      <input class="cpub-rmedit-input cpub-rmedit-heading" type="text" :value="heading" placeholder="Heading (optional), e.g. The 18-week roadmap" aria-label="Roadmap heading" @input="commit({ heading: ($event.target as HTMLInputElement).value || undefined })" />

      <div v-for="(it, i) in items" :key="i" class="cpub-rmedit-row" :class="`cpub-rmedit-${it.tone ?? 'default'}`">
        <div class="cpub-rmedit-rowtop">
          <input class="cpub-rmedit-input cpub-rmedit-date" type="text" :value="it.date ?? ''" placeholder="Date, e.g. Jun 30" :aria-label="`Milestone ${i + 1} date`" @input="setItem(i, 'date', ($event.target as HTMLInputElement).value)" />
          <input class="cpub-rmedit-input cpub-rmedit-badge" type="text" :value="it.badge ?? ''" placeholder="Badge (optional)" :aria-label="`Milestone ${i + 1} badge`" @input="setItem(i, 'badge', ($event.target as HTMLInputElement).value)" />
          <select class="cpub-rmedit-input cpub-rmedit-tone" :value="it.tone ?? 'default'" :aria-label="`Milestone ${i + 1} style`" @change="setItem(i, 'tone', ($event.target as HTMLSelectElement).value)">
            <option v-for="t in TONES" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
          <div class="cpub-rmedit-moves">
            <button type="button" class="cpub-rmedit-move" :disabled="i === 0" :aria-label="`Move milestone ${i + 1} up`" @click="move(i, -1)"><i class="fa-solid fa-chevron-up"></i></button>
            <button type="button" class="cpub-rmedit-move" :disabled="i === items.length - 1" :aria-label="`Move milestone ${i + 1} down`" @click="move(i, 1)"><i class="fa-solid fa-chevron-down"></i></button>
          </div>
          <button type="button" class="cpub-rmedit-remove" :aria-label="`Remove milestone ${i + 1}`" @click="removeItem(i)"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <input class="cpub-rmedit-input" type="text" :value="it.title" placeholder="Title" :aria-label="`Milestone ${i + 1} title`" @input="setItem(i, 'title', ($event.target as HTMLInputElement).value)" />
        <textarea class="cpub-rmedit-input cpub-rmedit-desc" rows="2" :value="it.description ?? ''" placeholder="Description (optional)" :aria-label="`Milestone ${i + 1} description`" @input="setItem(i, 'description', ($event.target as HTMLTextAreaElement).value)" />
      </div>

      <div v-if="!items.length" class="cpub-rmedit-empty" @click="canPull ? pullFromSchedule() : addItem()">
        <i class="fa-solid fa-plus"></i> {{ canPull ? 'Pull milestones from the schedule' : 'Add the first milestone' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-rmedit { border: var(--border-width-default) solid var(--border2); background: var(--surface); }
.cpub-rmedit-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: var(--border-width-default) solid var(--border2); background: var(--surface2); flex-wrap: wrap; }
.cpub-rmedit-icon { font-size: 12px; color: var(--accent); }
.cpub-rmedit-title { font-size: 12px; font-weight: 600; }
.cpub-rmedit-count { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); margin-left: auto; }
.cpub-rmedit-add { font-family: var(--font-mono); font-size: 10px; padding: 3px 8px; background: transparent; border: var(--border-width-default) solid var(--border2); color: var(--text-dim); cursor: pointer; display: flex; align-items: center; gap: 4px; }
.cpub-rmedit-add:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-bg); }

.cpub-rmedit-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.cpub-rmedit-input { width: 100%; padding: 6px 8px; font-size: 12px; background: var(--surface); border: var(--border-width-default) solid var(--border); color: var(--text); outline: none; }
.cpub-rmedit-input:focus { border-color: var(--accent); }
.cpub-rmedit-input::placeholder { color: var(--text-faint); }
.cpub-rmedit-heading { font-weight: 600; }
.cpub-rmedit-desc { resize: vertical; font-family: inherit; }

.cpub-rmedit-row { border: var(--border-width-default) solid var(--border2); border-left-width: 3px; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.cpub-rmedit-default { border-left-color: var(--border2); }
.cpub-rmedit-accent { border-left-color: var(--accent); }
.cpub-rmedit-highlight { border-left-color: var(--yellow); }
.cpub-rmedit-rowtop { display: flex; gap: 6px; align-items: center; }
.cpub-rmedit-date { width: 110px; flex-shrink: 0; }
.cpub-rmedit-badge { flex: 1; min-width: 0; }
.cpub-rmedit-tone { width: 100px; flex-shrink: 0; }
.cpub-rmedit-moves { display: inline-flex; flex-shrink: 0; }
.cpub-rmedit-move { background: none; border: var(--border-width-default) solid var(--border); color: var(--text-faint); cursor: pointer; font-size: 9px; padding: 0 6px; }
.cpub-rmedit-move:first-child { border-right: 0; }
.cpub-rmedit-move:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.cpub-rmedit-move:disabled { opacity: 0.4; cursor: not-allowed; }
.cpub-rmedit-remove { background: none; border: var(--border-width-default) solid var(--border); color: var(--text-faint); cursor: pointer; font-size: 11px; padding: 0 8px; flex-shrink: 0; }
.cpub-rmedit-remove:hover { border-color: var(--red-border); color: var(--red); }

.cpub-rmedit-empty { padding: 20px; text-align: center; font-size: 12px; color: var(--text-faint); cursor: pointer; border: var(--border-width-default) dashed var(--border2); }
.cpub-rmedit-empty:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-bg); }
</style>
