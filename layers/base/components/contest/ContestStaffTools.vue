<script setup lang="ts">
// The way in for the people who run a contest (session 261). Judges reached the
// judging page only through a sidebar link that desktop alone shows, admins who
// are not on the panel had no way in at all, and the registrant list sat at the
// bottom of the editor's Registration tab. One labelled row on the contest page,
// every viewport, for exactly the viewers each destination admits:
//
//   Judging portal   accepted panel judges (not guests), and organizers
//   View registrants organizers (the registrants route's own rule)
//   Edit contest     organizers
//
// "Organizer" is `viewerCanManage`: owner, `contest.manage` holder (admins), or a
// per-contest editor. The server is the boundary; this only decides what to show.

const props = defineProps<{
  slug: string;
  status: string | null | undefined;
  /** Owner, contest.manage holder (admin) or per-contest editor. */
  canManage: boolean;
  /** Accepted, non-guest panel judge. */
  canJudge: boolean;
}>();

const isOpenForJudging = computed(() => props.status === 'judging');
// Organizers keep the portal after the contest ends (it is the record of who
// scored what). A judge's work ends with the contest, as in the sidebar.
const showJudging = computed(() => {
  if (props.status === 'cancelled') return false;
  if (props.canManage) return true;
  return props.canJudge && props.status !== 'completed';
});
const show = computed(() => props.canManage || showJudging.value);
const label = computed(() => (props.canManage ? 'Organizer tools' : 'Judge tools'));
</script>

<template>
  <nav v-if="show" class="cpub-staff-tools" :aria-label="label">
    <span class="cpub-staff-tools-label" aria-hidden="true"><i class="fa-solid fa-toolbox"></i> {{ label }}</span>
    <NuxtLink
      v-if="showJudging"
      :to="`/contests/${slug}/judge`"
      class="cpub-btn cpub-btn-sm"
      :class="{ 'cpub-btn-primary': isOpenForJudging && canJudge }"
    >
      <i class="fa-solid fa-gavel" aria-hidden="true"></i> Judging portal
    </NuxtLink>
    <NuxtLink v-if="canManage" :to="`/contests/${slug}/registrants`" class="cpub-btn cpub-btn-sm">
      <i class="fa-solid fa-address-book" aria-hidden="true"></i> View registrants
    </NuxtLink>
    <NuxtLink v-if="canManage" :to="`/contests/${slug}/edit`" class="cpub-btn cpub-btn-sm">
      <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> Edit contest
    </NuxtLink>
  </nav>
</template>

<style scoped>
.cpub-staff-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
  padding: 10px 14px;
  background: var(--accent-bg);
  border: var(--border-width-default) solid var(--accent-border);
}
.cpub-staff-tools-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  margin-right: 4px;
  font-family: var(--font-mono);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
@media (max-width: 768px) {
  .cpub-staff-tools-label { width: 100%; }
  .cpub-staff-tools .cpub-btn { flex: 1 1 auto; justify-content: center; min-height: 44px; }
}
</style>
