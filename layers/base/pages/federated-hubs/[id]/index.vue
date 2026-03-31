<script setup lang="ts">
import type { FederatedHubListItem, FederatedHubPostItem } from '@commonpub/server';
import type { HubViewModel, HubPostViewModel, HubTabDef } from '../../../types/hub';

const route = useRoute();
const id = route.params.id as string;

const { data: hub, pending, error, refresh: refreshHub } = await useFetch<FederatedHubListItem>(`/api/federated-hubs/${id}`);
const { data: posts, refresh: refreshPosts } = useLazyFetch<{ items: FederatedHubPostItem[]; total: number }>(`/api/federated-hubs/${id}/posts`, {
  default: () => ({ items: [], total: 0 }),
});

useSeoMeta({
  title: () => hub.value ? `${hub.value.name} (${hub.value.originDomain})` : 'Federated Hub',
  description: () => hub.value?.description || '',
});

if (hub.value?.url) {
  useHead({
    link: [{ rel: 'canonical', href: hub.value.url }],
    meta: [{ name: 'robots', content: 'noindex, follow' }],
  });
}

const { isAuthenticated } = useAuth();
const toast = useToast();
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
    linkTo: `/federated-hubs/${id}`,
  }));
});

const discussionPosts = computed(() =>
  postsVM.value.filter(p => p.type === 'text' || p.type === 'discussion' || p.type === 'question'),
);

const tabDefs = computed<HubTabDef[]>(() => [
  { value: 'feed', label: 'Feed', icon: 'fa-solid fa-rss', count: hub.value?.postCount },
  { value: 'discussions', label: 'Discussions', icon: 'fa-solid fa-comments', count: discussionPosts.value.length || undefined },
]);

// --- Compose (posts to remote hub via federation) ---
const newPostContent = ref('');
const posting = ref(false);

async function handlePost(): Promise<void> {
  if (!newPostContent.value.trim() || !hub.value?.actorUri) return;
  posting.value = true;
  try {
    await $fetch('/api/federation/hub-post' as string, {
      method: 'POST',
      body: {
        federatedHubId: id,
        hubActorUri: hub.value.actorUri,
        content: newPostContent.value,
      },
    });
    newPostContent.value = '';
    toast.success('Post sent to hub');
    await Promise.all([refreshHub(), refreshPosts()]);
  } catch {
    toast.error('Failed to post — the remote hub may not accept posts from this instance');
  } finally {
    posting.value = false;
  }
}

// --- Vote/like on posts ---
async function handlePostVote(postId: string): Promise<void> {
  if (!isAuthenticated.value) {
    await navigateTo(`/auth/login?redirect=/federated-hubs/${id}`);
    return;
  }
  try {
    await $fetch('/api/federation/hub-post-like' as string, {
      method: 'POST',
      body: { federatedHubPostId: postId },
    });
    // Optimistic update: increment vote count in the local view
    const post = posts.value?.items.find(p => p.id === postId);
    if (post) post.localLikeCount = (post.localLikeCount ?? 0) + 1;
    toast.success('Liked!');
  } catch {
    toast.error('Failed to like post');
  }
}

// --- Discussion compose ---
const newDiscContent = ref('');
const discPosting = ref(false);

async function handleDiscPost(): Promise<void> {
  if (!newDiscContent.value.trim() || !hub.value?.actorUri) return;
  discPosting.value = true;
  try {
    await $fetch('/api/federation/hub-post' as string, {
      method: 'POST',
      body: {
        federatedHubId: id,
        hubActorUri: hub.value.actorUri,
        content: newDiscContent.value,
        type: 'discussion',
      },
    });
    newDiscContent.value = '';
    toast.success('Discussion posted');
    await Promise.all([refreshHub(), refreshPosts()]);
  } catch {
    toast.error('Failed to post discussion');
  } finally {
    discPosting.value = false;
  }
}
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
                Visit original <i class="fa-solid fa-arrow-up-right-from-square"></i>
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

    <!-- Feed tab -->
    <HubFeed v-if="activeTab === 'feed'" :posts="postsVM" :interactive="isAuthenticated" @post-vote="handlePostVote">
      <template v-if="isAuthenticated" #compose>
        <div class="cpub-compose-bar">
          <div class="cpub-compose-row">
            <input
              v-model="newPostContent"
              class="cpub-compose-input"
              type="text"
              placeholder="Post to this hub (sent via federation)..."
              @keydown.enter="handlePost"
            />
            <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="posting" @click="handlePost">
              <i class="fa-solid fa-paper-plane"></i> Post
            </button>
          </div>
          <p class="cpub-fed-compose-hint">
            <i class="fa-solid fa-globe"></i> Your post will be sent to {{ hub?.originDomain }} via ActivityPub
          </p>
        </div>
      </template>
    </HubFeed>

    <!-- Discussions tab -->
    <HubDiscussions v-else-if="activeTab === 'discussions'" :posts="discussionPosts">
      <template v-if="isAuthenticated" #compose>
        <div class="cpub-compose-bar" style="margin-bottom: 16px">
          <div class="cpub-compose-row">
            <input
              v-model="newDiscContent"
              class="cpub-compose-input"
              type="text"
              placeholder="Start a discussion (sent via federation)..."
              @keydown.enter="handleDiscPost"
            />
            <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="discPosting" @click="handleDiscPost">
              <i class="fa-solid fa-paper-plane"></i> Post
            </button>
          </div>
        </div>
      </template>
    </HubDiscussions>

    <template #sidebar>
      <HubSidebar>
        <HubSidebarCard title="About">
          <p v-if="hub?.description" class="cpub-sidebar-desc">{{ hub.description }}</p>
          <div class="cpub-sidebar-stats">
            <div class="cpub-sidebar-stat">
              <strong>{{ hub?.memberCount ?? 0 }}</strong>
              <span>members</span>
            </div>
            <div class="cpub-sidebar-stat">
              <strong>{{ hub?.postCount ?? 0 }}</strong>
              <span>posts</span>
            </div>
          </div>
        </HubSidebarCard>
        <HubSidebarCard title="Origin Instance">
          <div class="cpub-origin-info">
            <div class="cpub-origin-domain">
              <i class="fa-solid fa-globe"></i>
              <strong>{{ hub?.originDomain }}</strong>
            </div>
            <p class="cpub-origin-desc">Content is mirrored from this remote CommonPub instance via ActivityPub.</p>
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

/* Compose */
.cpub-compose-bar {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 12px 14px; margin-bottom: 16px;
  display: flex; flex-direction: column; gap: 6px;
}
.cpub-compose-row { display: flex; gap: 10px; align-items: center; }
.cpub-compose-input {
  flex: 1; background: var(--surface2); border: 1px solid var(--border);
  border-radius: 8px; padding: 10px 14px; font-size: 0.8125rem;
  color: var(--text); font-family: inherit;
}
.cpub-compose-input::placeholder { color: var(--text-faint); }
.cpub-fed-compose-hint {
  font-size: 11px; color: var(--text-faint);
  display: flex; align-items: center; gap: 5px;
}
.cpub-fed-compose-hint i { font-size: 10px; color: var(--accent); }

/* Sidebar */
.cpub-sidebar-desc { font-size: 12px; color: var(--text-dim); line-height: 1.5; margin-bottom: 12px; }
.cpub-sidebar-stats { display: flex; gap: 16px; }
.cpub-sidebar-stat { display: flex; flex-direction: column; font-size: 11px; color: var(--text-faint); }
.cpub-sidebar-stat strong { font-size: 16px; color: var(--text); font-weight: 700; }

/* Origin */
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
