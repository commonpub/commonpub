<script setup lang="ts">
const route = useRoute();
const slug = computed(() => route.params.slug as string);

import type { Serialized, HubDetail, HubPostItem, HubMemberItem, PaginatedResponse, ContentListItem } from '@commonpub/server';

const { data: hub, pending: hubPending, error: hubError, refresh: refreshHub } = useLazyFetch<Serialized<HubDetail>>(() => `/api/hubs/${slug.value}`);
const { data: posts, refresh: refreshPosts } = useLazyFetch<Serialized<PaginatedResponse<HubPostItem>>>(() => `/api/hubs/${slug.value}/posts`, { default: () => ({ items: [], total: 0 }) });
const { data: membersData } = useLazyFetch<{ items: Serialized<HubMemberItem>[]; total: number }>(() => `/api/hubs/${slug.value}/members`);
const members = computed(() => membersData.value?.items ?? []);

const { data: gallery, refresh: refreshGallery } = useLazyFetch<PaginatedResponse<Serialized<ContentListItem>>>(() => `/api/hubs/${slug.value}/gallery`, { default: () => ({ items: [], total: 0 }) });

// Hub type
const hubType = computed(() => hub.value?.hubType ?? 'community');
const isProductHub = computed(() => hubType.value === 'product');
const isCompanyHub = computed(() => hubType.value === 'company');
const isCommunityHub = computed(() => hubType.value === 'community');

// Parse rules from string into array
const hubRules = computed<string[]>(() => {
  const raw = hub.value?.rules;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as string[];
  } catch {
    // Not JSON — split by newlines
  }
  return raw.split('\n').map((r: string) => r.trim()).filter(Boolean);
});

const { data: products } = useLazyFetch<{ items: Array<{ id: string; name: string; description: string | null; imageUrl: string | null; category: string | null; status: string }>; total: number }>(
  () => `/api/hubs/${slug.value}/products`,
  { default: () => ({ items: [], total: 0 }), immediate: isCompanyHub.value },
);

useSeoMeta({
  title: () => hub.value ? `${hub.value.name} — CommonPub` : 'Hub — CommonPub',
  description: () => hub.value?.description || '',
  ogImage: '/og-default.png',
});

const { isAuthenticated, user: authUser } = useAuth();
const hubTypeVal = hub.value?.hubType as string | undefined;
const initialTab = hubTypeVal === 'community' || !hubTypeVal ? 'feed' : 'overview';
const activeTab = ref(initialTab);
const newPostContent = ref('');
const newPostType = ref<'text' | 'question' | 'discussion' | 'showcase'>('text');
const posting = ref(false);

const postTypeOptions = [
  { value: 'text', label: 'Post', icon: 'fa-solid fa-pen' },
  { value: 'question', label: 'Question', icon: 'fa-solid fa-circle-question' },
  { value: 'discussion', label: 'Discussion', icon: 'fa-solid fa-comments' },
  { value: 'showcase', label: 'Showcase', icon: 'fa-solid fa-image' },
];
const postError = ref('');
const feedFilter = ref('all');

const c = computed(() => hub.value);

const tabDefs = computed(() => {
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
  // Community hub
  return [
    { value: 'feed', label: 'Feed', icon: 'fa-solid fa-rss', count: hub.value?.postCount },
    { value: 'projects', label: 'Projects', icon: 'fa-solid fa-folder-open', count: gallery.value?.total },
    { value: 'discussions', label: 'Discussions', icon: 'fa-solid fa-comments' },
    { value: 'members', label: 'Members', icon: 'fa-solid fa-users', count: hub.value?.memberCount },
  ];
});

const feedFilters = [
  { value: 'all', label: 'All Posts' },
  { value: 'question', label: 'Questions' },
  { value: 'discussion', label: 'Discussions' },
  { value: 'showcase', label: 'Showcase' },
  { value: 'announcement', label: 'Announcements' },
];

const moderators = computed(() => {
  if (!members.value) return [];
  return members.value.filter(
    (m: Serialized<HubMemberItem>) => m.role === 'owner' || m.role === 'moderator'
  );
});

function parseShareContent(content: string): { contentId: string; title: string; slug: string; type: string } | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.title && parsed.slug) return parsed;
  } catch { /* not JSON */ }
  return null;
}

const filteredPosts = computed(() => {
  const items = posts.value?.items ?? [];
  if (feedFilter.value === 'all') return items;
  return items.filter((p) => p.type === feedFilter.value);
});

const discussionPosts = computed(() => {
  const items = posts.value?.items ?? [];
  return items.filter((p) => p.type === 'text' || p.type === 'link' || p.type === 'discussion' || p.type === 'question');
});

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

const toast = useToast();

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

// ── Share existing project to hub ──
const showProjectPicker = ref(false);
const sharingProject = ref(false);
const { data: myProjects, refresh: refreshMyProjects } = useLazyFetch<{ items: Array<{ id: string; title: string; coverImageUrl?: string | null }> }>(() => `/api/content?authorId=${authUser.value?.id ?? ''}&type=project&status=published&limit=50`, {
  immediate: false,
});

async function openProjectPicker(): Promise<void> {
  showProjectPicker.value = true;
  await refreshMyProjects();
}

async function shareProjectToHub(contentId: string): Promise<void> {
  sharingProject.value = true;
  try {
    await $fetch(`/api/hubs/${slug.value}/share`, {
      method: 'POST',
      body: { contentId },
    });
    toast.success('Project shared to hub');
    showProjectPicker.value = false;
    await Promise.all([refreshGallery(), refreshPosts(), refreshHub()]);
  } catch {
    toast.error('Failed to share project');
  } finally {
    sharingProject.value = false;
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

const imageInput = ref<HTMLInputElement | null>(null);
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
</script>

<template>
  <div v-if="hubPending" class="cpub-loading">Loading hub...</div>
  <div v-else-if="hubError" class="cpub-fetch-error">
    <div class="cpub-fetch-error-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
    <div class="cpub-fetch-error-msg">Failed to load hub.</div>
    <button class="cpub-btn cpub-btn-sm" @click="refreshHub()">Retry</button>
  </div>
  <div v-else-if="c" class="cpub-hub-page">
    <!-- ═══ HUB HERO ═══ -->
    <div class="cpub-hub-hero">
      <div class="cpub-hub-banner" :style="c?.bannerUrl ? { backgroundImage: `url(${c.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}">
        <template v-if="!c?.bannerUrl">
          <div class="cpub-hub-banner-pattern"></div>
          <div class="cpub-hub-banner-dots"></div>
        </template>
      </div>
      <div class="cpub-hub-meta-bar">
        <div class="cpub-hub-meta-inner">
          <div class="cpub-hub-icon">
            <img v-if="c?.iconUrl" :src="c.iconUrl" :alt="c?.name ?? ''" />
            <i v-else :class="isCompanyHub ? 'fa-solid fa-building' : isProductHub ? 'fa-solid fa-microchip' : 'fa-solid fa-users'" />
          </div>
          <div class="cpub-hub-info">
            <div class="cpub-hub-top-row">
              <div>
                <h1 class="cpub-hub-name">{{ c.name }}</h1>
                <p v-if="c.description" class="cpub-hub-desc">{{ c.description }}</p>
                <div class="cpub-hub-stats">
                  <span class="cpub-hub-stat"><i class="fa-solid fa-users"></i> <span class="cpub-hub-stat-val">{{ c.memberCount ?? 0 }}</span> Members</span>
                  <span class="cpub-hub-stat"><i class="fa-solid fa-message"></i> <span class="cpub-hub-stat-val">{{ c.postCount ?? 0 }}</span> Posts</span>
                  <span v-if="gallery?.total" class="cpub-hub-stat"><i class="fa-solid fa-folder-open"></i> <span class="cpub-hub-stat-val">{{ gallery.total }}</span> Projects</span>
                  <span class="cpub-hub-stat"><i class="fa-solid fa-calendar"></i> Founded <span class="cpub-hub-stat-val">{{ new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) }}</span></span>
                </div>
                <div class="cpub-hub-actions">
                  <button v-if="isAuthenticated && !c.currentUserRole" class="cpub-btn cpub-btn-primary" @click="handleJoin">
                    <i class="fa-solid fa-plus"></i> Join Hub
                  </button>
                  <span v-else-if="c.currentUserRole" class="cpub-member-badge">
                    <i class="fa-solid fa-check"></i> Joined
                  </span>
                  <button class="cpub-btn cpub-btn-sm" aria-label="Share hub" @click="handleShare"><i class="fa-solid fa-share-nodes"></i></button>
                  <NuxtLink v-if="c.currentUserRole === 'owner'" :to="`/hubs/${slug}/settings`" class="cpub-btn cpub-btn-sm" aria-label="Hub settings"><i class="fa-solid fa-gear"></i> Settings</NuxtLink>
                </div>
              </div>
              <div class="cpub-hub-badges">
                <span v-if="c.isOfficial" class="cpub-tag cpub-tag-accent"><i class="fa-solid fa-shield-halved" style="margin-right: 3px"></i>Verified</span>
                <span v-if="c.joinPolicy === 'open'" class="cpub-tag cpub-tag-green">Open to All</span>
                <span v-else-if="c.joinPolicy === 'approval'" class="cpub-tag cpub-tag-yellow">Approval Required</span>
                <span v-else class="cpub-tag">Invite Only</span>
              </div>
            </div>
            <div v-if="c.categories?.length" class="cpub-hub-tags">
              <div class="cpub-tag-row">
                <span v-for="cat in c.categories" :key="cat" class="cpub-tag">{{ cat }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ TABS ═══ -->
    <div class="cpub-hub-tabs">
      <div class="cpub-tabs-inner">
        <button
          v-for="tab in tabDefs"
          :key="tab.value"
          class="cpub-tab-btn"
          :class="{ active: activeTab === tab.value }"
          @click="activeTab = tab.value"
        >
          <i :class="tab.icon" style="font-size: 10px"></i>
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- ═══ MAIN CONTENT ═══ -->
    <div class="cpub-hub-main">
      <div class="cpub-hub-layout">

        <!-- MAIN COLUMN -->
        <main>
          <!-- Feed tab -->
          <template v-if="activeTab === 'feed'">
            <!-- Pinned announcements -->
            <AnnouncementBand
              v-for="post in filteredPosts.filter(p => p.isPinned && p.type === ('announcement' as string))"
              :key="`ann-${post.id}`"
              :title="post.content?.slice(0, 80) || 'Announcement'"
              :body="post.content || ''"
              :author="post.author?.displayName || post.author?.username || 'Unknown'"
              :created-at="new Date(post.createdAt)"
              :pinned="true"
              style="margin-bottom: 12px"
            />
            <!-- Compose bar -->
            <div v-if="isAuthenticated" class="cpub-compose-bar">
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

            <!-- Feed filter -->
            <div class="cpub-tag-row" style="margin-bottom: 14px">
              <FilterChip
                v-for="f in feedFilters"
                :key="f.value"
                :label="f.label"
                :active="feedFilter === f.value"
                @toggle="feedFilter = f.value"
              />
            </div>

            <!-- Feed posts -->
            <div v-if="postError" class="cpub-post-error">{{ postError }}</div>
            <div v-if="filteredPosts.length" class="cpub-feed-list">
              <template v-for="post in filteredPosts" :key="post.id">
                <!-- Share posts: render as content card with thumbnail -->
                <NuxtLink v-if="post.type === 'share' && (post.sharedContent as Record<string, unknown>)?.slug" :to="`/${(post.sharedContent as Record<string, unknown>).type}/${(post.sharedContent as Record<string, unknown>).slug}`" class="cpub-share-card">
                  <div class="cpub-share-card-context">
                    <i class="fa-solid fa-share-nodes"></i>
                    {{ post.author?.displayName || post.author?.username }} shared a {{ (post.sharedContent as Record<string, unknown>).type }}
                    &middot; {{ new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
                  </div>
                  <div class="cpub-share-card-embed">
                    <div v-if="(post.sharedContent as Record<string, unknown>).coverImageUrl" class="cpub-share-card-thumb">
                      <img :src="String((post.sharedContent as Record<string, unknown>).coverImageUrl)" :alt="String((post.sharedContent as Record<string, unknown>).title)" />
                    </div>
                    <div v-else class="cpub-share-card-thumb cpub-share-card-thumb-fallback">
                      <i :class="(post.sharedContent as Record<string, unknown>).type === 'project' ? 'fa-solid fa-microchip' : 'fa-solid fa-file-lines'"></i>
                    </div>
                    <div class="cpub-share-card-body">
                      <span class="cpub-share-card-type">{{ (post.sharedContent as Record<string, unknown>).type }}</span>
                      <h3 class="cpub-share-card-title">{{ (post.sharedContent as Record<string, unknown>).title }}</h3>
                      <p v-if="(post.sharedContent as Record<string, unknown>).description" class="cpub-share-card-desc">{{ (post.sharedContent as Record<string, unknown>).description }}</p>
                    </div>
                  </div>
                </NuxtLink>
                <!-- Regular posts -->
                <NuxtLink v-else :to="`/hubs/${slug}/posts/${post.id}`" class="cpub-feed-link">
                  <FeedItem
                    :type="(post.type as 'discussion' | 'question' | 'showcase' | 'announcement') || 'discussion'"
                    :title="post.content?.slice(0, 80) || ''"
                    :author="post.author?.displayName || post.author?.username || 'Unknown'"
                    :body="post.content || ''"
                    :created-at="new Date(post.createdAt)"
                    :reply-count="post.replyCount ?? 0"
                    :vote-count="post.likeCount ?? 0"
                    :pinned="post.isPinned"
                    :locked="post.isLocked"
                  />
                </NuxtLink>
              </template>
            </div>
            <div v-else class="cpub-empty-state">
              <div class="cpub-empty-state-icon"><i class="fa-solid fa-message"></i></div>
              <p class="cpub-empty-state-title">No posts yet</p>
              <p class="cpub-empty-state-desc">Be the first to start a discussion!</p>
            </div>
          </template>

          <!-- Discussions tab (uses posts data filtered to text/link types) -->
          <template v-else-if="activeTab === 'discussions'">
            <!-- Compose bar for discussions -->
            <div v-if="isAuthenticated" class="cpub-compose-bar" style="margin-bottom: 16px">
              <div class="cpub-compose-row">
                <input
                  v-model="newPostContent"
                  class="cpub-compose-input"
                  type="text"
                  placeholder="Start a discussion or ask a question..."
                  @keydown.enter="newPostType = 'discussion'; handlePost()"
                />
                <button class="cpub-btn cpub-btn-sm" :class="{ 'cpub-btn-primary': newPostType === 'question' }" @click="newPostType = 'question'" title="Ask a question">
                  <i class="fa-solid fa-circle-question"></i>
                </button>
                <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="posting" @click="newPostType = 'discussion'; handlePost()">
                  <i class="fa-solid fa-paper-plane"></i> Post
                </button>
              </div>
            </div>
            <div v-if="discussionPosts.length" class="cpub-disc-list">
              <NuxtLink
                v-for="post in discussionPosts"
                :key="post.id"
                :to="`/hubs/${slug}/posts/${post.id}`"
                class="cpub-feed-link"
              >
                <DiscussionItem
                  :title="post.content?.slice(0, 80) || 'Untitled'"
                  :author="post.author?.displayName || post.author?.username || 'Unknown'"
                  :reply-count="post.replyCount ?? 0"
                  :vote-count="post.likeCount ?? 0"
                />
              </NuxtLink>
            </div>
            <div v-else class="cpub-empty-state">
              <div class="cpub-empty-state-icon"><i class="fa-solid fa-comments"></i></div>
              <p class="cpub-empty-state-title">No discussions yet</p>
              <p class="cpub-empty-state-desc">Be the first to start a conversation.</p>
            </div>
          </template>

          <!-- Members tab -->
          <template v-else-if="activeTab === 'members'">
            <div v-if="members?.length" class="cpub-members-grid">
              <MemberCard
                v-for="member in members"
                :key="member.userId"
                :username="member.user.username"
                :display-name="member.user.displayName || member.user.username"
                :role="(member.role as 'owner' | 'moderator' | 'member') || 'member'"
                :joined-at="new Date(member.joinedAt)"
              />
            </div>
            <div v-else class="cpub-empty-state">
              <div class="cpub-empty-state-icon"><i class="fa-solid fa-users"></i></div>
              <p class="cpub-empty-state-title">No members yet</p>
            </div>
          </template>

          <!-- Overview tab (product/company hubs) -->
          <template v-else-if="activeTab === 'overview'">
            <div class="cpub-product-overview">
              <div class="cpub-section-head">
                <h3 class="cpub-section-title">{{ isProductHub ? 'About This Product' : 'About' }}</h3>
              </div>
              <p class="cpub-prose-p">{{ c?.description || 'No description available.' }}</p>
              <div v-if="hub?.website" class="cpub-meta-link">
                <i class="fa-solid fa-link"></i>
                <a :href="hub.website" target="_blank" rel="noopener">{{ hub.website }}</a>
              </div>
            </div>
          </template>

          <!-- Projects/Gallery tab -->
          <template v-else-if="activeTab === 'projects'">
            <div v-if="isAuthenticated && c?.currentUserRole && !isProductHub" class="cpub-projects-actions" style="margin-bottom: 16px; display: flex; gap: 8px;">
              <NuxtLink :to="`/create?hub=${slug}`" class="cpub-btn cpub-btn-primary cpub-btn-sm">
                <i class="fa-solid fa-plus"></i> New Project
              </NuxtLink>
              <button class="cpub-btn cpub-btn-sm" @click="openProjectPicker">
                <i class="fa-solid fa-link"></i> Add Existing Project
              </button>
            </div>
            <div v-if="gallery?.items?.length" class="cpub-gallery-grid">
              <ContentCard
                v-for="item in gallery.items"
                :key="item.id"
                :item="item"
              />
            </div>
            <div v-else class="cpub-empty-state">
              <div class="cpub-empty-state-icon"><i class="fa-solid fa-folder-open"></i></div>
              <p class="cpub-empty-state-title">No projects yet</p>
              <p v-if="isProductHub" class="cpub-empty-state-desc">Projects that use this product in their BOM will appear here automatically.</p>
              <p v-else-if="c?.currentUserRole" class="cpub-empty-state-desc">Share your projects to this hub using the buttons above.</p>
              <p v-else class="cpub-empty-state-desc">Join this hub to share your projects here.</p>
            </div>

            <!-- Project Picker Modal -->
            <Teleport to="body">
              <div v-if="showProjectPicker" class="cpub-modal-backdrop" @click.self="showProjectPicker = false">
                <div class="cpub-modal-content">
                  <div class="cpub-modal-header">
                    <h3 class="cpub-modal-title">Add Project to Hub</h3>
                    <button class="cpub-modal-close" @click="showProjectPicker = false"><i class="fa-solid fa-xmark"></i></button>
                  </div>
                  <p class="cpub-modal-desc">Select one of your published projects to share to this hub.</p>
                  <div v-if="!myProjects?.items?.length" class="cpub-modal-empty">
                    <p>You don't have any published projects yet.</p>
                    <NuxtLink to="/create" class="cpub-btn cpub-btn-sm cpub-btn-primary" @click="showProjectPicker = false">Create One</NuxtLink>
                  </div>
                  <div v-else class="cpub-hub-picker">
                    <button
                      v-for="project in myProjects.items"
                      :key="project.id"
                      class="cpub-hub-pick-item"
                      :disabled="sharingProject"
                      @click="shareProjectToHub(project.id)"
                    >
                      <div class="cpub-hub-pick-icon">
                        <img v-if="project.coverImageUrl" :src="project.coverImageUrl" :alt="project.title" />
                        <i v-else class="fa-solid fa-folder-open"></i>
                      </div>
                      <span class="cpub-hub-pick-name">{{ project.title }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </Teleport>
          </template>

          <!-- Products tab (company hubs) -->
          <template v-else-if="activeTab === 'products'">
            <div v-if="products?.items?.length" class="cpub-products-grid">
              <div v-for="product in products.items" :key="product.id" class="cpub-product-card">
                <div class="cpub-product-card-icon">
                  <img v-if="product.imageUrl" :src="product.imageUrl" :alt="product.name" />
                  <i v-else class="fa-solid fa-microchip"></i>
                </div>
                <div class="cpub-product-card-body">
                  <h4 class="cpub-product-card-name">{{ product.name }}</h4>
                  <p class="cpub-product-card-desc">{{ product.description }}</p>
                  <div class="cpub-product-card-meta">
                    <span v-if="product.category" class="cpub-tag">{{ product.category }}</span>
                    <span v-if="product.status === 'discontinued'" class="cpub-tag cpub-tag-red">Discontinued</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="cpub-empty-state">
              <div class="cpub-empty-state-icon"><i class="fa-solid fa-microchip"></i></div>
              <p class="cpub-empty-state-title">No products listed yet</p>
            </div>
          </template>

          <!-- Generic empty for other tabs -->
          <template v-else>
            <div class="cpub-empty-state">
              <div class="cpub-empty-state-icon"><i class="fa-solid fa-folder-open"></i></div>
              <p class="cpub-empty-state-title">Coming soon</p>
            </div>
          </template>
        </main>

        <!-- SIDEBAR -->
        <aside class="cpub-hub-sidebar">
          <!-- Moderators -->
          <div class="cpub-sb-card">
            <div class="cpub-sb-title">Moderators</div>
            <div v-for="mod in moderators" :key="mod.userId" class="cpub-mod-item">
              <div class="cpub-mod-avatar">{{ (mod.user.displayName || mod.user.username || 'U').charAt(0).toUpperCase() }}</div>
              <div class="cpub-mod-info">
                <NuxtLink :to="`/u/${mod.user.username}`" class="cpub-mod-name">{{ mod.user.displayName || mod.user.username }}</NuxtLink>
                <div class="cpub-mod-role">{{ mod.role }}</div>
              </div>
            </div>
            <p v-if="!moderators.length" class="cpub-sidebar-empty">No moderators listed.</p>
          </div>

          <!-- Rules -->
          <div v-if="hubRules.length" class="cpub-sb-card">
            <div class="cpub-sb-title">Hub Rules</div>
            <div v-for="(rule, i) in hubRules" :key="i" class="cpub-rule-item">
              <span class="cpub-rule-num">{{ i + 1 }}</span>
              <span>{{ rule }}</span>
            </div>
          </div>

          <!-- Website -->
          <div v-if="hub?.website" class="cpub-sb-card">
            <div class="cpub-sb-title">Links</div>
            <div class="cpub-resource-item">
              <i class="fa-solid fa-link"></i>
              <a :href="hub.website" target="_blank" rel="noopener">{{ hub.website }}</a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>
  <div v-else class="cpub-empty-state" style="padding: 64px 24px">
    <p class="cpub-empty-state-title">Hub not found</p>
  </div>
</template>

<style scoped>
/* ─── HUB HERO ─── */
.cpub-hub-hero { position: relative; overflow: hidden; }

.cpub-hub-banner {
  height: 160px;
  background: var(--accent-bg);
  position: relative;
  overflow: hidden;
  border-bottom: 2px solid var(--border);
}

.cpub-hub-banner-pattern {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--border2) 1px, transparent 1px),
    linear-gradient(90deg, var(--border2) 1px, transparent 1px);
  background-size: 32px 32px;
  opacity: 0.5;
}

.cpub-hub-banner-dots {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(var(--accent) 1px, transparent 1px);
  background-size: 24px 24px;
  opacity: 0.08;
}

.cpub-hub-meta-bar {
  background: var(--surface);
  border-bottom: 2px solid var(--border);
  padding: 16px 0;
}

.cpub-hub-meta-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 32px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.cpub-hub-icon {
  width: 64px;
  height: 64px;
  background: var(--accent-bg);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
  margin-top: -32px;
  position: relative;
  z-index: 1;
  box-shadow: var(--shadow-md);
  color: var(--accent);
  overflow: hidden;
}
.cpub-hub-icon img { width: 100%; height: 100%; object-fit: cover; }

.cpub-hub-info { flex: 1; min-width: 0; }

.cpub-hub-top-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.cpub-hub-name {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 4px;
}

.cpub-hub-desc {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.5;
  max-width: 600px;
  margin-bottom: 10px;
}

.cpub-hub-stats {
  display: flex;
  align-items: center;
  gap: 20px;
  font-size: 11px;
  color: var(--text-dim);
  font-family: var(--font-mono);
  margin-bottom: 12px;
}

.cpub-hub-stat {
  display: flex;
  align-items: center;
  gap: 5px;
}

.cpub-hub-stat-val {
  color: var(--text);
  font-weight: 600;
}

.cpub-hub-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cpub-hub-badges {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.cpub-hub-tags { margin-top: 10px; }

.cpub-member-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--green);
  background: var(--green-bg);
  padding: 4px 12px;
  border: 2px solid var(--green-border);
}

/* ─── TABS ─── */
.cpub-hub-tabs {
  background: var(--surface);
  border-bottom: 2px solid var(--border);
  position: sticky;
  top: 48px;
  z-index: 90;
}

.cpub-tabs-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 32px;
  display: flex;
  gap: 2px;
}

.cpub-tab-btn {
  font-size: 12px;
  color: var(--text-dim);
  padding: 10px 14px;
  border: none;
  background: none;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  font-family: var(--font-mono);
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
  top: 2px;
}

.cpub-tab-btn:hover { color: var(--text); }
.cpub-tab-btn.active { color: var(--text); border-bottom-color: var(--accent); font-weight: 600; }

/* ─── LAYOUT ─── */
.cpub-hub-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 32px;
}

.cpub-hub-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 24px;
  align-items: start;
}

/* ─── COMPOSE BAR ─── */
.cpub-compose-bar {
  background: var(--surface);
  border: 2px solid var(--border);
  padding: 12px 14px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cpub-compose-types {
  display: flex;
  gap: 4px;
}

.cpub-compose-type-btn {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 4px 10px;
  background: none;
  border: 2px solid var(--border);
  color: var(--text-faint);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: border-color 0.1s, color 0.1s;
}
.cpub-compose-type-btn:hover { color: var(--text); border-color: var(--text-dim); }
.cpub-compose-type-btn.active { color: var(--accent); border-color: var(--accent); background: var(--accent-bg); }

.cpub-compose-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.cpub-compose-input {
  flex: 1;
  background: var(--surface2);
  border: 2px solid var(--border);
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-faint);
  cursor: pointer;
}

/* ─── FEED CARDS ─── */
.cpub-feed-list { display: flex; flex-direction: column; gap: 12px; }

.cpub-feed-card {
  background: var(--surface);
  border: 2px solid var(--border);
  overflow: hidden;
  transition: box-shadow 0.15s;
}

.cpub-feed-card:hover { box-shadow: var(--shadow-md); }

.cpub-announce-band {
  background: var(--yellow-bg);
  border-left: 4px solid var(--yellow);
}

.cpub-feed-header {
  padding: 14px 16px 10px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.cpub-feed-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface3);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--text-dim);
  flex-shrink: 0;
}

.cpub-feed-content { flex: 1; min-width: 0; }

.cpub-feed-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.cpub-feed-author { font-size: 12px; font-weight: 600; }
.cpub-feed-time { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-feed-dot { width: 2px; height: 2px; border-radius: 50%; background: var(--text-faint); }

.cpub-feed-type-badge {
  font-size: 9px;
  font-family: var(--font-mono);
  padding: 1px 6px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}

.cpub-badge-question { background: var(--accent-bg); color: var(--accent); border: 2px solid var(--accent-border); }
.cpub-badge-discussion { background: var(--purple-bg); color: var(--purple); border: 2px solid var(--purple-border); }
.cpub-badge-showcase { background: var(--teal-bg); color: var(--teal); border: 2px solid var(--teal-border); }
.cpub-badge-announcement { background: var(--yellow-bg); color: var(--yellow); border: 2px solid var(--yellow-border); }

.cpub-feed-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; line-height: 1.4; }
.cpub-feed-body { font-size: 12px; color: var(--text-dim); line-height: 1.55; margin-bottom: 10px; }

.cpub-feed-footer {
  padding: 8px 16px;
  border-top: 2px solid var(--border);
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface2);
}

.cpub-feed-action {
  font-size: 11px;
  color: var(--text-dim);
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 3px 6px;
  border: none;
  background: none;
  font-family: var(--font-mono);
}

.cpub-feed-action:hover { color: var(--text); background: var(--surface3); }
.cpub-feed-action i { font-size: 10px; }

.cpub-feed-actions-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ─── DISCUSSIONS ─── */
.cpub-disc-list { display: flex; flex-direction: column; gap: 8px; }

.cpub-disc-item {
  background: var(--surface);
  border: 2px solid var(--border);
  padding: 12px 14px;
  cursor: pointer;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  transition: box-shadow 0.15s;
}

.cpub-disc-item:hover { box-shadow: var(--shadow-md); }

.cpub-disc-votes {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  min-width: 28px;
}

.cpub-disc-vote-count { font-size: 13px; font-weight: 700; font-family: var(--font-mono); color: var(--text); }
.cpub-disc-vote-label { font-size: 8px; color: var(--text-faint); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.08em; }

.cpub-disc-info { flex: 1; min-width: 0; }
.cpub-disc-title { font-size: 12px; font-weight: 600; margin-bottom: 4px; line-height: 1.35; }
.cpub-disc-meta { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); display: flex; align-items: center; gap: 8px; }

.cpub-disc-replies { display: flex; flex-direction: column; align-items: center; gap: 2px; flex-shrink: 0; min-width: 28px; }
.cpub-disc-reply-count { font-size: 12px; font-weight: 600; font-family: var(--font-mono); color: var(--text-dim); }
.cpub-disc-reply-label { font-size: 8px; color: var(--text-faint); font-family: var(--font-mono); }

/* ─── MEMBERS ─── */
.cpub-members-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.cpub-member-card {
  background: var(--surface);
  border: 2px solid var(--border);
  padding: 16px;
  text-align: center;
}

.cpub-member-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--surface3);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--text-dim);
  margin: 0 auto 8px;
}

.cpub-member-name { font-size: 12px; font-weight: 600; margin-bottom: 2px; }
.cpub-member-handle { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-member-role { font-size: 9px; color: var(--accent); font-family: var(--font-mono); text-transform: uppercase; margin-top: 4px; }

/* ─── SIDEBAR ─── */
.cpub-hub-sidebar { min-width: 0; }

.cpub-mod-item { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.cpub-mod-item:last-child { margin-bottom: 0; }

.cpub-mod-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface3);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: var(--text-dim);
  flex-shrink: 0;
}

.cpub-mod-info { flex: 1; }
.cpub-mod-name { font-size: 11px; font-weight: 500; }
.cpub-mod-role { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }

.cpub-rule-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 11px;
  color: var(--text-dim);
}

.cpub-rule-num {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  width: 16px;
  flex-shrink: 0;
  margin-top: 1px;
}

.cpub-related-hub { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer; }
.cpub-related-hub:last-child { margin-bottom: 0; }

.cpub-hub-mini-icon {
  width: 28px;
  height: 28px;
  background: var(--surface2);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}

.cpub-hub-mini-info { flex: 1; }
.cpub-hub-mini-name { font-size: 11px; font-weight: 500; color: var(--text); text-decoration: none; }
.cpub-hub-mini-name:hover { color: var(--accent); }
.cpub-hub-mini-count { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }

.cpub-sidebar-empty { font-size: 11px; color: var(--text-faint); }

.cpub-resource-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-dim);
}
.cpub-resource-item i { font-size: 10px; color: var(--text-faint); width: 12px; }
.cpub-resource-item a { color: var(--accent); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpub-resource-item a:hover { text-decoration: underline; }

/* ─── POST ERROR ─── */
.cpub-post-error { font-size: 11px; color: var(--red); background: var(--red-bg); border: 2px solid var(--red-border); padding: 8px 12px; margin-bottom: 12px; font-family: var(--font-mono); }

/* ─── RESPONSIVE ─── */
@media (max-width: 1024px) {
  .cpub-hub-layout { grid-template-columns: 1fr; }
  .cpub-hub-top-row { flex-direction: column; }
  .cpub-members-grid { grid-template-columns: repeat(2, 1fr); }
}

/* ── Gallery Grid ── */
.cpub-gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

/* ── Products Grid ── */
.cpub-products-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.cpub-product-card {
  background: var(--surface);
  border: 2px solid var(--border);
  padding: 16px;
  display: flex;
  gap: 14px;
  align-items: flex-start;
  box-shadow: var(--shadow-md);
  cursor: pointer;
  transition: box-shadow var(--transition-fast), transform var(--transition-fast);
}

.cpub-product-card:hover {
  transform: translate(-1px, -1px);
  box-shadow: var(--shadow-md);
}

.cpub-product-card-icon {
  width: 48px;
  height: 48px;
  background: var(--surface2);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--text-faint);
  flex-shrink: 0;
}

.cpub-product-card-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cpub-product-card-body { flex: 1; min-width: 0; }

.cpub-product-card-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 4px;
}

.cpub-product-card-desc {
  font-size: 11px;
  color: var(--text-dim);
  line-height: 1.5;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cpub-product-card-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* ── Overview sections ── */
.cpub-product-overview,
.cpub-company-overview {
  max-width: 720px;
}

.cpub-prose-p {
  font-size: 14px;
  color: var(--text-dim);
  line-height: 1.7;
  margin-bottom: 16px;
}

.cpub-meta-link {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-faint);
}

.cpub-meta-link a {
  color: var(--accent);
  text-decoration: none;
}

.cpub-meta-link a:hover { text-decoration: underline; }

.cpub-section-title {
  font-size: 14px;
  font-weight: 700;
  font-family: var(--font-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-dim);
}

@media (max-width: 1024px) {
  .cpub-gallery-grid { grid-template-columns: repeat(2, 1fr); }
  .cpub-products-grid { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .cpub-hub-banner { height: 100px; }
  .cpub-hub-meta-inner { flex-direction: column; padding: 0 16px; }
  .cpub-hub-icon { margin-top: -24px; width: 52px; height: 52px; font-size: 20px; }
  .cpub-hub-name { font-size: 16px; }
  .cpub-hub-stats { flex-wrap: wrap; gap: 8px 14px; }
  .cpub-hub-actions { flex-wrap: wrap; }
  .cpub-hub-badges { flex-wrap: wrap; }
  .cpub-hub-main { padding: 16px; }
  .cpub-tabs-inner { padding: 0 16px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .cpub-tab-btn { white-space: nowrap; flex-shrink: 0; }
  .cpub-compose-bar { flex-wrap: wrap; }
  .cpub-compose-input { min-width: 0; }
  .cpub-members-grid { grid-template-columns: repeat(2, 1fr); }
  .cpub-gallery-grid { grid-template-columns: 1fr; }
  .cpub-products-grid { grid-template-columns: 1fr; }
}

@media (max-width: 400px) {
  .cpub-members-grid { grid-template-columns: 1fr; }
}

/* ─── PROJECT PICKER MODAL ─── */
.cpub-modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--color-surface-scrim, rgba(0,0,0,0.5));
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cpub-modal-content {
  background: var(--surface);
  border: 2px solid var(--border);
  box-shadow: var(--shadow-lg);
  padding: 24px;
  max-width: 420px;
  width: 90vw;
}

.cpub-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.cpub-modal-title {
  font-size: 16px;
  font-weight: 700;
}

.cpub-modal-close {
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
}
.cpub-modal-close:hover { color: var(--text); }

.cpub-modal-desc {
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 16px;
}

.cpub-modal-empty {
  text-align: center;
  padding: 20px 0;
  color: var(--text-faint);
  font-size: 13px;
}
.cpub-modal-empty p { margin-bottom: 12px; }

.cpub-hub-picker {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.cpub-hub-pick-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: none;
  border: 2px solid var(--border);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.1s;
}
.cpub-hub-pick-item:hover { border-color: var(--accent); background: var(--accent-bg); }
.cpub-hub-pick-item:disabled { opacity: 0.5; cursor: wait; }

.cpub-hub-pick-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface2);
  border: 2px solid var(--border);
  font-size: 12px;
  color: var(--text-faint);
  overflow: hidden;
  flex-shrink: 0;
}
.cpub-hub-pick-icon img { width: 100%; height: 100%; object-fit: cover; }

.cpub-hub-pick-name {
  font-size: 13px;
  font-weight: 500;
  flex: 1;
}

/* Feed item links */
.cpub-feed-link { text-decoration: none; color: inherit; display: block; }

/* Share card in feed */
.cpub-share-card { display: block; text-decoration: none; color: inherit; }
.cpub-share-card-context {
  font-size: 11px; color: var(--text-faint); padding: 0 0 6px;
  display: flex; align-items: center; gap: 5px;
}
.cpub-share-card-context i { font-size: 10px; }
.cpub-share-card-embed {
  display: flex; gap: 0;
  background: var(--surface); border: 2px solid var(--border);
  overflow: hidden; transition: border-color 0.15s;
}
.cpub-share-card:hover .cpub-share-card-embed { border-color: var(--accent-border); }
.cpub-share-card-thumb {
  width: 120px; min-height: 80px; flex-shrink: 0; overflow: hidden;
  background: var(--surface2);
}
.cpub-share-card-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cpub-share-card-thumb-fallback {
  display: flex; align-items: center; justify-content: center;
  color: var(--text-faint); font-size: 24px;
}
.cpub-share-card-body { flex: 1; min-width: 0; padding: 10px 14px; }
.cpub-share-card-type {
  font-family: var(--font-mono); font-size: 9px; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--accent); font-weight: 600;
}
.cpub-share-card-title {
  font-size: 14px; font-weight: 600; color: var(--text); margin-top: 2px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.cpub-share-card-desc {
  font-size: 12px; color: var(--text-dim); margin-top: 4px;
  display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;
}
.cpub-share-card:hover .cpub-share-card-chevron { color: var(--accent); }
</style>
