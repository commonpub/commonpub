<script setup lang="ts">
/**
 * Edit component for the `judgesShowcase` contest block (avatar + name + title +
 * bio cards). Provided to BlockCanvas via BLOCK_COMPONENTS_KEY by the contest
 * editor (2e). Follows the house block-edit contract: `content` in, `update` out,
 * immutable list ops. Avatars are URLs here; 2e can swap to <ImageUpload>.
 */
import type { JudgeShowcaseEntry, JudgesShowcaseContent } from '../../../types/contestBlocks';

const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ update: [content: Record<string, unknown>] }>();

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
</script>

<template>
  <div class="cpub-jedit">
    <div class="cpub-jedit-header">
      <div class="cpub-jedit-icon"><i class="fa-solid fa-user-group"></i></div>
      <span class="cpub-jedit-title">Judges Showcase</span>
      <span class="cpub-jedit-count">{{ judges.length }} {{ judges.length === 1 ? 'person' : 'people' }}</span>
      <button type="button" class="cpub-jedit-add" @click="addJudge"><i class="fa-solid fa-plus"></i> Add person</button>
    </div>

    <div class="cpub-jedit-body">
      <input
        class="cpub-jedit-input cpub-jedit-heading"
        type="text"
        :value="heading"
        placeholder="Section heading (optional), e.g. Meet the Judges"
        aria-label="Showcase heading"
        @input="setHeading(($event.target as HTMLInputElement).value)"
      />

      <div v-for="(j, i) in judges" :key="i" class="cpub-jedit-row">
        <div class="cpub-jedit-row-main">
          <input class="cpub-jedit-input" type="text" :value="j.name" placeholder="Name" :aria-label="`Person ${i + 1} name`" @input="setJudge(i, 'name', ($event.target as HTMLInputElement).value)" />
          <input class="cpub-jedit-input" type="text" :value="j.title ?? ''" placeholder="Title / affiliation" :aria-label="`Person ${i + 1} title`" @input="setJudge(i, 'title', ($event.target as HTMLInputElement).value)" />
          <button type="button" class="cpub-jedit-remove" :aria-label="`Remove person ${i + 1}`" @click="removeJudge(i)"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <input class="cpub-jedit-input" type="url" :value="j.avatarUrl ?? ''" placeholder="Avatar image URL (https://…)" :aria-label="`Person ${i + 1} avatar URL`" @input="setJudge(i, 'avatarUrl', ($event.target as HTMLInputElement).value)" />
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
.cpub-jedit-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: var(--border-width-default) solid var(--border2); background: var(--surface2); }
.cpub-jedit-icon { font-size: 12px; color: var(--accent); }
.cpub-jedit-title { font-size: 12px; font-weight: 600; }
.cpub-jedit-count { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); margin-left: auto; }
.cpub-jedit-add { font-family: var(--font-mono); font-size: 10px; padding: 3px 8px; background: transparent; border: var(--border-width-default) solid var(--border2); color: var(--text-dim); cursor: pointer; display: flex; align-items: center; gap: 4px; margin-left: 8px; }
.cpub-jedit-add:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-bg); }

.cpub-jedit-body { padding: 10px 14px; display: flex; flex-direction: column; gap: 10px; }
.cpub-jedit-input { width: 100%; padding: 6px 8px; font-size: 12px; background: var(--surface); border: var(--border-width-default) solid var(--border); color: var(--text); outline: none; }
.cpub-jedit-input:focus { border-color: var(--accent); }
.cpub-jedit-input::placeholder { color: var(--text-faint); }
.cpub-jedit-heading { font-weight: 600; }
.cpub-jedit-bio { resize: vertical; font-family: inherit; }

.cpub-jedit-row { border: var(--border-width-default) dashed var(--border2); padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.cpub-jedit-row-main { display: flex; gap: 6px; }
.cpub-jedit-row-main .cpub-jedit-input { flex: 1; }
.cpub-jedit-remove { background: none; border: var(--border-width-default) solid var(--border); color: var(--text-faint); cursor: pointer; font-size: 11px; padding: 0 8px; flex-shrink: 0; }
.cpub-jedit-remove:hover { border-color: var(--red-border); color: var(--red); }

.cpub-jedit-empty { padding: 20px; text-align: center; font-size: 12px; color: var(--text-faint); cursor: pointer; border: var(--border-width-default) dashed var(--border2); }
.cpub-jedit-empty:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-bg); }
</style>
