<script setup lang="ts">
/**
 * Read-side renderer for the `judgesShowcase` contest block — avatar + name +
 * title + bio cards for the contest overview. Registered in BlockContentRenderer's
 * map; receives the block content object as `content`. All colors via var(--*).
 */
import type { JudgesShowcaseContent, JudgeShowcaseEntry } from '../../types/contestBlocks';

const props = defineProps<{ content: Record<string, unknown> }>();

const heading = computed(() => (typeof props.content.heading === 'string' ? props.content.heading.trim() : ''));
const judges = computed<JudgeShowcaseEntry[]>(() =>
  Array.isArray(props.content.judges) ? (props.content.judges as JudgeShowcaseEntry[]).filter((j) => j && j.name) : [],
);

const initial = (name: string): string => (name || '?').charAt(0).toUpperCase();
const safeLink = (link?: string): string | undefined => (link && /^https?:\/\//i.test(link) ? link : undefined);
</script>

<template>
  <div v-if="judges.length" class="cpub-jshow">
    <h3 v-if="heading" class="cpub-jshow-heading">{{ heading }}</h3>
    <div class="cpub-jshow-grid">
      <div v-for="(j, i) in judges" :key="i" class="cpub-jshow-card">
        <div class="cpub-jshow-av">
          <img v-if="j.avatarUrl" :src="j.avatarUrl" :alt="j.name" class="cpub-jshow-av-img" />
          <span v-else>{{ initial(j.name) }}</span>
        </div>
        <a v-if="safeLink(j.link)" :href="safeLink(j.link)" target="_blank" rel="noopener noreferrer" class="cpub-jshow-name">{{ j.name }}</a>
        <span v-else class="cpub-jshow-name">{{ j.name }}</span>
        <div v-if="j.title" class="cpub-jshow-title">{{ j.title }}</div>
        <p v-if="j.bio" class="cpub-jshow-bio">{{ j.bio }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-jshow { margin: var(--space-4) 0; }
.cpub-jshow-heading { font-size: var(--text-md); font-weight: var(--font-weight-bold); margin: 0 0 var(--space-3); color: var(--text); }
.cpub-jshow-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); }
.cpub-jshow-card { background: var(--surface); border: var(--border-width-default) solid var(--border); border-radius: var(--radius); padding: var(--space-4); text-align: center; box-shadow: var(--shadow-md); }
.cpub-jshow-av { width: 64px; height: 64px; border-radius: 50%; margin: 0 auto var(--space-2); display: flex; align-items: center; justify-content: center; font-size: var(--text-lg); font-weight: 700; font-family: var(--font-mono); border: var(--border-width-default) solid var(--border); background: var(--surface3); color: var(--text-dim); overflow: hidden; }
.cpub-jshow-av-img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
.cpub-jshow-name { font-size: var(--text-sm); font-weight: 600; color: var(--text); text-decoration: none; display: block; }
a.cpub-jshow-name:hover { color: var(--accent); }
.cpub-jshow-title { font-family: var(--font-mono); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .06em; color: var(--text-faint); margin-top: 3px; }
.cpub-jshow-bio { font-size: var(--text-sm); color: var(--text-dim); line-height: 1.6; margin: var(--space-2) 0 0; }

@media (max-width: 768px) { .cpub-jshow-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 480px) { .cpub-jshow-grid { grid-template-columns: 1fr; } }
</style>
