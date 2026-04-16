<script setup lang="ts">
import type { HomepageSectionConfig } from '@commonpub/server';

const props = defineProps<{ config: HomepageSectionConfig }>();

const limit = computed(() => props.config.limit ?? 3);
const { data: contests } = await useFetch('/api/contests', { query: { limit }, lazy: true });
</script>

<template>
  <div v-if="contests?.items?.length" class="cpub-sb-card">
    <div class="cpub-sb-head">Active Contests <NuxtLink to="/contests">View all</NuxtLink></div>
    <div v-for="c in contests.items" :key="c.id" class="cpub-contest-item">
      <NuxtLink :to="`/contests/${c.slug}`" class="cpub-contest-name">{{ c.title }}</NuxtLink>
      <div class="cpub-contest-row">
        <span class="cpub-contest-entries">{{ c.entryCount ?? 0 }} entries</span>
        <span v-if="c.endDate" class="cpub-contest-deadline">
          <i class="fa-regular fa-clock"></i> {{ Math.max(0, Math.ceil((new Date(c.endDate).getTime() - Date.now()) / 86400000)) }}d left
        </span>
      </div>
      <NuxtLink :to="`/contests/${c.slug}`" class="cpub-btn-enter">Enter Contest</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.cpub-sb-card { background: var(--surface); border: var(--border-width-default) solid var(--border); padding: 16px; margin-bottom: 16px; }
.cpub-sb-head { font-family: var(--font-mono); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-faint); padding-bottom: 10px; border-bottom: var(--border-width-default) solid var(--border2); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
.cpub-sb-head a { color: var(--accent); text-decoration: none; font-size: 10px; }
.cpub-contest-item { padding: 8px 0; border-bottom: var(--border-width-default) solid var(--border2); }
.cpub-contest-item:last-child { border-bottom: none; }
.cpub-contest-name { font-size: 13px; font-weight: 600; color: var(--text); text-decoration: none; display: block; margin-bottom: 4px; }
.cpub-contest-name:hover { color: var(--accent); }
.cpub-contest-row { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.cpub-contest-entries { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); }
.cpub-contest-deadline { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); display: flex; align-items: center; gap: 4px; }
.cpub-btn-enter { font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; padding: 4px 10px; border: var(--border-width-default) solid var(--accent); color: var(--accent); text-decoration: none; display: inline-block; }
.cpub-btn-enter:hover { background: var(--accent-bg); }
</style>
