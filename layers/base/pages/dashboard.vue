<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

useSeoMeta({
  title: `Dashboard — ${useSiteName()}`,
  description: 'Your personal CommonPub dashboard.',
});

const { user } = useAuth();
const { learning: learningEnabled } = useFeatures();
const { enabledTypeMeta } = useContentTypes();
const reqHeaders = import.meta.server ? useRequestHeaders(['cookie']) : {};

const activeTab = ref<'content' | 'bookmarks' | 'learning'>('content');
const contentSort = ref<'newest' | 'oldest' | 'popular'>('newest');
const contentTypeFilter = ref('');

// My content (all statuses)
const { data: myContent, status: contentStatus } = await useFetch('/api/content', {
  query: { authorId: user.value?.id },
  headers: reqHeaders,
});

const contentTypeOptions = computed(() => [
  { value: '', label: 'All types' },
  ...enabledTypeMeta.value.map(m => ({ value: m.type, label: m.plural })),
]);

// Bookmarks
const { data: bookmarkData } = await useFetch('/api/social/bookmarks', {
  query: { limit: 10 },
  headers: reqHeaders,
  lazy: true,
});

// Learning enrollments
const { data: enrollments } = await useFetch('/api/learn/enrollments', {
  headers: reqHeaders,
  lazy: true,
  immediate: learningEnabled.value,
});

// Notification count
const { data: notifCount } = await useFetch('/api/notifications/count', {
  headers: reqHeaders,
  lazy: true,
});

const toast = useToast();

function filterByType<T extends { type: string }>(items: T[]): T[] {
  if (!contentTypeFilter.value) return items;
  return items.filter((i) => i.type === contentTypeFilter.value);
}

function sortItems<T extends { createdAt: string; viewCount?: number; likeCount?: number }>(items: T[]): T[] {
  const sorted = [...items];
  if (contentSort.value === 'oldest') {
    sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else if (contentSort.value === 'popular') {
    sorted.sort((a, b) => ((b.viewCount ?? 0) + (b.likeCount ?? 0)) - ((a.viewCount ?? 0) + (a.likeCount ?? 0)));
  } else {
    sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  return sorted;
}

const drafts = computed(() =>
  sortItems(filterByType((myContent.value?.items ?? []).filter((i: { status: string }) => i.status === 'draft'))),
);
const published = computed(() =>
  sortItems(filterByType((myContent.value?.items ?? []).filter((i: { status: string }) => i.status === 'published'))),
);

// Stats use ALL items (unfiltered) so totals don't change with filter selection
const allPublished = computed(() =>
  (myContent.value?.items ?? []).filter((i: { status: string }) => i.status === 'published'),
);
const allDrafts = computed(() =>
  (myContent.value?.items ?? []).filter((i: { status: string }) => i.status === 'draft'),
);
const totalViews = computed(() =>
  allPublished.value.reduce((sum, item) => sum + (item.viewCount ?? 0), 0),
);
const totalLikes = computed(() =>
  allPublished.value.reduce((sum, item) => sum + (item.likeCount ?? 0), 0),
);

// Content actions
const actionLoading = ref<string | null>(null);

async function unpublishItem(id: string): Promise<void> {
  if (!confirm('Unpublish this content? It will revert to draft.')) return;
  actionLoading.value = id;
  try {
    await $fetch(`/api/content/${id}`, { method: 'PUT', body: { status: 'draft' } });
    toast.success('Content unpublished');
    await refreshNuxtData();
  } catch {
    toast.error('Failed to unpublish');
  } finally {
    actionLoading.value = null;
  }
}

async function deleteItem(id: string, title: string): Promise<void> {
  if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
  actionLoading.value = id;
  try {
    await $fetch(`/api/content/${id}`, { method: 'DELETE' });
    toast.success('Content deleted');
    await refreshNuxtData();
  } catch {
    toast.error('Failed to delete');
  } finally {
    actionLoading.value = null;
  }
}
</script>

<template>
  <div class="cpub-dash">
    <div class="cpub-dash-header">
      <h1 class="cpub-dash-title">Dashboard</h1>
      <NuxtLink to="/create" class="cpub-dash-create-btn">
        <i class="fa-solid fa-plus"></i> Create
      </NuxtLink>
    </div>

    <!-- Stats row -->
    <div class="cpub-dash-stats">
      <div class="cpub-dash-stat">
        <span class="cpub-dash-stat-n">{{ allPublished.length }}</span>
        <span class="cpub-dash-stat-l">Published</span>
      </div>
      <div class="cpub-dash-stat">
        <span class="cpub-dash-stat-n">{{ allDrafts.length }}</span>
        <span class="cpub-dash-stat-l">Drafts</span>
      </div>
      <div class="cpub-dash-stat">
        <span class="cpub-dash-stat-n">{{ totalViews.toLocaleString() }}</span>
        <span class="cpub-dash-stat-l">Views</span>
      </div>
      <div class="cpub-dash-stat">
        <span class="cpub-dash-stat-n">{{ totalLikes }}</span>
        <span class="cpub-dash-stat-l">Likes</span>
      </div>
      <div class="cpub-dash-stat">
        <span class="cpub-dash-stat-n">{{ notifCount?.count ?? 0 }}</span>
        <span class="cpub-dash-stat-l">Unread</span>
      </div>
    </div>

    <!-- Tabs -->
    <div class="cpub-dash-tabs">
      <button
        :class="['cpub-dash-tab', { active: activeTab === 'content' }]"
        @click="activeTab = 'content'"
      >
        My Content
      </button>
      <button
        :class="['cpub-dash-tab', { active: activeTab === 'bookmarks' }]"
        @click="activeTab = 'bookmarks'"
      >
        Bookmarks
      </button>
      <button
        v-if="learningEnabled"
        :class="['cpub-dash-tab', { active: activeTab === 'learning' }]"
        @click="activeTab = 'learning'"
      >
        Learning
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="contentStatus === 'pending'" class="cpub-dash-panel" style="padding: 32px; text-align: center;">
      <i class="fa-solid fa-circle-notch fa-spin" style="color: var(--text-faint); font-size: 16px;"></i>
      <p style="font-size: 12px; color: var(--text-faint); margin-top: 8px;">Loading your content...</p>
    </div>

    <!-- Content tab -->
    <div v-else-if="activeTab === 'content'" class="cpub-dash-panel">
      <!-- Sort & filter controls -->
      <div class="cpub-dash-controls">
        <div class="cpub-dash-controls-left">
          <select v-model="contentTypeFilter" class="cpub-dash-select" aria-label="Filter by content type">
            <option v-for="opt in contentTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div class="cpub-dash-controls-right">
          <select v-model="contentSort" class="cpub-dash-select" aria-label="Sort order">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="popular">Most popular</option>
          </select>
        </div>
      </div>
      <!-- Drafts section -->
      <div v-if="drafts.length" class="cpub-dash-section">
        <h2 class="cpub-dash-section-title">Drafts</h2>
        <div class="cpub-dash-list">
          <div v-for="item in drafts" :key="item.id" class="cpub-dash-row">
            <NuxtLink :to="`/${item.type}/${item.slug}/edit`" class="cpub-dash-row-title">
              {{ item.title }}
            </NuxtLink>
            <span class="cpub-dash-row-meta">
              <ContentTypeBadge :type="item.type" />
              <time>{{ new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}</time>
            </span>
            <div class="cpub-dash-row-actions">
              <NuxtLink :to="`/${item.type}/${item.slug}/edit`" class="cpub-dash-action-btn" aria-label="Edit" title="Edit">
                <i class="fa-solid fa-pen"></i> Edit
              </NuxtLink>
              <button class="cpub-dash-action-btn cpub-dash-action-btn--danger" aria-label="Delete" title="Delete" :disabled="actionLoading === item.id" @click="deleteItem(item.id, item.title)">
                <i :class="actionLoading === item.id ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-trash'"></i> Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Published section -->
      <div class="cpub-dash-section">
        <h2 class="cpub-dash-section-title">Published</h2>
        <div class="cpub-dash-list">
          <div v-for="item in published" :key="item.id" class="cpub-dash-row">
            <NuxtLink :to="`/${item.type}/${item.slug}`" class="cpub-dash-row-title">
              {{ item.title }}
            </NuxtLink>
            <span class="cpub-dash-row-meta">
              <ContentTypeBadge :type="item.type" />
              <span><i class="fa-regular fa-eye"></i> {{ (item.viewCount ?? 0).toLocaleString() }}</span>
              <span><i class="fa-regular fa-heart"></i> {{ item.likeCount ?? 0 }}</span>
            </span>
            <div class="cpub-dash-row-actions">
              <NuxtLink :to="`/${item.type}/${item.slug}/edit`" class="cpub-dash-action-btn" aria-label="Edit" title="Edit">
                <i class="fa-solid fa-pen"></i> Edit
              </NuxtLink>
              <button class="cpub-dash-action-btn cpub-dash-action-btn--warn" aria-label="Unpublish" title="Unpublish" :disabled="actionLoading === item.id" @click="unpublishItem(item.id)">
                <i :class="actionLoading === item.id ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-eye-slash'"></i> Unpublish
              </button>
              <button class="cpub-dash-action-btn cpub-dash-action-btn--danger" aria-label="Delete" title="Delete" :disabled="actionLoading === item.id" @click="deleteItem(item.id, item.title)">
                <i :class="actionLoading === item.id ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-trash'"></i> Delete
              </button>
            </div>
          </div>
          <p v-if="!published.length" class="cpub-dash-empty">No published content yet.</p>
        </div>
      </div>
    </div>

    <!-- Bookmarks tab -->
    <div v-if="activeTab === 'bookmarks'" class="cpub-dash-panel">
      <div class="cpub-dash-list">
        <div v-for="bm in bookmarkData?.items ?? []" :key="bm.id" class="cpub-dash-row">
          <template v-if="bm.content">
            <NuxtLink :to="bm.isFederated ? `/mirror/${bm.targetId}` : `/${bm.content.type}/${bm.content.slug}`" class="cpub-dash-row-title">
              {{ bm.content.title }}
            </NuxtLink>
            <span class="cpub-dash-row-meta">
              <ContentTypeBadge :type="bm.content.type" />
              <span v-if="bm.isFederated && bm.content.originDomain" class="cpub-dash-row-fed"><i class="fa-solid fa-globe"></i> {{ bm.content.originDomain }}</span>
              <span v-if="bm.content.author">by {{ bm.content.author.displayName || bm.content.author.username }}</span>
            </span>
          </template>
          <template v-else>
            <span class="cpub-dash-row-title cpub-dash-row-removed">Removed content</span>
          </template>
        </div>
        <p v-if="!bookmarkData?.items?.length" class="cpub-dash-empty">
          No bookmarks yet. Bookmark content you want to revisit!
        </p>
      </div>
    </div>

    <!-- Learning tab -->
    <div v-if="learningEnabled && activeTab === 'learning'" class="cpub-dash-panel">
      <div class="cpub-dash-list">
        <div v-for="enrollment in enrollments ?? []" :key="enrollment.path?.id ?? enrollment.id" class="cpub-dash-row">
          <NuxtLink :to="`/learn/${enrollment.path?.slug}`" class="cpub-dash-row-title">
            {{ enrollment.path?.title ?? 'Learning Path' }}
          </NuxtLink>
          <span class="cpub-dash-row-meta">
            <span v-if="enrollment.completedAt" class="cpub-dash-badge cpub-dash-badge--green">
              <i class="fa-solid fa-check"></i> Complete
            </span>
            <span v-else class="cpub-dash-badge">
              {{ enrollment.progress ?? 0 }}% progress
            </span>
          </span>
        </div>
        <p v-if="!enrollments?.length" class="cpub-dash-empty">
          Not enrolled in any learning paths. <NuxtLink to="/learn" class="cpub-link">Browse paths</NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-dash {
  max-width: var(--content-max-width, 960px);
  margin: 0 auto;
  padding: var(--space-8) var(--space-6);
}

.cpub-dash-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.cpub-dash-title {
  font-size: 22px;
  font-weight: 700;
}

.cpub-dash-create-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background: var(--accent);
  color: var(--color-text-inverse);
  border: var(--border-width-default) solid var(--border);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  box-shadow: var(--shadow-md);
  cursor: pointer;
}

.cpub-dash-create-btn:hover {
  box-shadow: var(--shadow-sm);
}

/* Stats */
.cpub-dash-stats {
  display: flex;
  gap: 0;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  margin-bottom: 24px;
}

.cpub-dash-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 16px 12px;
  border-right: var(--border-width-default) solid var(--border);
}

.cpub-dash-stat:last-child {
  border-right: none;
}

.cpub-dash-stat-n {
  font-size: 20px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text);
}

.cpub-dash-stat-l {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Tabs */
.cpub-dash-tabs {
  display: flex;
  gap: 0;
  border-bottom: var(--border-width-default) solid var(--border);
  margin-bottom: 0;
}

.cpub-dash-tab {
  padding: 10px 18px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-dim);
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  transition: color 0.1s;
}

.cpub-dash-tab:hover {
  color: var(--text);
}

.cpub-dash-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

/* Controls */
.cpub-dash-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: var(--border-width-default) solid var(--border);
  gap: 8px;
}

.cpub-dash-controls-left,
.cpub-dash-controls-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cpub-dash-select {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 4px 8px;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  color: var(--text-dim);
  cursor: pointer;
  outline: none;
  border-radius: var(--radius);
}

.cpub-dash-select:focus {
  border-color: var(--accent);
}

/* Panel */
.cpub-dash-panel {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  border-top: none;
}

.cpub-dash-section {
  border-bottom: var(--border-width-default) solid var(--border);
}

.cpub-dash-section:last-child {
  border-bottom: none;
}

.cpub-dash-section-title {
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-faint);
  padding: 12px 16px 8px;
}

.cpub-dash-list {
  display: flex;
  flex-direction: column;
}

.cpub-dash-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: var(--border-width-default) solid var(--border2);
}

.cpub-dash-row:last-child {
  border-bottom: none;
}

.cpub-dash-row-title {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  text-decoration: none;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cpub-dash-row-title:hover {
  color: var(--accent);
}

.cpub-dash-row-removed {
  color: var(--text-faint);
  font-style: italic;
}

.cpub-dash-row-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  flex-shrink: 0;
}

.cpub-dash-row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.cpub-dash-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-faint);
  text-decoration: none;
  background: none;
  border: var(--border-width-default) solid var(--border2);
  cursor: pointer;
  transition: color 0.1s, border-color 0.1s;
}

.cpub-dash-action-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
}

.cpub-dash-action-btn--warn {
  color: var(--text-dim);
}

.cpub-dash-action-btn--warn:hover {
  color: var(--yellow);
  border-color: var(--yellow);
  background: var(--yellow-bg);
}

.cpub-dash-action-btn--danger:hover {
  color: var(--red);
  border-color: var(--red);
  background: var(--red-bg);
}

.cpub-dash-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cpub-dash-badge {
  font-size: 10px;
  font-family: var(--font-mono);
  padding: 2px 8px;
  border: var(--border-width-default) solid var(--border2);
  background: var(--surface2);
  color: var(--text-dim);
}

.cpub-dash-badge--green {
  border-color: var(--green-border);
  background: var(--green-bg);
  color: var(--green);
}

.cpub-dash-empty {
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--text-faint);
}

@media (max-width: 640px) {
  .cpub-dash-stats {
    flex-wrap: wrap;
  }
  .cpub-dash-stat {
    min-width: 33%;
  }
  .cpub-dash-row {
    flex-wrap: wrap;
  }
  .cpub-dash-row-actions {
    width: 100%;
    margin-top: 4px;
  }
}
</style>
