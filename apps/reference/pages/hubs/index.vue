<script setup lang="ts">
useSeoMeta({
  title: 'Hubs — CommonPub',
  description: 'Browse and join maker communities.',
});

interface HubItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  hubType: string;
  memberCount: number;
  postCount: number;
}

const { data } = await useFetch<{ items: HubItem[]; total: number }>('/api/hubs');
const { isAuthenticated } = useAuth();

const hubs = computed(() => data.value?.items ?? []);
</script>

<template>
  <div class="cpub-hubs-page">
    <div class="cpub-hubs-header">
      <div>
        <h1 class="cpub-hubs-title">Hubs</h1>
        <p class="cpub-hubs-desc">Communities, products, and companies on CommonPub</p>
      </div>
      <NuxtLink v-if="isAuthenticated" to="/hubs/create" class="cpub-btn cpub-btn-primary">
        <i class="fa-solid fa-plus"></i> Create Hub
      </NuxtLink>
    </div>

    <div v-if="hubs.length" class="cpub-hubs-grid">
      <NuxtLink
        v-for="hub in hubs"
        :key="hub.id"
        :to="`/hubs/${hub.slug}`"
        class="cpub-hub-card"
      >
        <div class="cpub-hub-card-icon">
          <i :class="hub.hubType === 'company' ? 'fa-solid fa-building' : hub.hubType === 'product' ? 'fa-solid fa-microchip' : 'fa-solid fa-users'"></i>
        </div>
        <div class="cpub-hub-card-body">
          <h2 class="cpub-hub-card-name">{{ hub.name }}</h2>
          <p v-if="hub.description" class="cpub-hub-card-desc">{{ hub.description }}</p>
          <div class="cpub-hub-card-meta">
            <span class="cpub-hub-card-stat"><i class="fa-solid fa-users"></i> {{ hub.memberCount ?? 0 }}</span>
            <span class="cpub-hub-card-stat"><i class="fa-solid fa-message"></i> {{ hub.postCount ?? 0 }}</span>
            <span class="cpub-hub-card-type">{{ hub.hubType ?? 'community' }}</span>
          </div>
        </div>
      </NuxtLink>
    </div>
    <div v-else class="cpub-empty-state">
      <div class="cpub-empty-state-icon"><i class="fa-solid fa-users"></i></div>
      <p class="cpub-empty-state-title">No hubs yet</p>
      <p class="cpub-empty-state-desc">Be the first to create a community!</p>
      <NuxtLink v-if="isAuthenticated" to="/hubs/create" class="cpub-btn cpub-btn-primary" style="margin-top: 16px">
        <i class="fa-solid fa-plus"></i> Create Hub
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.cpub-hubs-page { max-width: 960px; }

.cpub-hubs-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 16px;
}

.cpub-hubs-title {
  font-size: 22px;
  font-weight: 700;
}

.cpub-hubs-desc {
  font-size: 13px;
  color: var(--text-dim);
  margin-top: 4px;
}

.cpub-hubs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}

.cpub-hub-card {
  display: flex;
  gap: 14px;
  padding: 18px;
  background: var(--surface);
  border: 2px solid var(--border);
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.15s;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-hub-card:hover {
  box-shadow: 6px 6px 0 var(--border);
  transform: translate(-1px, -1px);
}

.cpub-hub-card-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-bg);
  border: 2px solid var(--accent-border);
  color: var(--accent);
  font-size: 18px;
  flex-shrink: 0;
}

.cpub-hub-card-body { flex: 1; min-width: 0; }

.cpub-hub-card-name {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.cpub-hub-card-desc {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.5;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.cpub-hub-card-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cpub-hub-card-stat {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  display: flex;
  align-items: center;
  gap: 4px;
}

.cpub-hub-card-stat i { font-size: 10px; }

.cpub-hub-card-type {
  font-size: 9px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  padding: 2px 6px;
}

@media (max-width: 640px) {
  .cpub-hubs-grid { grid-template-columns: 1fr; }
}
</style>
