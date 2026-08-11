<script setup lang="ts">
import type { HomepageSectionConfig } from '@commonpub/server';

const props = defineProps<{ config: HomepageSectionConfig }>();

const limit = computed(() => props.config.limit ?? 3);
// Only surface contests that are open for entries — the card is titled
// "Active Contests" and links to "Enter Contest".
// NOT lazy — see HeroSection: a race on whether SSR had the data made the server
// render a different set of contests than the client expected.
const { data: contests } = await useFetch('/api/contests', {
  query: computed(() => ({ limit: limit.value, status: 'active' })),
});

// "Nd left" is clock-dependent, so the server and the viewer can land either side
// of a day boundary. Render it only after mount (the same guard ContestHero uses
// for its countdown) so SSR and the first client render always agree.
const mounted = ref(false);
onMounted(() => { mounted.value = true; });
function daysLeftLabel(c: { currentStageEndDate?: string | null; endDate?: string | null }): string | null {
  const target = c.currentStageEndDate ?? c.endDate;
  if (!target) return null;
  const ms = new Date(target).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return `${Math.max(0, Math.ceil(ms / 86_400_000))}d left`;
}

// Dedupe against the hero: if the hero is already showing an active contest as a
// full callout, don't repeat it here. Other active contests still list.
const heroContestId = useState<string | null>('cpub:hero-contest-id', () => null);
interface ContestCard { id: string; slug: string; title: string; entryCount?: number; followerCount?: number; endDate?: string | null; currentStageEndDate?: string | null }
const visibleContests = computed(() => {
  const items = (contests.value?.items ?? []) as ContestCard[];
  // Dedupe only AFTER hydration. `heroContestId` is published by a sibling
  // component's watchEffect, and whether that has run by the time this section
  // renders differs between the server and the client — so filtering during SSR
  // made the server emit a list shifted by one against the client's, showing up
  // as mismatched contest links. Costs a brief duplicate on first paint; the
  // alternative is the server rendering links the client then replaces.
  const deduped = mounted.value ? items.filter((c) => c.id !== heroContestId.value) : items;
  return deduped.map((c) => ({ ...c, daysLeft: mounted.value ? daysLeftLabel(c) : null }));
});
</script>

<template>
  <div v-if="visibleContests.length" class="cpub-sb-card">
    <div class="cpub-sb-head">Active Contests <NuxtLink to="/contests">View all</NuxtLink></div>
    <div v-for="c in visibleContests" :key="c.id" class="cpub-contest-item">
      <NuxtLink :to="`/contests/${c.slug}`" class="cpub-contest-name">{{ c.title }}</NuxtLink>
      <div class="cpub-contest-row">
        <span class="cpub-contest-entries">{{ c.entryCount ?? 0 }} entries</span>
        <span v-if="(c.followerCount ?? 0) > 0" class="cpub-contest-entries"><i class="fa-solid fa-bell"></i> {{ c.followerCount }} following</span>
        <!-- Days to the CURRENT stage's close (falls back to endDate for a
             classic contest), not the far-off final date on a multi-stage one.
             Client-only: see daysLeftLabel. -->
        <span v-if="c.daysLeft" class="cpub-contest-deadline">
          <i class="fa-regular fa-clock"></i> {{ c.daysLeft }}
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
