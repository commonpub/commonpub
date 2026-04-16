<script setup lang="ts">
import type { HomepageSectionConfig } from '@commonpub/server';

defineProps<{ config: HomepageSectionConfig }>();

const { contests: contestsEnabled } = useFeatures();
const { data: contests } = await useFetch('/api/contests', { query: { limit: 3 }, lazy: true });

const activeContest = computed(() => {
  const items = (contests.value as { items?: Array<Record<string, unknown>> })?.items;
  return items?.find((c) => c.status === 'active') ?? null;
});

const heroDismissed = ref(false);
</script>

<template>
  <section v-if="!heroDismissed" class="cpub-hero-banner">
    <div class="cpub-hero-grid-bg" />
    <div class="cpub-hero-gradient" />
    <button class="cpub-hero-dismiss" title="Dismiss" @click="heroDismissed = true">
      <i class="fa-solid fa-xmark"></i>
    </button>
    <div class="cpub-hero-inner">
      <div class="cpub-hero-content">
        <template v-if="contestsEnabled && activeContest">
          <div class="cpub-hero-eyebrow">
            <span class="cpub-hero-badge cpub-hero-badge-live"><span class="cpub-live-dot" /> Live Contest</span>
            <span class="cpub-hero-badge">{{ activeContest.entryCount ?? 0 }} entries</span>
          </div>
          <h1 class="cpub-hero-title">{{ activeContest.title }}</h1>
          <p v-if="activeContest.description" class="cpub-hero-excerpt">{{ activeContest.description }}</p>
          <div class="cpub-hero-actions">
            <NuxtLink :to="`/contests/${activeContest.slug}`" class="cpub-btn cpub-btn-primary"><i class="fa-solid fa-trophy"></i> Enter Contest</NuxtLink>
            <NuxtLink :to="`/contests/${activeContest.slug}`" class="cpub-btn"><i class="fa-solid fa-circle-info"></i> View Details</NuxtLink>
          </div>
        </template>
        <template v-else>
          <div class="cpub-hero-eyebrow">
            <span class="cpub-hero-badge cpub-hero-badge-live"><span class="cpub-live-dot" /> Open Source</span>
          </div>
          <h1 class="cpub-hero-title">Build. Document.<br><span>Share.</span></h1>
          <p class="cpub-hero-excerpt">
            CommonPub is an open platform for maker communities. Document your builds with rich editors, join hubs, learn with structured paths, and share with the world.
          </p>
          <div class="cpub-hero-actions">
            <NuxtLink to="/create" class="cpub-btn cpub-btn-primary"><i class="fa-solid fa-plus"></i> Start Building</NuxtLink>
            <NuxtLink to="/explore" class="cpub-btn"><i class="fa-solid fa-compass"></i> Explore</NuxtLink>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cpub-hero-banner { position: relative; background: var(--surface); border-bottom: var(--border-width-default) solid var(--border); overflow: hidden; min-height: 200px; display: flex; align-items: stretch; }
.cpub-hero-grid-bg { position: absolute; inset: 0; background-image: linear-gradient(var(--border2) 1px, transparent 1px), linear-gradient(90deg, var(--border2) 1px, transparent 1px); background-size: 32px 32px; opacity: 0.25; }
.cpub-hero-gradient { position: absolute; inset: 0; background: var(--surface2); opacity: 0.5; }
.cpub-hero-dismiss { position: absolute; top: 12px; right: 16px; background: transparent; border: none; color: var(--text-faint); font-size: 12px; cursor: pointer; padding: 4px; z-index: 2; }
.cpub-hero-dismiss:hover { color: var(--text-dim); }
.cpub-hero-inner { position: relative; z-index: 1; max-width: 1280px; margin: 0 auto; padding: 36px 32px; width: 100%; display: flex; align-items: center; gap: 48px; }
.cpub-hero-content { flex: 1; }
.cpub-hero-eyebrow { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.cpub-hero-badge { font-size: 9px; font-family: var(--font-mono); letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 9px; background: var(--yellow-bg); border: var(--border-width-default) solid var(--yellow); color: var(--yellow); }
.cpub-hero-badge-live { background: var(--green-bg); border-color: var(--green); color: var(--green); display: flex; align-items: center; gap: 5px; }
.cpub-live-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--green); animation: cpub-pulse 2s ease-in-out infinite; }
@keyframes cpub-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.cpub-hero-title { font-size: 22px; font-weight: 700; line-height: 1.25; margin-bottom: 10px; }
.cpub-hero-title span { color: var(--accent); }
.cpub-hero-excerpt { font-size: 13px; color: var(--text-dim); line-height: 1.65; margin-bottom: 20px; max-width: 560px; }
.cpub-hero-actions { display: flex; gap: 8px; }
</style>
