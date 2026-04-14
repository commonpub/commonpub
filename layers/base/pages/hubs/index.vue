<script setup lang="ts">
useSeoMeta({
  title: `Hubs — ${useSiteName()}`,
  description: 'Browse and join maker communities.',
});

const { data, pending } = await useFetch('/api/hubs');
const { isAuthenticated } = useAuth();

const hubs = computed(() => data.value?.items ?? []);

function isFederated(hub: Record<string, unknown>): boolean {
  return (hub as { source?: string }).source === 'federated';
}

function hubLink(hub: Record<string, unknown>): string {
  if (isFederated(hub)) return `/federated-hubs/${hub.id}`;
  return `/hubs/${hub.slug}`;
}
</script>

<template>
  <div class="cpub-hubs-page">
    <div class="cpub-hubs-header">
      <div>
        <h1 class="cpub-hubs-title">Hubs</h1>
        <p class="cpub-hubs-desc">Communities, products, and companies on {{ useSiteName() }}</p>
      </div>
      <NuxtLink v-if="isAuthenticated" to="/hubs/create" class="cpub-btn cpub-btn-primary">
        <i class="fa-solid fa-plus"></i> Create Hub
      </NuxtLink>
    </div>

    <div v-if="pending" class="cpub-empty-state"><p><i class="fa-solid fa-circle-notch fa-spin"></i> Loading hubs...</p></div>
    <div v-else-if="hubs.length" class="cpub-hubs-grid">
      <NuxtLink
        v-for="hub in hubs"
        :key="hub.id"
        :to="hubLink(hub as Record<string, unknown>)"
        class="cpub-hub-card"
      >
        <div class="cpub-hub-card-banner" :style="hub.bannerUrl ? { backgroundImage: `url(${hub.bannerUrl})` } : {}">
          <div class="cpub-hub-card-icon">
            <img v-if="hub.iconUrl" :src="hub.iconUrl" :alt="hub.name" class="cpub-hub-card-avatar" />
            <i v-else :class="hub.hubType === 'company' ? 'fa-solid fa-building' : hub.hubType === 'product' ? 'fa-solid fa-microchip' : 'fa-solid fa-users'"></i>
          </div>
        </div>
        <div class="cpub-hub-card-body">
          <div class="cpub-hub-card-name-row">
            <h2 class="cpub-hub-card-name">{{ hub.name }}</h2>
            <span class="cpub-hub-card-type">{{ hub.hubType ?? 'community' }}</span>
          </div>
          <p v-if="hub.description" class="cpub-hub-card-desc">{{ hub.description }}</p>
          <div class="cpub-hub-card-meta">
            <span class="cpub-hub-card-stat"><i class="fa-solid fa-users"></i> {{ hub.memberCount ?? 0 }} members</span>
            <span class="cpub-hub-card-stat"><i class="fa-solid fa-message"></i> {{ hub.postCount ?? 0 }} posts</span>
            <span v-if="isFederated(hub as Record<string, unknown>)" class="cpub-hub-card-origin">
              <i class="fa-solid fa-globe"></i> {{ (hub as Record<string, unknown>).originDomain }}
            </span>
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
.cpub-hubs-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 24px 64px;
}

.cpub-hubs-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 28px;
  gap: 16px;
}

.cpub-hubs-title { font-size: 22px; font-weight: 700; }
.cpub-hubs-desc { font-size: 13px; color: var(--text-dim); margin-top: 4px; }

.cpub-hubs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.cpub-hub-card {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.15s, border-color 0.15s, transform 0.15s;
}

.cpub-hub-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}

.cpub-hub-card-banner {
  height: 72px;
  background: linear-gradient(135deg, var(--surface2) 0%, var(--accent-bg-strong) 100%);
  background-size: cover;
  background-position: center;
  position: relative;
}

.cpub-hub-card-icon {
  position: absolute;
  bottom: -18px;
  left: 16px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  color: var(--accent);
  font-size: 18px;
  overflow: hidden;
}

.cpub-hub-card-avatar { width: 100%; height: 100%; object-fit: cover; }

.cpub-hub-card-body {
  padding: 24px 16px 16px;
}

/* Reset borders on all card body children — prevent theme bleed */
.cpub-hub-card-body > * {
  border: none;
}

.cpub-hub-card-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.cpub-hub-card-name { font-size: 15px; font-weight: 600; }

.cpub-hub-card-desc {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.5;
  margin-bottom: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.cpub-hub-card-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-top: 10px;
  border-top: var(--border-width-default) solid var(--border2);
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
  border: var(--border-width-default) solid var(--accent-border);
  padding: 2px 6px;
}

.cpub-hub-card-origin {
  font-size: 10px;
  color: var(--text-faint);
  display: flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
}
.cpub-hub-card-origin i { font-size: 9px; color: var(--accent); }

@media (max-width: 640px) {
  .cpub-hubs-page { padding: 24px 16px 48px; }
  .cpub-hubs-grid { grid-template-columns: 1fr; }
  .cpub-hubs-header { flex-direction: column; }
}
</style>
