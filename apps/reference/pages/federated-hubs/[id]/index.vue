<script setup lang="ts">
import type { FederatedHubListItem, FederatedHubPostItem } from '@commonpub/server';
import type { HubViewModel, HubPostViewModel, HubTabDef } from '~/types/hub';

const route = useRoute();
const id = route.params.id as string;

const { data: hub, pending, error } = await useFetch<FederatedHubListItem>(`/api/federated-hubs/${id}`);
const { data: posts } = useLazyFetch<{ items: FederatedHubPostItem[]; total: number }>(`/api/federated-hubs/${id}/posts`, {
  default: () => ({ items: [], total: 0 }),
});

useSeoMeta({
  title: () => hub.value ? `${hub.value.name} (${hub.value.originDomain}) -- CommonPub` : 'Federated Hub -- CommonPub',
  description: () => hub.value?.description || '',
});

if (hub.value?.url) {
  useHead({
    link: [{ rel: 'canonical', href: hub.value.url }],
    meta: [{ name: 'robots', content: 'noindex, follow' }],
  });
}

const activeTab = ref('feed');

// --- Map to view models ---
const hubVM = computed<HubViewModel | null>(() => {
  if (!hub.value) return null;
  return {
    name: hub.value.name,
    description: hub.value.description,
    iconUrl: hub.value.iconUrl,
    bannerUrl: hub.value.bannerUrl,
    hubType: (hub.value.hubType as 'community' | 'product' | 'company') ?? 'community',
    memberCount: hub.value.memberCount,
    postCount: hub.value.postCount,
    foundedLabel: null,
    isOfficial: false,
    joinPolicy: null,
    categories: null,
    website: null,
  };
});

const postsVM = computed<HubPostViewModel[]>(() => {
  return (posts.value?.items ?? []).map((p) => ({
    id: p.id,
    type: p.postType || 'text',
    content: p.content || '',
    author: {
      name: p.author.displayName || p.author.preferredUsername || 'Unknown',
      handle: `@${p.author.preferredUsername}@${p.author.instanceDomain}`,
      avatarUrl: p.author.avatarUrl,
    },
    createdAt: String(p.publishedAt ?? p.receivedAt),
    likeCount: (p.localLikeCount ?? 0) + (p.remoteLikeCount ?? 0),
    replyCount: (p.localReplyCount ?? 0) + (p.remoteReplyCount ?? 0),
    isPinned: p.isPinned ?? false,
    isLocked: false,
    linkTo: null,
  }));
});

const tabDefs = computed<HubTabDef[]>(() => [
  { value: 'feed', label: 'Feed', icon: 'fa-solid fa-rss', count: hub.value?.postCount },
]);
</script>

<template>
  <div v-if="pending" class="cpub-loading" style="padding: 64px 24px; text-align: center">Loading hub...</div>
  <div v-else-if="error" class="cpub-not-found">
    <h1>Hub not found</h1>
    <p>This federated hub may have been removed or the mirror may be paused.</p>
    <NuxtLink to="/hubs">Back to Hubs</NuxtLink>
  </div>

  <HubLayout v-else-if="hubVM" v-model:active-tab="activeTab" :tabs="tabDefs">
    <template #hero>
      <HubHero :hub="hubVM">
        <template #banner-overlay>
          <div class="cpub-fed-banner">
            <div class="cpub-fed-banner-inner">
              <i class="fa-solid fa-globe"></i>
              <span>Mirrored from <strong>{{ hub?.originDomain }}</strong></span>
              <a v-if="hub?.url" :href="hub.url" target="_blank" rel="noopener noreferrer" class="cpub-fed-banner-link">
                Visit hub on {{ hub.originDomain }} <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </a>
            </div>
          </div>
        </template>
        <template #actions>
          <a v-if="hub?.url" :href="hub.url" target="_blank" rel="noopener noreferrer" class="cpub-btn cpub-btn-sm">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Visit on {{ hub?.originDomain }}
          </a>
        </template>
        <template #badges>
          <span class="cpub-tag"><i class="fa-solid fa-globe" style="margin-right: 3px"></i>{{ hub?.originDomain }}</span>
        </template>
      </HubHero>
    </template>

    <!-- Feed (no compose slot = read-only) -->
    <HubFeed :posts="postsVM" />

    <template #sidebar>
      <HubSidebar>
        <HubSidebarCard title="Origin Instance">
          <div class="cpub-origin-info">
            <div class="cpub-origin-domain">
              <i class="fa-solid fa-globe"></i>
              <strong>{{ hub?.originDomain }}</strong>
            </div>
            <p class="cpub-origin-desc">This hub is mirrored from a remote CommonPub instance. Content is read-only.</p>
            <a v-if="hub?.url" :href="hub.url" target="_blank" rel="noopener noreferrer" class="cpub-btn cpub-btn-sm" style="margin-top: 8px; display: inline-flex">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Visit Original
            </a>
          </div>
        </HubSidebarCard>
      </HubSidebar>
    </template>
  </HubLayout>
</template>

<style scoped>
/* Origin banner */
.cpub-fed-banner { background: var(--accent-bg); border-bottom: 1px solid var(--accent-border); }
.cpub-fed-banner-inner {
  max-width: 1200px; margin: 0 auto; padding: 8px 24px;
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: var(--text-dim);
}
.cpub-fed-banner-inner > i { color: var(--accent); }
.cpub-fed-banner-link {
  margin-left: auto; color: var(--accent); font-weight: 600;
  text-decoration: none; white-space: nowrap;
  display: flex; align-items: center; gap: 4px; font-size: 11px;
}
.cpub-fed-banner-link:hover { text-decoration: underline; }

/* Origin sidebar */
.cpub-origin-info { font-size: 12px; }
.cpub-origin-domain {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; margin-bottom: 8px;
}
.cpub-origin-domain i { color: var(--accent); font-size: 11px; }
.cpub-origin-desc { color: var(--text-dim); line-height: 1.5; }

.cpub-not-found { text-align: center; padding: 60px 20px; color: var(--text-dim); }
.cpub-not-found h1 { font-size: 1.5rem; color: var(--text); margin-bottom: 8px; }
</style>
