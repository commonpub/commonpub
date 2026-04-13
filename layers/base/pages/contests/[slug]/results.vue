<script setup lang="ts">
import type { Serialized, ContestDetail, ContestEntryItem } from '@commonpub/server';

const route = useRoute();
const slug = route.params.slug as string;

const { data: contest } = useLazyFetch<Serialized<ContestDetail>>(`/api/contests/${slug}`);
const { data: entriesData } = useLazyFetch<{ items: Serialized<ContestEntryItem>[]; total: number }>(`/api/contests/${slug}/entries`);

useSeoMeta({
  title: () => `Results: ${contest.value?.title || 'Contest'} — ${useSiteName()}`,
});

const rankedEntries = computed(() => {
  const items = [...(entriesData.value?.items ?? [])];
  items.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  return items;
});

const podium = computed(() => rankedEntries.value.filter((e) => e.rank && e.rank <= 3));
const leaderboard = computed(() => rankedEntries.value);

const prizes = computed(() => contest.value?.prizes ?? []);

function prizeForRank(rank: number): { title: string; value?: string } | null {
  const prize = prizes.value.find((p: { place: number; title: string; value?: string }) => p.place === rank);
  return prize ?? null;
}

function medalIcon(rank: number): string {
  if (rank === 1) return 'fa-trophy';
  if (rank === 2) return 'fa-medal';
  if (rank === 3) return 'fa-award';
  return '';
}

function medalColor(rank: number): string {
  if (rank === 1) return 'var(--yellow)';
  if (rank === 2) return 'var(--text-faint)';
  if (rank === 3) return '#a0724a';
  return 'var(--text-dim)';
}
</script>

<template>
  <div class="cpub-results-page">
    <header class="cpub-results-header">
      <NuxtLink :to="`/contests/${slug}`" class="cpub-results-back">
        <i class="fa-solid fa-arrow-left"></i> Back to contest
      </NuxtLink>
      <h1 class="cpub-results-title">
        <i class="fa-solid fa-ranking-star" style="color: var(--yellow);"></i>
        {{ contest?.title || 'Contest' }} — Results
      </h1>
    </header>

    <!-- Not completed -->
    <div v-if="contest && contest.status !== 'completed'" class="cpub-results-pending">
      <i class="fa-solid fa-hourglass-half"></i>
      <p>Results are not available yet. The contest is still <strong>{{ contest.status }}</strong>.</p>
      <NuxtLink :to="`/contests/${slug}`" class="cpub-btn cpub-btn-sm">Back to Contest</NuxtLink>
    </div>

    <template v-else-if="contest">
      <!-- PODIUM -->
      <div v-if="podium.length > 0" class="cpub-podium">
        <div
          v-for="entry in podium"
          :key="entry.id"
          class="cpub-podium-card"
          :class="`cpub-podium-${entry.rank}`"
        >
          <div class="cpub-podium-medal" :style="{ color: medalColor(entry.rank ?? 0) }">
            <i class="fa-solid" :class="medalIcon(entry.rank ?? 0)"></i>
          </div>
          <div class="cpub-podium-rank">#{{ entry.rank }}</div>
          <div class="cpub-podium-thumb">
            <img v-if="entry.contentCoverImageUrl" :src="entry.contentCoverImageUrl" :alt="entry.contentTitle" />
            <div v-else class="cpub-podium-placeholder"><i class="fa-solid fa-microchip"></i></div>
          </div>
          <NuxtLink :to="`/u/${entry.authorUsername}/${entry.contentType}/${entry.contentSlug}`" class="cpub-podium-title">{{ entry.contentTitle }}</NuxtLink>
          <NuxtLink :to="`/u/${entry.authorUsername}`" class="cpub-podium-author">{{ entry.authorName }}</NuxtLink>
          <div class="cpub-podium-score">Score: {{ entry.score ?? '—' }}</div>
          <div v-if="prizeForRank(entry.rank ?? 0)" class="cpub-podium-prize">
            <i class="fa-solid fa-gift"></i> {{ prizeForRank(entry.rank ?? 0)!.title }}
            <span v-if="prizeForRank(entry.rank ?? 0)!.value" class="cpub-podium-prize-val">{{ prizeForRank(entry.rank ?? 0)!.value }}</span>
          </div>
        </div>
      </div>

      <!-- LEADERBOARD -->
      <div v-if="leaderboard.length > 0" class="cpub-leaderboard">
        <h2 class="cpub-leaderboard-title">Full Leaderboard</h2>
        <table class="cpub-leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Entry</th>
              <th>Author</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in leaderboard" :key="entry.id" :class="{ 'cpub-lb-top3': entry.rank && entry.rank <= 3 }">
              <td class="cpub-lb-rank">
                <span v-if="entry.rank && entry.rank <= 3" :style="{ color: medalColor(entry.rank) }">
                  <i class="fa-solid" :class="medalIcon(entry.rank)"></i>
                </span>
                {{ entry.rank ?? '—' }}
              </td>
              <td>
                <NuxtLink :to="`/u/${entry.authorUsername}/${entry.contentType}/${entry.contentSlug}`" class="cpub-lb-entry-link">{{ entry.contentTitle }}</NuxtLink>
              </td>
              <td>
                <NuxtLink :to="`/u/${entry.authorUsername}`" class="cpub-lb-author-link">{{ entry.authorName }}</NuxtLink>
              </td>
              <td class="cpub-lb-score">{{ entry.score ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="cpub-results-empty">
        <i class="fa-solid fa-inbox"></i>
        <p>No entries were submitted to this contest.</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cpub-results-page { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
.cpub-results-header { margin-bottom: 32px; }
.cpub-results-back { font-size: 12px; color: var(--text-faint); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 12px; }
.cpub-results-back:hover { color: var(--accent); }
.cpub-results-title { font-size: 22px; font-weight: 700; display: flex; align-items: center; gap: 10px; }

.cpub-results-pending { text-align: center; padding: 48px 0; color: var(--text-faint); font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.cpub-results-pending i { font-size: 24px; }

/* PODIUM */
.cpub-podium { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
.cpub-podium-card { background: var(--surface); border: var(--border-width-default) solid var(--border); border-radius: var(--radius); padding: 20px; text-align: center; box-shadow: var(--shadow-md); }
.cpub-podium-1 { box-shadow: var(--shadow-accent); border-color: var(--yellow-border); }
.cpub-podium-medal { font-size: 28px; margin-bottom: 6px; }
.cpub-podium-rank { font-size: 11px; font-family: var(--font-mono); font-weight: 700; letter-spacing: .08em; margin-bottom: 12px; color: var(--text-dim); }
.cpub-podium-thumb { width: 100%; height: 100px; overflow: hidden; margin-bottom: 12px; border-radius: var(--radius); background: var(--surface2); display: flex; align-items: center; justify-content: center; }
.cpub-podium-thumb img { width: 100%; height: 100%; object-fit: cover; }
.cpub-podium-placeholder { font-size: 24px; color: var(--text-faint); opacity: .5; }
.cpub-podium-title { font-size: 13px; font-weight: 600; display: block; margin-bottom: 4px; color: var(--text); text-decoration: none; }
.cpub-podium-title:hover { color: var(--accent); }
.cpub-podium-author { font-size: 11px; color: var(--text-dim); text-decoration: none; display: block; margin-bottom: 6px; }
.cpub-podium-author:hover { color: var(--accent); }
.cpub-podium-score { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); margin-bottom: 6px; }
.cpub-podium-prize { font-size: 11px; font-family: var(--font-mono); color: var(--accent); display: flex; align-items: center; justify-content: center; gap: 4px; }
.cpub-podium-prize-val { font-weight: 700; color: var(--yellow); }

/* LEADERBOARD */
.cpub-leaderboard { margin-bottom: 32px; }
.cpub-leaderboard-title { font-size: 16px; font-weight: 700; margin-bottom: 14px; }
.cpub-leaderboard-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.cpub-leaderboard-table th { text-align: left; font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-faint); padding: 8px 12px; border-bottom: var(--border-width-default) solid var(--border); }
.cpub-leaderboard-table td { padding: 10px 12px; border-bottom: var(--border-width-default) solid var(--border); }
.cpub-lb-top3 { background: var(--surface2); }
.cpub-lb-rank { font-family: var(--font-mono); font-weight: 700; display: flex; align-items: center; gap: 6px; }
.cpub-lb-score { font-family: var(--font-mono); font-weight: 600; color: var(--accent); }
.cpub-lb-entry-link { color: var(--text); text-decoration: none; font-weight: 500; }
.cpub-lb-entry-link:hover { color: var(--accent); }
.cpub-lb-author-link { color: var(--text-dim); text-decoration: none; }
.cpub-lb-author-link:hover { color: var(--accent); }

.cpub-results-empty { text-align: center; padding: 48px 0; color: var(--text-faint); font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.cpub-results-empty i { font-size: 24px; }

@media (max-width: 768px) {
  .cpub-podium { grid-template-columns: 1fr; }
  .cpub-leaderboard-table { font-size: 11px; }
  .cpub-leaderboard-table th, .cpub-leaderboard-table td { padding: 8px; }
}
</style>
