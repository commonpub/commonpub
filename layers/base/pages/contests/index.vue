<script setup lang="ts">
useSeoMeta({ title: `Contests — ${useSiteName()}` });

const { data: contests } = await useFetch('/api/contests');
const { isAuthenticated, isAdmin, user } = useAuth();

// Card blurb: prefer the short subheading; otherwise a plain-text, markdown-
// stripped excerpt of the (possibly long Markdown) description — so listing
// cards never dump a raw `## ...` wall.
function cardBlurb(c: { subheading?: string | null; description?: string | null }): string {
  if (c.subheading?.trim()) return c.subheading.trim();
  return markdownToExcerpt(c.description);
}

const config = useRuntimeConfig();

// Contest banner thumbnail — proxy cross-origin images through our server
// (same pattern as ContentCard) for caching + faster loads.
function coverFor(url: string | null | undefined): string | null {
  if (!url) return null;
  const siteDomain = (config.public?.domain as string) || '';
  try {
    if (siteDomain && !url.includes(siteDomain)) {
      return `/api/image-proxy?url=${encodeURIComponent(url)}&w=600`;
    }
  } catch { /* invalid URL — use as-is */ }
  return url;
}

const contestCreation = config.public.contestCreation as string || 'admin';
const canCreateContest = computed(() => {
  if (!isAuthenticated.value) return false;
  if (contestCreation === 'open') return true;
  if (contestCreation === 'staff') return user.value?.role === 'admin' || user.value?.role === 'staff';
  return isAdmin.value; // 'admin' default
});
</script>

<template>
  <div class="cpub-contests-page">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
      <SectionHeader title="Contests" large />
      <NuxtLink v-if="canCreateContest" to="/contests/create" class="cpub-btn cpub-btn-primary" style="font-size: 12px; padding: 6px 14px; background: var(--accent); color: var(--color-text-inverse); border: var(--border-width-default) solid var(--border); text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-plus"></i> Create Contest
      </NuxtLink>
    </div>
    <div v-if="contests?.items?.length" class="cpub-grid-3">
      <NuxtLink
        v-for="contest in contests.items"
        :key="contest.id"
        :to="`/contests/${contest.slug}`"
        class="cpub-card cpub-contest-card"
      >
        <!-- Card image: coverImageUrl (cover-cropped) → bannerUrl (contained, so a
             wide hero/logo isn't crop-mangled) → trophy fallback. Status badge overlaid. -->
        <div class="cpub-contest-thumb">
          <img
            v-if="coverFor(contest.coverImageUrl ?? contest.bannerUrl)"
            :src="coverFor(contest.coverImageUrl ?? contest.bannerUrl)!"
            :alt="contest.title"
            class="cpub-contest-cover"
            :class="{ 'cpub-contest-cover--contain': !contest.coverImageUrl && !!contest.bannerUrl }"
            loading="lazy"
          />
          <template v-else>
            <div class="cpub-contest-thumb-grid" />
            <i class="fa-solid fa-trophy cpub-contest-thumb-icon" />
          </template>
          <span class="cpub-badge cpub-contest-thumb-badge" :class="{
            'cpub-badge-green': contest.status === 'active',
            'cpub-badge-yellow': contest.status === 'upcoming',
            'cpub-badge-accent': contest.status === 'judging',
            'cpub-badge-red': contest.status === 'completed' || contest.status === 'cancelled',
          }">{{ contest.status }}</span>
        </div>
        <div class="cpub-card-body">
          <h3 class="cpub-contest-card-title">{{ contest.title }}</h3>
          <p v-if="cardBlurb(contest)" class="cpub-contest-card-blurb">
            {{ cardBlurb(contest) }}
          </p>
          <div v-if="contest.endDate" style="margin-top: 8px">
            <CountdownTimer :target-date="contest.endDate" />
          </div>
          <div class="cpub-contest-card-meta">
            <span><i class="fa-solid fa-users"></i> {{ contest.entryCount }} entries</span>
          </div>
        </div>
      </NuxtLink>
    </div>
    <div v-else class="cpub-empty-state">
      <div class="cpub-empty-state-icon"><i class="fa-solid fa-trophy"></i></div>
      <p class="cpub-empty-state-title">No contests yet</p>
      <p class="cpub-empty-state-desc">Check back soon for upcoming contests.</p>
    </div>
  </div>
</template>

<style scoped>
.cpub-contests-page { max-width: 960px; margin: 0 auto; padding: 32px; }
.cpub-grid-3 { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.cpub-card { border: var(--border-width-default) solid var(--border); background: var(--surface); overflow: hidden; transition: box-shadow 0.15s, transform 0.15s; box-shadow: var(--shadow-md); }
.cpub-card:hover { box-shadow: var(--shadow-lg); transform: translate(-1px, -1px); }
.cpub-card-body { padding: 16px; }

/* Whole card is a link */
.cpub-contest-card { display: block; text-decoration: none; color: inherit; }

/* Banner thumbnail — wide (banner-shaped), cover-cropped, with a grid+trophy
   fallback when a contest has no bannerUrl. */
.cpub-contest-thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--surface2);
  border-bottom: var(--border-width-default) solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.cpub-contest-cover { width: 100%; height: 100%; object-fit: cover; display: block; }
/* Banner-as-fallback: contain (+ breathing room) so a wide hero/logo shows whole, not crop-mangled. */
.cpub-contest-cover--contain { object-fit: contain; padding: 12px; background: var(--surface2); }
.cpub-contest-thumb-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--border2) 1px, transparent 1px),
    linear-gradient(90deg, var(--border2) 1px, transparent 1px);
  background-size: 20px 20px;
  opacity: 0.25;
}
.cpub-contest-thumb-icon { position: relative; z-index: 1; font-size: 36px; color: var(--accent); opacity: 0.45; }
.cpub-contest-thumb-badge { position: absolute; top: 10px; left: 10px; z-index: 2; box-shadow: var(--shadow-sm); }
.cpub-contest-card:hover .cpub-contest-cover { opacity: 0.92; }

.cpub-contest-card-title { font-size: 15px; font-weight: 600; margin: 0 0 6px; color: var(--text); }
.cpub-contest-card-meta { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); }

.cpub-contest-card-blurb {
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .cpub-contests-page { padding: 16px; }
  .cpub-grid-3 { grid-template-columns: 1fr; gap: 14px; }
}
</style>
