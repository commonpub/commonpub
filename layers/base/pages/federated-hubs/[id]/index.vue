<script setup lang="ts">
import type { FederatedHubListItem, FederatedHubPostItem } from '@commonpub/server';
import type { HubViewModel, HubPostViewModel, HubMemberViewModel, HubTabDef } from '../../../types/hub';

const route = useRoute();
const id = route.params.id as string;

const { data: hub, pending, error, refresh: refreshHub } = await useFetch<FederatedHubListItem>(`/api/federated-hubs/${id}`);
const { data: posts, refresh: refreshPosts } = useLazyFetch<{ items: FederatedHubPostItem[]; total: number }>(`/api/federated-hubs/${id}/posts`, {
  default: () => ({ items: [], total: 0 }),
});

interface FederatedMember {
  actorUri: string;
  preferredUsername: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  instanceDomain: string;
  postCount: number;
}
const { data: members } = useLazyFetch<FederatedMember[]>(`/api/federated-hubs/${id}/members`, {
  default: () => [],
});

useSeoMeta({
  title: () => hub.value ? `${hub.value.name} — ${useSiteName()}` : 'Federated Hub',
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

const hubType = computed(() => (hub.value?.hubType as 'community' | 'product' | 'company') ?? 'community');
const initialTab = hubType.value === 'community' ? 'feed' : 'overview';
const activeTab = ref(initialTab);

// --- Map to view models ---
const hubVM = computed<HubViewModel | null>(() => {
  if (!hub.value) return null;
  return {
    name: hub.value.name,
    description: hub.value.description,
    iconUrl: hub.value.iconUrl,
    bannerUrl: hub.value.bannerUrl,
    hubType: hubType.value,
    memberCount: hub.value.memberCount,
    postCount: hub.value.postCount,
    foundedLabel: null,
    isOfficial: false,
    joinPolicy: null,
    categories: (hub.value as unknown as Record<string, unknown>).categories as string[] | null ?? null,
    website: (hub.value as unknown as Record<string, unknown>).website as string | null ?? null,
  };
});

const postsVM = computed<HubPostViewModel[]>(() => {
  return (posts.value?.items ?? []).map((p) => {
    const sc = p.sharedContentMeta;
    return {
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
      linkTo: `/federated-hubs/${id}/posts/${p.id}`,
      sharedContent: sc ? {
        type: sc.type,
        slug: '',
        title: sc.title,
        description: sc.summary ?? null,
        coverImageUrl: sc.coverImageUrl ?? null,
        url: sc.originUrl ?? null,
      } : undefined,
    };
  });
});

// Extract shared content posts for "Projects" tab
const sharedContentPosts = computed(() =>
  postsVM.value.filter(p => p.sharedContent),
);

const discussionPosts = computed(() =>
  postsVM.value.filter(p => p.type === 'text' || p.type === 'discussion' || p.type === 'question'),
);

// Hub rules (from federated metadata)
const hubRules = computed<string[]>(() => {
  const raw = (hub.value as unknown as Record<string, unknown>)?.rules;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw as string);
    if (Array.isArray(parsed)) return parsed as string[];
  } catch { /* not JSON */ }
  return (raw as string).split('\n').map((r: string) => r.trim()).filter(Boolean);
});

// --- Tab definitions (matching local hub structure) ---
const tabDefs = computed<HubTabDef[]>(() => {
  if (hubType.value === 'product') {
    return [
      { value: 'overview', label: 'Overview', icon: 'fa-solid fa-info-circle' },
      { value: 'projects', label: 'Projects', icon: 'fa-solid fa-folder-open', count: sharedContentPosts.value.length || undefined },
      { value: 'discussions', label: 'Discussions', icon: 'fa-solid fa-comments' },
    ];
  }
  if (hubType.value === 'company') {
    return [
      { value: 'overview', label: 'Overview', icon: 'fa-solid fa-building' },
      { value: 'projects', label: 'Projects', icon: 'fa-solid fa-folder-open', count: sharedContentPosts.value.length || undefined },
      { value: 'discussions', label: 'Discussions', icon: 'fa-solid fa-comments' },
    ];
  }
  return [
    { value: 'feed', label: 'Feed', icon: 'fa-solid fa-rss', count: hub.value?.postCount },
    { value: 'projects', label: 'Projects', icon: 'fa-solid fa-folder-open', count: sharedContentPosts.value.length || undefined },
    { value: 'discussions', label: 'Discussions', icon: 'fa-solid fa-comments' },
    { value: 'members', label: 'Members', icon: 'fa-solid fa-users', count: hub.value?.memberCount },
  ];
});

// --- Compose (posts to remote hub via federation) ---
const newPostContent = ref('');
const newPostType = ref<'text' | 'question' | 'discussion' | 'showcase'>('text');
const posting = ref(false);

const postTypeOptions = [
  { value: 'text', label: 'Post', icon: 'fa-solid fa-pen' },
  { value: 'question', label: 'Question', icon: 'fa-solid fa-circle-question' },
  { value: 'discussion', label: 'Discussion', icon: 'fa-solid fa-comments' },
  { value: 'showcase', label: 'Showcase', icon: 'fa-solid fa-image' },
];

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
        type: newPostType.value,
      },
    });
    newPostContent.value = '';
    newPostType.value = 'text';
    toast.success('Post sent to hub via federation');
    await Promise.all([refreshHub(), refreshPosts()]);
  } catch {
    toast.error('Failed to post — the remote hub may not accept posts from this instance');
  } finally {
    posting.value = false;
  }
}

// --- Discussion compose ---
const newDiscContent = ref('');
const newDiscType = ref<'discussion' | 'question'>('discussion');
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
        type: newDiscType.value,
      },
    });
    newDiscContent.value = '';
    newDiscType.value = 'discussion';
    toast.success('Discussion posted via federation');
    await Promise.all([refreshHub(), refreshPosts()]);
  } catch {
    toast.error('Failed to post discussion');
  } finally {
    discPosting.value = false;
  }
}

// --- Instance mirror status (not user-level follow) ---
const mirrorStatus = computed(() => hub.value?.followStatus ?? 'pending');

const remoteFollowRef = ref<InstanceType<typeof RemoteFollowDialog> | null>(null);

// --- Like state tracking ---
const likedPostIds = ref<Set<string>>(new Set());

async function fetchLikedState(): Promise<void> {
  if (!isAuthenticated.value || !posts.value?.items.length) return;
  try {
    const ids = posts.value.items.map(p => p.id).join(',');
    const result = await $fetch<{ likedPostIds: string[] }>(`/api/federation/hub-post-likes?postIds=${ids}`);
    likedPostIds.value = new Set(result.likedPostIds);
  } catch { /* best-effort */ }
}

watch(() => posts.value?.items.length, () => { fetchLikedState(); }, { immediate: true });

async function handlePostVote(postId: string): Promise<void> {
  if (!isAuthenticated.value) {
    await navigateTo(`/auth/login?redirect=/federated-hubs/${id}`);
    return;
  }
  try {
    const result = await $fetch<{ liked: boolean }>('/api/federation/hub-post-like' as string, {
      method: 'POST',
      body: { federatedHubPostId: postId },
    });
    const post = posts.value?.items.find(p => p.id === postId);
    if (post) {
      if (result.liked) {
        post.localLikeCount = (post.localLikeCount ?? 0) + 1;
        likedPostIds.value.add(postId);
      } else {
        post.localLikeCount = Math.max((post.localLikeCount ?? 0) - 1, 0);
        likedPostIds.value.delete(postId);
      }
    }
    toast.success(result.liked ? 'Liked!' : 'Unliked');
  } catch {
    toast.error('Failed to toggle like');
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
          <div class="cpub-fed-indicator">
            <i class="fa-solid fa-globe"></i>
            <span>Mirrored from <strong>{{ hub?.originDomain }}</strong></span>
            <a v-if="hub?.url" :href="hub.url" target="_blank" rel="noopener noreferrer" class="cpub-fed-indicator-link">
              Visit original <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          </div>
        </template>
        <template #actions>
          <span v-if="mirrorStatus === 'accepted'" class="cpub-member-badge cpub-member-badge-mirrored">
            <i class="fa-solid fa-globe"></i> Mirrored
          </span>
          <button v-if="hub?.actorUri" class="cpub-btn cpub-btn-primary cpub-btn-sm" @click="remoteFollowRef?.show()">
            <i class="fa-solid fa-user-plus"></i> Join from your instance
          </button>
          <a v-if="hub?.url" :href="hub.url" target="_blank" rel="noopener noreferrer" class="cpub-btn cpub-btn-sm">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Visit original
          </a>
        </template>
        <template #badges>
          <span class="cpub-tag"><i class="fa-solid fa-globe" style="margin-right: 3px"></i>{{ hub?.originDomain }}</span>
        </template>
      </HubHero>
    </template>

    <!-- Feed tab (community hubs) -->
    <HubFeed v-if="activeTab === 'feed'" :posts="postsVM" :interactive="isAuthenticated" :liked-post-ids="likedPostIds" @post-vote="handlePostVote">
      <template v-if="isAuthenticated" #compose>
        <div class="cpub-compose-bar">
          <div class="cpub-compose-types">
            <button
              v-for="opt in postTypeOptions"
              :key="opt.value"
              class="cpub-compose-type-btn"
              :class="{ active: newPostType === opt.value }"
              @click="newPostType = opt.value as typeof newPostType"
            >
              <i :class="opt.icon"></i> {{ opt.label }}
            </button>
          </div>
          <div class="cpub-compose-row">
            <input
              v-model="newPostContent"
              class="cpub-compose-input"
              type="text"
              :placeholder="newPostType === 'question' ? 'Ask a question...' : newPostType === 'discussion' ? 'Start a discussion...' : 'Write a post...'"
              @keydown.enter="handlePost"
            />
            <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="posting" @click="handlePost">
              <i class="fa-solid fa-paper-plane"></i> Post
            </button>
          </div>
          <p class="cpub-fed-compose-hint">
            <i class="fa-solid fa-globe"></i> Sent to {{ hub?.originDomain }} via ActivityPub
          </p>
        </div>
      </template>
    </HubFeed>

    <!-- Projects tab (shared content from hub posts) -->
    <div v-else-if="activeTab === 'projects'" class="cpub-hub-projects-tab">
      <div v-if="sharedContentPosts.length" class="cpub-shared-grid">
        <NuxtLink
          v-for="post in sharedContentPosts"
          :key="post.id"
          :to="(post.sharedContent?.url || post.linkTo) ?? ''"
          :target="post.sharedContent?.url ? '_blank' : undefined"
          :rel="post.sharedContent?.url ? 'noopener noreferrer' : undefined"
          class="cpub-shared-card"
        >
          <div v-if="post.sharedContent?.coverImageUrl" class="cpub-shared-card-img">
            <img :src="post.sharedContent.coverImageUrl" :alt="post.sharedContent.title" />
          </div>
          <div class="cpub-shared-card-body">
            <span v-if="post.sharedContent?.type" class="cpub-shared-card-type">{{ post.sharedContent.type }}</span>
            <h3 class="cpub-shared-card-title">{{ post.sharedContent?.title || 'Untitled' }}</h3>
            <p v-if="post.sharedContent?.description" class="cpub-shared-card-desc">{{ post.sharedContent.description }}</p>
            <div class="cpub-shared-card-meta">
              <span class="cpub-shared-card-author">{{ post.author.name }}</span>
              <span class="cpub-shared-card-stat"><i class="fa-solid fa-heart"></i> {{ post.likeCount }}</span>
            </div>
          </div>
        </NuxtLink>
      </div>
      <div v-else class="cpub-empty-state" style="padding: 48px 24px">
        <div class="cpub-empty-state-icon"><i class="fa-solid fa-folder-open"></i></div>
        <p class="cpub-empty-state-title">No shared projects yet</p>
        <p class="cpub-empty-state-desc">Projects shared in this hub will appear here.</p>
      </div>
    </div>

    <!-- Discussions tab -->
    <HubDiscussions v-else-if="activeTab === 'discussions'" :posts="discussionPosts">
      <template v-if="isAuthenticated" #compose>
        <div class="cpub-compose-bar" style="margin-bottom: 16px">
          <div class="cpub-compose-row">
            <input
              v-model="newDiscContent"
              class="cpub-compose-input"
              type="text"
              placeholder="Start a discussion or ask a question..."
              @keydown.enter="newDiscType = 'discussion'; handleDiscPost()"
            />
            <button class="cpub-btn cpub-btn-sm" :class="{ 'cpub-btn-primary': newDiscType === 'question' }" @click="newDiscType = 'question'" title="Ask a question">
              <i class="fa-solid fa-circle-question"></i>
            </button>
            <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="discPosting" @click="newDiscType = 'discussion'; handleDiscPost()">
              <i class="fa-solid fa-paper-plane"></i> Post
            </button>
          </div>
          <p class="cpub-fed-compose-hint">
            <i class="fa-solid fa-globe"></i> Sent to {{ hub?.originDomain }} via ActivityPub
          </p>
        </div>
      </template>
    </HubDiscussions>

    <!-- Members tab -->
    <div v-else-if="activeTab === 'members'" class="cpub-hub-members-tab">
      <div class="cpub-fed-members-stat">
        <i class="fa-solid fa-users"></i>
        <strong>{{ hub?.memberCount ?? 0 }}</strong> members on {{ hub?.originDomain }}
        <span v-if="members?.length" class="cpub-fed-members-known">&middot; {{ members.length }} known</span>
      </div>

      <div v-if="members?.length" class="cpub-fed-members-list">
        <a
          v-for="m in members"
          :key="m.actorUri"
          :href="m.actorUri"
          target="_blank"
          rel="noopener noreferrer"
          class="cpub-fed-member"
        >
          <img v-if="m.avatarUrl" :src="m.avatarUrl" :alt="m.displayName || m.preferredUsername || ''" class="cpub-fed-member-avatar" />
          <div v-else class="cpub-fed-member-avatar cpub-fed-member-avatar-fallback">{{ (m.displayName || m.preferredUsername || '?').charAt(0).toUpperCase() }}</div>
          <div class="cpub-fed-member-info">
            <div class="cpub-fed-member-name">{{ m.displayName || m.preferredUsername || 'Unknown' }}</div>
            <div class="cpub-fed-member-handle">@{{ m.preferredUsername || 'unknown' }}@{{ m.instanceDomain }}</div>
          </div>
          <div class="cpub-fed-member-posts">{{ m.postCount }} {{ m.postCount === 1 ? 'post' : 'posts' }}</div>
        </a>
      </div>
      <p v-else class="cpub-fed-members-empty">No known members yet. Members appear here as they post to the hub.</p>

      <a v-if="hub?.url" :href="hub.url" target="_blank" rel="noopener noreferrer" class="cpub-btn cpub-btn-sm cpub-fed-members-origin-link">
        <i class="fa-solid fa-arrow-up-right-from-square"></i> View all members on {{ hub?.originDomain }}
      </a>
    </div>

    <!-- Overview tab (product/company hubs) -->
    <template v-else-if="activeTab === 'overview'">
      <div class="cpub-product-overview">
        <h3 class="cpub-section-title">About</h3>
        <p class="cpub-prose-p">{{ hub?.description || 'No description available.' }}</p>
      </div>
    </template>

    <!-- Sidebar -->
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

        <HubSidebarCard v-if="hubRules.length" title="Hub Rules">
          <div v-for="(rule, i) in hubRules" :key="i" class="cpub-rule-item">
            <span class="cpub-rule-num">{{ i + 1 }}</span>
            <span>{{ rule }}</span>
          </div>
        </HubSidebarCard>

        <HubSidebarCard title="Origin Instance">
          <div class="cpub-origin-info">
            <div class="cpub-origin-domain">
              <i class="fa-solid fa-globe"></i>
              <strong>{{ hub?.originDomain }}</strong>
            </div>
            <p class="cpub-origin-desc">Mirrored via ActivityPub federation.</p>
            <a v-if="hub?.url" :href="hub.url" target="_blank" rel="noopener noreferrer" class="cpub-btn cpub-btn-sm" style="margin-top: 8px; display: inline-flex">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Visit Original
            </a>
          </div>
        </HubSidebarCard>
      </HubSidebar>
    </template>
  </HubLayout>

  <RemoteFollowDialog v-if="hub?.actorUri" ref="remoteFollowRef" :actor-uri="hub.actorUri" :label="hub?.name" />
</template>

<style scoped>
/* Federation indicator (inside hero banner) */
.cpub-fed-indicator { background: var(--accent-bg); border-bottom: 1px solid var(--accent-border); }
.cpub-fed-indicator {
  padding: 6px 24px;
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: var(--text-dim);
}
.cpub-fed-indicator > i { color: var(--accent); }
.cpub-fed-indicator-link {
  margin-left: auto; color: var(--accent); font-weight: 600;
  text-decoration: none; white-space: nowrap;
  display: flex; align-items: center; gap: 4px; font-size: 11px;
}
.cpub-fed-indicator-link:hover { text-decoration: underline; }

/* Compose */
.cpub-compose-bar {
  background: var(--surface); border: var(--border-width-default) solid var(--border);
  padding: 12px 14px; margin-bottom: 16px;
  display: flex; flex-direction: column; gap: 8px;
}
.cpub-compose-types {
  display: flex; gap: 4px; flex-wrap: wrap;
}
.cpub-compose-type-btn {
  font-size: 11px; font-weight: 600; padding: 4px 10px;
  border: 1px solid var(--border); background: var(--surface2);
  color: var(--text-dim); cursor: pointer;
  display: flex; align-items: center; gap: 4px;
}
.cpub-compose-type-btn.active {
  background: var(--accent-bg); border-color: var(--accent-border); color: var(--accent);
}
.cpub-compose-row { display: flex; gap: 8px; align-items: center; }
.cpub-compose-input {
  flex: 1; background: var(--surface2); border: 1px solid var(--border);
  padding: 10px 14px; font-size: 0.8125rem;
  color: var(--text); font-family: inherit;
}
.cpub-compose-input::placeholder { color: var(--text-faint); }
.cpub-fed-compose-hint {
  font-size: 11px; color: var(--text-faint);
  display: flex; align-items: center; gap: 5px;
}
.cpub-fed-compose-hint i { font-size: 10px; color: var(--accent); }

/* Shared content grid (projects tab) */
.cpub-hub-projects-tab { padding: 0; }
.cpub-shared-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.cpub-shared-card {
  background: var(--surface); border: var(--border-width-default) solid var(--border);
  overflow: hidden; text-decoration: none; color: inherit;
  transition: border-color 0.15s, transform 0.15s;
}
.cpub-shared-card:hover {
  border-color: var(--accent); transform: translateY(-2px);
}
.cpub-shared-card-img {
  height: 140px; overflow: hidden; background: var(--surface2);
}
.cpub-shared-card-img img { width: 100%; height: 100%; object-fit: cover; }
.cpub-shared-card-body { padding: 14px; }
.cpub-shared-card-type {
  font-size: 9px; font-family: var(--font-mono); text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--accent); background: var(--accent-bg);
  border: 1px solid var(--accent-border); padding: 2px 6px;
  display: inline-block; margin-bottom: 6px;
}
.cpub-shared-card-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.cpub-shared-card-desc {
  font-size: 12px; color: var(--text-dim); line-height: 1.5;
  overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  margin-bottom: 8px;
}
.cpub-shared-card-meta {
  display: flex; align-items: center; gap: 12px; font-size: 11px; color: var(--text-faint);
}
.cpub-shared-card-stat { display: flex; align-items: center; gap: 3px; }

/* Members tab (federated) */
.cpub-hub-members-tab { padding: 0; }
.cpub-fed-members-stat {
  font-size: 14px; font-weight: 600; color: var(--text-dim);
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 16px; padding: 0 4px;
}
.cpub-fed-members-stat i { color: var(--accent); }
.cpub-fed-members-known { color: var(--text-faint); font-weight: 400; }
.cpub-fed-members-list { display: flex; flex-direction: column; gap: 2px; }
.cpub-fed-member {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px;
  text-decoration: none; color: var(--text); border: var(--border-width-default) solid transparent;
  transition: border-color 0.15s;
}
.cpub-fed-member:hover { border-color: var(--border); background: var(--surface); }
.cpub-fed-member-avatar {
  width: 36px; height: 36px; border-radius: 50%; object-fit: cover;
  border: var(--border-width-default) solid var(--border); flex-shrink: 0;
}
.cpub-fed-member-avatar-fallback {
  display: flex; align-items: center; justify-content: center;
  background: var(--surface2); font-family: var(--font-mono); font-size: 12px; font-weight: 600; color: var(--text-dim);
}
.cpub-fed-member-info { flex: 1; min-width: 0; }
.cpub-fed-member-name { font-size: 13px; font-weight: 600; }
.cpub-fed-member-handle { font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-fed-member-posts { font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); white-space: nowrap; }
.cpub-fed-members-empty { font-size: 13px; color: var(--text-faint); text-align: center; padding: 32px 16px; }
.cpub-fed-members-origin-link { margin-top: 16px; display: inline-flex; }
.cpub-member-badge-mirrored {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.6875rem; font-weight: 600;
  color: var(--accent); background: var(--accent-bg);
  padding: 4px 12px; border: 1px solid var(--accent-border);
}

/* Sidebar */
.cpub-sidebar-desc { font-size: 12px; color: var(--text-dim); line-height: 1.5; margin-bottom: 12px; }
.cpub-sidebar-stats { display: flex; gap: 16px; }
.cpub-sidebar-stat { display: flex; flex-direction: column; font-size: 11px; color: var(--text-faint); }
.cpub-sidebar-stat strong { font-size: 16px; color: var(--text); font-weight: 700; }

.cpub-origin-info { font-size: 12px; }
.cpub-origin-domain {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; margin-bottom: 8px;
}
.cpub-origin-domain i { color: var(--accent); font-size: 11px; }
.cpub-origin-desc { color: var(--text-dim); line-height: 1.5; }

/* Rules (same as local hub) */
.cpub-rule-item {
  display: flex; align-items: flex-start; gap: 8px;
  font-size: 12px; color: var(--text-dim); line-height: 1.5;
  padding: 6px 0;
}
.cpub-rule-item + .cpub-rule-item { border-top: 1px solid var(--border2); }
.cpub-rule-num {
  font-family: var(--font-mono); font-size: 10px; font-weight: 700;
  color: var(--accent); flex-shrink: 0; width: 18px; text-align: center;
}

.cpub-not-found { text-align: center; padding: 60px 20px; color: var(--text-dim); }
.cpub-not-found h1 { font-size: 1.5rem; color: var(--text); margin-bottom: 8px; }

@media (max-width: 768px) {
  .cpub-fed-indicator { padding: 6px 16px; font-size: 11px; flex-wrap: wrap; }
  .cpub-compose-bar { padding: 10px 12px; }
  .cpub-shared-grid { grid-template-columns: 1fr; }
  .cpub-fed-member { padding: 10px 8px; }
}
</style>
