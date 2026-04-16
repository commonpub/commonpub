<script setup lang="ts">
import type { HomepageSectionConfig } from '@commonpub/server';

const props = defineProps<{ config: HomepageSectionConfig }>();

const limit = computed(() => props.config.limit ?? 4);
const { data: communities, pending } = await useFetch('/api/hubs', { query: { limit }, lazy: true });

const { user } = useAuth();
const isAuthenticated = computed(() => !!user.value);
const joinedHubs = ref(new Set<string>());
const toast = useToast();

async function handleHubJoin(hubSlug: string): Promise<void> {
  if (!isAuthenticated.value) {
    await navigateTo('/auth/login?redirect=/');
    return;
  }
  try {
    await $fetch(`/api/hubs/${hubSlug}/join`, { method: 'POST' });
    joinedHubs.value.add(hubSlug);
    toast.success('Joined hub!');
  } catch {
    toast.error('Failed to join hub');
  }
}
</script>

<template>
  <div v-if="pending" class="cpub-sb-card">
    <div class="cpub-sb-head">Trending Hubs</div>
    <div class="cpub-loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
  </div>
  <div v-else-if="communities?.items?.length" class="cpub-sb-card">
    <div class="cpub-sb-head">Trending Hubs <NuxtLink to="/hubs">Browse</NuxtLink></div>
    <div v-for="hub in communities.items" :key="hub.id" class="cpub-hub-item">
      <div class="cpub-hub-icon">
        <img v-if="hub.iconUrl" :src="hub.iconUrl" :alt="hub.name" class="cpub-hub-icon-img" />
        <i v-else class="fa-solid fa-users"></i>
      </div>
      <div class="cpub-hub-info">
        <NuxtLink :to="(hub as Record<string, unknown>).source === 'federated' ? `/federated-hubs/${hub.id}` : `/hubs/${hub.slug}`" class="cpub-hub-name">{{ hub.name }}</NuxtLink>
        <div class="cpub-hub-members">{{ hub.memberCount ?? 0 }} members</div>
      </div>
      <button v-if="joinedHubs.has(hub.slug)" class="cpub-btn-joined" disabled><i class="fa-solid fa-check"></i> Joined</button>
      <button v-else class="cpub-btn-join" @click.prevent="handleHubJoin(hub.slug)">Join</button>
    </div>
  </div>
</template>

<style scoped>
.cpub-sb-card { background: var(--surface); border: var(--border-width-default) solid var(--border); padding: 16px; margin-bottom: 16px; }
.cpub-sb-head { font-family: var(--font-mono); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-faint); padding-bottom: 10px; border-bottom: var(--border-width-default) solid var(--border2); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
.cpub-sb-head a { color: var(--accent); text-decoration: none; font-size: 10px; }
.cpub-hub-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: var(--border-width-default) solid var(--border2); }
.cpub-hub-item:last-child { border-bottom: none; }
.cpub-hub-icon { width: 32px; height: 32px; background: var(--accent-bg); border: var(--border-width-default) solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 13px; color: var(--accent); flex-shrink: 0; overflow: hidden; }
.cpub-hub-icon-img { width: 100%; height: 100%; object-fit: cover; }
.cpub-hub-info { flex: 1; min-width: 0; }
.cpub-hub-name { font-size: 12px; font-weight: 600; color: var(--text); text-decoration: none; display: block; }
.cpub-hub-name:hover { color: var(--accent); }
.cpub-hub-members { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); }
.cpub-btn-join { font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 10px; border: var(--border-width-default) solid var(--accent); color: var(--accent); background: none; cursor: pointer; }
.cpub-btn-join:hover { background: var(--accent-bg); }
.cpub-btn-joined { font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 10px; border: var(--border-width-default) solid var(--green-border); color: var(--green); background: var(--green-bg); cursor: default; display: flex; align-items: center; gap: 3px; }
</style>
