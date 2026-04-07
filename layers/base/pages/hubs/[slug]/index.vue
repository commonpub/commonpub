<script setup lang="ts">
import type { Serialized, HubDetail, HubPostItem, HubMemberItem, PaginatedResponse, ContentListItem } from '@commonpub/server';
import type { HubViewModel, HubPostViewModel, HubMemberViewModel, HubTabDef } from '../../../types/hub';

const route = useRoute();
const slug = computed(() => route.params.slug as string);

function remoteDomain(uri: string | undefined): string | null {
  if (!uri) return null;
  try { return new URL(uri).hostname; } catch { return 'fediverse'; }
}


// --- Data fetching (unchanged) ---
const { data: hub, pending: hubPending, error: hubError, refresh: refreshHub } = useLazyFetch<Serialized<HubDetail>>(() => `/api/hubs/${slug.value}`);
const { data: posts, refresh: refreshPosts } = useLazyFetch<Serialized<PaginatedResponse<HubPostItem>>>(() => `/api/hubs/${slug.value}/posts`, { default: () => ({ items: [], total: 0 }) });
const { data: membersData } = useLazyFetch<{ items: Serialized<HubMemberItem>[]; total: number; remoteMembers?: Array<{ followerActorUri: string; displayName: string | null; preferredUsername: string | null; avatarUrl: string | null; instanceDomain: string; joinedAt: string }> }>(() => `/api/hubs/${slug.value}/members`);
const { data: gallery, refresh: refreshGallery } = useLazyFetch<PaginatedResponse<Serialized<ContentListItem>>>(() => `/api/hubs/${slug.value}/gallery`, { default: () => ({ items: [], total: 0 }) });

const hubType = computed(() => hub.value?.hubType ?? 'community');
const isProductHub = computed(() => hubType.value === 'product');
const isCompanyHub = computed(() => hubType.value === 'company');

const { data: products } = useLazyFetch<{ items: Array<{ id: string; name: string; description: string | null; imageUrl: string | null; category: string | null; status: string }>; total: number }>(
  () => `/api/hubs/${slug.value}/products`,
  { default: () => ({ items: [], total: 0 }), immediate: isCompanyHub.value },
);

useSeoMeta({
  title: () => hub.value ? `${hub.value.name} -- ${useSiteName()}` : `Hub -- ${useSiteName()}`,
  description: () => hub.value?.description || '',
  ogImage: '/og-default.png',
});

const { isAuthenticated, user: authUser } = useAuth();
const initialTab = hubType.value === 'community' || !hub.value?.hubType ? 'feed' : 'overview';
const activeTab = ref(initialTab);

// --- Map to view models ---
const hubVM = computed<HubViewModel | null>(() => {
  if (!hub.value) return null;
  return {
    name: hub.value.name,
    description: hub.value.description,
    iconUrl: hub.value.iconUrl,
    bannerUrl: hub.value.bannerUrl,
    hubType: (hub.value.hubType as 'community' | 'product' | 'company') ?? 'community',
    memberCount: hub.value.memberCount ?? 0,
    postCount: hub.value.postCount ?? 0,
    foundedLabel: new Date(hub.value.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    isOfficial: hub.value.isOfficial ?? false,
    joinPolicy: hub.value.joinPolicy ?? null,
    categories: hub.value.categories as string[] | null,
    website: hub.value.website,
  };
});

const postsVM = computed<HubPostViewModel[]>(() => {
  return (posts.value?.items ?? []).map((p) => ({
    id: p.id,
    type: p.type,
    content: p.content || '',
    author: {
      name: p.author?.displayName || p.author?.username || p.remoteActorName || 'Unknown',
      handle: p.author ? null : remoteDomain(p.remoteActorUri ?? undefined),
      avatarUrl: p.author?.avatarUrl ?? null,
    },
    createdAt: p.createdAt,
    likeCount: p.likeCount ?? 0,
    replyCount: p.replyCount ?? 0,
    isPinned: p.isPinned ?? false,
    isLocked: p.isLocked ?? false,
    linkTo: `/hubs/${slug.value}/posts/${p.id}`,
    ...(p.sharedContent ? {
      sharedContent: {
        type: (p.sharedContent as Record<string, unknown>).type as string,
        slug: (p.sharedContent as Record<string, unknown>).slug as string,
        title: (p.sharedContent as Record<string, unknown>).title as string,
        description: ((p.sharedContent as Record<string, unknown>).description as string | null) ?? null,
        coverImageUrl: ((p.sharedContent as Record<string, unknown>).coverImageUrl as string | null) ?? null,
        authorUsername: ((p.sharedContent as Record<string, unknown>).authorUsername as string | undefined) ?? undefined,
      },
    } : {}),
  }));
});

const membersVM = computed<HubMemberViewModel[]>(() => {
  return (membersData.value?.items ?? []).map((m) => ({
    name: m.user.displayName || m.user.username || 'Unknown',
    username: m.user.username,
    role: m.role,
    avatarUrl: m.user.avatarUrl ?? null,
    profileLink: `/u/${m.user.username}`,
    joinedAt: m.joinedAt,
  }));
});

const remoteMembersVM = computed(() => {
  const raw = membersData.value?.remoteMembers;
  if (!raw?.length) return [];
  return raw.map(rm => ({
    actorUri: rm.followerActorUri,
    name: rm.displayName || rm.preferredUsername || 'Unknown',
    instanceDomain: rm.instanceDomain,
    avatarUrl: rm.avatarUrl,
  }));
});

const moderators = computed(() => {
  return membersVM.value.filter((m) => m.role === 'owner' || m.role === 'moderator');
});

const hubRules = computed<string[]>(() => {
  const raw = hub.value?.rules;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw as string);
    if (Array.isArray(parsed)) return parsed as string[];
  } catch { /* not JSON */ }
  return (raw as string).split('\n').map((r: string) => r.trim()).filter(Boolean);
});

const tabDefs = computed<HubTabDef[]>(() => {
  if (isProductHub.value) {
    return [
      { value: 'overview', label: 'Overview', icon: 'fa-solid fa-info-circle' },
      { value: 'projects', label: 'Projects Using This', icon: 'fa-solid fa-folder-open', count: gallery.value?.total },
      { value: 'discussions', label: 'Discussions', icon: 'fa-solid fa-comments' },
    ];
  }
  if (isCompanyHub.value) {
    return [
      { value: 'overview', label: 'Overview', icon: 'fa-solid fa-building' },
      { value: 'products', label: 'Products', icon: 'fa-solid fa-microchip', count: products.value?.total },
      { value: 'projects', label: 'Projects', icon: 'fa-solid fa-folder-open', count: gallery.value?.total },
      { value: 'discussions', label: 'Discussions', icon: 'fa-solid fa-comments' },
    ];
  }
  return [
    { value: 'feed', label: 'Feed', icon: 'fa-solid fa-rss', count: hub.value?.postCount },
    { value: 'projects', label: 'Projects', icon: 'fa-solid fa-folder-open', count: gallery.value?.total },
    { value: 'discussions', label: 'Discussions', icon: 'fa-solid fa-comments' },
    { value: 'members', label: 'Members', icon: 'fa-solid fa-users', count: hub.value?.memberCount },
  ];
});

const toast = useToast();

// --- Compose bar state (local-only, passed via slot) ---
const newPostContent = ref('');
const newPostType = ref<'text' | 'question' | 'discussion' | 'showcase'>('text');
const posting = ref(false);
const postError = ref('');
const imageInput = ref<HTMLInputElement | null>(null);

const postTypeOptions = [
  { value: 'text', label: 'Post', icon: 'fa-solid fa-pen' },
  { value: 'question', label: 'Question', icon: 'fa-solid fa-circle-question' },
  { value: 'discussion', label: 'Discussion', icon: 'fa-solid fa-comments' },
  { value: 'showcase', label: 'Showcase', icon: 'fa-solid fa-image' },
];

// --- Discussion compose state ---
const newDiscContent = ref('');
const newDiscType = ref<'discussion' | 'question'>('discussion');
const discPosting = ref(false);

async function handlePost(): Promise<void> {
  if (!newPostContent.value.trim()) return;
  posting.value = true;
  try {
    await $fetch(`/api/hubs/${slug.value}/posts`, {
      method: 'POST',
      body: { content: newPostContent.value, type: newPostType.value },
    });
    newPostContent.value = '';
    newPostType.value = 'text';
    postError.value = '';
    await Promise.all([refreshHub(), refreshPosts()]);
  } catch (e) {
    const fetchErr = e as { data?: { statusMessage?: string }; message?: string };
    postError.value = fetchErr?.data?.statusMessage || fetchErr?.message || 'Failed to create post';
  } finally {
    posting.value = false;
  }
}

async function handleDiscPost(): Promise<void> {
  if (!newDiscContent.value.trim()) return;
  discPosting.value = true;
  try {
    await $fetch(`/api/hubs/${slug.value}/posts`, {
      method: 'POST',
      body: { content: newDiscContent.value, type: newDiscType.value },
    });
    newDiscContent.value = '';
    newDiscType.value = 'discussion';
    await Promise.all([refreshHub(), refreshPosts()]);
  } catch {
    toast.error('Failed to create post');
  } finally {
    discPosting.value = false;
  }
}

function openImagePicker(): void {
  imageInput.value?.click();
}

async function handleImageUpload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  try {
    const result = await $fetch<{ url: string }>('/api/files/upload', { method: 'POST', body: formData });
    newPostContent.value += (newPostContent.value ? ' ' : '') + result.url;
    toast.success('Image uploaded');
  } catch {
    toast.error('Upload failed');
  }
  input.value = '';
}

function handleLinkInsert(): void {
  const url = prompt('Enter a URL:');
  if (url) {
    newPostContent.value += (newPostContent.value ? ' ' : '') + url;
  }
}

async function handleJoin(): Promise<void> {
  if (!isAuthenticated.value) {
    await navigateTo(`/auth/login?redirect=/hubs/${slug.value}`);
    return;
  }
  try {
    await $fetch(`/api/hubs/${slug.value}/join`, { method: 'POST' });
    toast.success('Joined hub!');
    await refreshHub();
  } catch {
    toast.error('Failed to join hub');
  }
}

async function handleShare(): Promise<void> {
  const url = `${window.location.origin}/hubs/${slug.value}`;
  if (navigator.share) {
    await navigator.share({ title: hub.value?.name || 'Hub', url }).catch(() => {});
  } else {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  }
}

async function onRefreshGallery(): Promise<void> {
  await Promise.all([refreshGallery(), refreshPosts(), refreshHub()]);
}
</script>

<template>
  <div v-if="hubPending" class="cpub-loading">Loading hub...</div>
  <div v-else-if="hubError" class="cpub-fetch-error">
    <div class="cpub-fetch-error-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
    <div class="cpub-fetch-error-msg">Failed to load hub.</div>
    <button class="cpub-btn cpub-btn-sm" @click="refreshHub()">Retry</button>
  </div>

  <HubLayout v-else-if="hubVM" v-model:active-tab="activeTab" :tabs="tabDefs">
    <template #hero>
      <HubHero :hub="hubVM" :gallery-total="gallery?.total">
        <template #actions>
          <button v-if="isAuthenticated && !hub?.currentUserRole" class="cpub-btn cpub-btn-primary" @click="handleJoin">
            <i class="fa-solid fa-plus"></i> Join Hub
          </button>
          <span v-else-if="hub?.currentUserRole" class="cpub-member-badge">
            <i class="fa-solid fa-check"></i> Joined
          </span>
          <button class="cpub-btn cpub-btn-sm" aria-label="Share hub" @click="handleShare"><i class="fa-solid fa-share-nodes"></i></button>
          <NuxtLink v-if="hub?.currentUserRole === 'owner'" :to="`/hubs/${slug}/settings`" class="cpub-btn cpub-btn-sm" aria-label="Hub settings"><i class="fa-solid fa-gear"></i> Settings</NuxtLink>
        </template>
        <template #badges>
          <span v-if="hub?.isOfficial" class="cpub-tag cpub-tag-accent"><i class="fa-solid fa-shield-halved" style="margin-right: 3px"></i>Verified</span>
          <span v-if="hub?.joinPolicy === 'open'" class="cpub-tag cpub-tag-green">Open to All</span>
          <span v-else-if="hub?.joinPolicy === 'approval'" class="cpub-tag cpub-tag-yellow">Approval Required</span>
          <span v-else class="cpub-tag">Invite Only</span>
        </template>
      </HubHero>
    </template>

    <!-- Main content area -->

    <!-- Feed tab -->
    <HubFeed v-if="activeTab === 'feed'" :posts="postsVM">
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
              :placeholder="newPostType === 'question' ? 'Ask the community a question...' : newPostType === 'discussion' ? 'Start a discussion...' : newPostType === 'showcase' ? 'Share what you built...' : 'Write a post...'"
              @keydown.enter="handlePost"
            />
            <input ref="imageInput" type="file" accept="image/*" style="display: none" @change="handleImageUpload" />
            <button class="cpub-btn cpub-btn-sm" aria-label="Upload image" @click="openImagePicker"><i class="fa-solid fa-image"></i></button>
            <button class="cpub-btn cpub-btn-sm" aria-label="Insert link" @click="handleLinkInsert"><i class="fa-solid fa-link"></i></button>
            <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="posting" @click="handlePost">
              <i class="fa-solid fa-paper-plane"></i> Post
            </button>
          </div>
        </div>
        <div v-if="postError" class="cpub-post-error">{{ postError }}</div>
      </template>
    </HubFeed>

    <!-- Discussions tab -->
    <HubDiscussions v-else-if="activeTab === 'discussions'" :posts="postsVM">
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
        </div>
      </template>
    </HubDiscussions>

    <!-- Members tab -->
    <HubMembers v-else-if="activeTab === 'members'" :members="membersVM" :remote-members="remoteMembersVM" />

    <!-- Overview tab -->
    <template v-else-if="activeTab === 'overview'">
      <div class="cpub-product-overview">
        <h3 class="cpub-section-title">{{ isProductHub ? 'About This Product' : 'About' }}</h3>
        <p class="cpub-prose-p">{{ hub?.description || 'No description available.' }}</p>
        <div v-if="hub?.website" class="cpub-meta-link">
          <i class="fa-solid fa-link"></i>
          <a :href="hub.website" target="_blank" rel="noopener">{{ hub.website }}</a>
        </div>
      </div>
    </template>

    <!-- Projects tab -->
    <HubProjects
      v-else-if="activeTab === 'projects'"
      :slug="slug"
      :gallery="gallery"
      :is-authenticated="isAuthenticated"
      :current-user-role="hub?.currentUserRole ?? null"
      :is-product-hub="isProductHub"
      :auth-user-id="authUser?.id"
      @refresh-gallery="onRefreshGallery"
    />

    <!-- Products tab -->
    <HubProducts v-else-if="activeTab === 'products'" :products="products" />

    <!-- Sidebar -->
    <template #sidebar>
      <HubSidebar>
        <HubSidebarCard title="Moderators">
          <div v-for="mod in moderators" :key="mod.username" class="cpub-mod-item">
            <div class="cpub-mod-avatar">
              <img v-if="mod.avatarUrl" :src="mod.avatarUrl" :alt="mod.name" class="cpub-mod-avatar-img" />
              <span v-else>{{ mod.name.charAt(0).toUpperCase() }}</span>
            </div>
            <div class="cpub-mod-info">
              <NuxtLink :to="mod.profileLink" class="cpub-mod-name">{{ mod.name }}</NuxtLink>
              <div class="cpub-mod-role">{{ mod.role }}</div>
            </div>
          </div>
          <p v-if="!moderators.length" class="cpub-sidebar-empty">No moderators listed.</p>
        </HubSidebarCard>

        <HubSidebarCard v-if="hubRules.length" title="Hub Rules">
          <div v-for="(rule, i) in hubRules" :key="i" class="cpub-rule-item">
            <span class="cpub-rule-num">{{ i + 1 }}</span>
            <span>{{ rule }}</span>
          </div>
        </HubSidebarCard>

        <HubSidebarCard v-if="hub?.website" title="Links">
          <div class="cpub-resource-item">
            <i class="fa-solid fa-link"></i>
            <a :href="hub.website" target="_blank" rel="noopener">{{ hub.website }}</a>
          </div>
        </HubSidebarCard>
      </HubSidebar>
    </template>
  </HubLayout>

  <div v-else class="cpub-empty-state" style="padding: 64px 24px">
    <p class="cpub-empty-state-title">Hub not found</p>
  </div>
</template>

<style scoped>
/* Compose bar */
.cpub-compose-bar {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cpub-compose-types { display: flex; gap: 4px; }

.cpub-compose-type-btn {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 4px 10px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-faint);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: border-color 0.1s, color 0.1s;
}
.cpub-compose-type-btn:hover { color: var(--text); border-color: var(--text-dim); }
.cpub-compose-type-btn.active { color: var(--accent); border-color: var(--accent); background: var(--accent-bg); }

.cpub-compose-row { display: flex; gap: 10px; align-items: center; }

.cpub-compose-input {
  flex: 1;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 0.8125rem;
  color: var(--text-faint);
  cursor: pointer;
}

.cpub-post-error { font-size: 0.75rem; color: var(--red); background: var(--red-bg); border: 1px solid var(--red-border); border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; }

/* Member badge */
.cpub-member-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--green);
  background: var(--green-bg);
  padding: 4px 12px;
  border: 1px solid var(--green-border);
  border-radius: 20px;
}

/* Sidebar content */
.cpub-mod-item { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.cpub-mod-item:last-child { margin-bottom: 0; }

.cpub-mod-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--accent-bg); border: 1px solid var(--accent-border);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; color: var(--accent); flex-shrink: 0;
  overflow: hidden;
}
.cpub-mod-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
.cpub-mod-info { flex: 1; }
.cpub-mod-name { font-size: 11px; font-weight: 500; }
.cpub-mod-role { font-size: 0.6875rem; color: var(--text-faint); }

.cpub-rule-item {
  display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px;
  font-size: 11px; color: var(--text-dim);
}
.cpub-rule-num {
  font-size: 10px; font-family: var(--font-mono); color: var(--text-faint);
  width: 16px; flex-shrink: 0; margin-top: 1px;
}

.cpub-sidebar-empty { font-size: 11px; color: var(--text-faint); }

.cpub-resource-item {
  display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-dim);
}
.cpub-resource-item i { font-size: 10px; color: var(--text-faint); width: 12px; }
.cpub-resource-item a { color: var(--accent); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpub-resource-item a:hover { text-decoration: underline; }

/* Overview */
.cpub-product-overview { max-width: 720px; }
.cpub-section-title { font-size: 0.875rem; font-weight: 700; color: var(--text-dim); }
.cpub-prose-p { font-size: 14px; color: var(--text-dim); line-height: 1.7; margin-bottom: 16px; }
.cpub-meta-link { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-faint); }
.cpub-meta-link a { color: var(--accent); text-decoration: none; }
.cpub-meta-link a:hover { text-decoration: underline; }

@media (max-width: 640px) {
  .cpub-compose-bar { flex-wrap: wrap; }
  .cpub-compose-input { min-width: 0; }
}
</style>
