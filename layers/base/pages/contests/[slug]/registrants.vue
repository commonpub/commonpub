<script setup lang="ts">
// Read-only registrants page (session 261). The same panel the editor shows at the
// bottom of its Registration tab, on a page of its own, so an organizer looking for
// who registered (or a shipping address) gets there from the contest page's
// "View registrants" button instead of opening the full editor. Who may see it is
// the registrants route's rule (owner, contest.manage, per-contest editor); the
// personal-data columns inside still need `contest.pii`.
import type { Serialized, ContestDetail } from '@commonpub/server';

definePageMeta({ middleware: 'auth' });

const route = useRoute();
const slug = route.params.slug as string;

const { data: contest, error } = useLazyFetch<Serialized<ContestDetail>>(`/api/contests/${slug}`);
const canManage = computed(() => !!contest.value?.viewerCanManage);

// Resolved in setup scope: inside a useSeoMeta getter useSiteName() falls back.
const siteName = useSiteName();
useSeoMeta({
  title: () => `Registrants: ${contest.value?.title || 'Contest'}, ${siteName}`,
  robots: 'noindex, nofollow',
});
</script>

<template>
  <div class="cpub-regpage">
    <NuxtLink :to="`/contests/${slug}`" class="cpub-regpage-back">
      <i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Back to contest
    </NuxtLink>

    <p v-if="error" class="cpub-regpage-msg">This contest could not be found.</p>
    <p v-else-if="!contest" class="cpub-regpage-msg" role="status">Loading...</p>
    <div v-else-if="!canManage" class="cpub-regpage-msg">
      <i class="fa-solid fa-lock" aria-hidden="true"></i>
      <p>Only the contest's organizers can see who registered.</p>
    </div>
    <template v-else>
      <header class="cpub-regpage-head">
        <p class="cpub-regpage-eyebrow">Registrants</p>
        <h1 class="cpub-regpage-title">{{ contest.title }}</h1>
        <p class="cpub-regpage-desc">
          Everyone who completed registration, with their answers.
        </p>
      </header>
      <ContestRegistrantsPanel :slug="slug" :heading-level="2" />
    </template>
  </div>
</template>

<style scoped>
.cpub-regpage { max-width: 1100px; margin: 0 auto; padding: 24px 32px 48px; display: flex; flex-direction: column; gap: 16px; }
.cpub-regpage-back { align-self: flex-start; font-size: var(--text-sm); color: var(--text-dim); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
.cpub-regpage-back:hover { color: var(--accent); }
.cpub-regpage-head { display: flex; flex-direction: column; gap: 4px; }
.cpub-regpage-eyebrow { margin: 0; font-family: var(--font-mono); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); font-weight: 700; }
.cpub-regpage-title { margin: 0; font-size: 24px; line-height: 1.25; color: var(--text); }
.cpub-regpage-desc { margin: 0; color: var(--text-dim); font-size: var(--text-sm); max-width: 70ch; }
.cpub-regpage-msg { text-align: center; padding: 48px 0; color: var(--text-dim); display: flex; flex-direction: column; align-items: center; gap: 12px; }
.cpub-regpage-msg i { font-size: 24px; }
@media (max-width: 768px) {
  .cpub-regpage { padding: 16px 16px 40px; }
  .cpub-regpage-title { font-size: 20px; }
}
</style>
