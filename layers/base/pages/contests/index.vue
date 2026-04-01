<script setup lang="ts">
useSeoMeta({ title: `Contests — ${useSiteName()}` });

const { data: contests } = await useFetch('/api/contests');
const { isAuthenticated, isAdmin, user } = useAuth();

const config = useRuntimeConfig();
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
      <div v-for="contest in contests.items" :key="contest.id" class="cpub-card">
        <div class="cpub-card-body">
          <span class="cpub-badge" :class="{
            'cpub-badge-green': contest.status === 'active',
            'cpub-badge-yellow': contest.status === 'upcoming',
            'cpub-badge-red': contest.status === 'completed',
          }">{{ contest.status }}</span>
          <h3 style="font-size: 15px; font-weight: 600; margin: 8px 0">
            <NuxtLink :to="`/contests/${contest.slug}`" style="color: var(--text); text-decoration: none">
              {{ contest.title }}
            </NuxtLink>
          </h3>
          <p v-if="contest.description" style="font-size: 12px; color: var(--text-dim); margin-bottom: 12px">
            {{ contest.description }}
          </p>
          <div v-if="contest.endDate" style="margin-top: 8px">
            <CountdownTimer :target-date="contest.endDate" />
          </div>
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 11px; color: var(--text-faint); font-family: var(--font-mono)">
            <span><i class="fa-solid fa-users"></i> {{ contest.entryCount }} entries</span>
          </div>
        </div>
      </div>
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

@media (max-width: 768px) {
  .cpub-contests-page { padding: 16px; }
  .cpub-grid-3 { grid-template-columns: 1fr; gap: 14px; }
}
</style>
