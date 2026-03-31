<script setup lang="ts">
import type { HubPostViewModel } from '../../types/hub';

const props = defineProps<{
  posts: HubPostViewModel[];
  interactive?: boolean;
}>();

const emit = defineEmits<{ 'post-vote': [postId: string] }>();

const feedFilter = ref('all');

const feedFilters = [
  { value: 'all', label: 'All Posts' },
  { value: 'question', label: 'Questions' },
  { value: 'discussion', label: 'Discussions' },
  { value: 'showcase', label: 'Showcase' },
  { value: 'announcement', label: 'Announcements' },
];

const filteredPosts = computed(() => {
  if (feedFilter.value === 'all') return props.posts;
  return props.posts.filter((p) => p.type === feedFilter.value);
});
</script>

<template>
  <!-- Pinned announcements -->
  <AnnouncementBand
    v-for="post in filteredPosts.filter(p => p.isPinned && p.type === 'announcement')"
    :key="`ann-${post.id}`"
    :title="post.content?.slice(0, 80) || 'Announcement'"
    :body="post.content || ''"
    :author="post.author.name"
    :created-at="new Date(post.createdAt)"
    :pinned="true"
    style="margin-bottom: 12px"
  />

  <!-- Compose slot (page provides compose bar for local, nothing for federated) -->
  <slot name="compose" />

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
  <div v-if="filteredPosts.length" class="cpub-feed-list">
    <template v-for="post in filteredPosts" :key="post.id">
      <!-- Share posts -->
      <NuxtLink v-if="post.sharedContent?.slug" :to="`/${post.sharedContent.type}/${post.sharedContent.slug}`" class="cpub-share-card">
        <div class="cpub-share-card-context">
          <i class="fa-solid fa-share-nodes"></i>
          {{ post.author.name }} shared a {{ post.sharedContent.type }}
          &middot; {{ new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
        </div>
        <div class="cpub-share-card-embed">
          <div v-if="post.sharedContent.coverImageUrl" class="cpub-share-card-thumb">
            <img :src="post.sharedContent.coverImageUrl" :alt="post.sharedContent.title" />
          </div>
          <div v-else class="cpub-share-card-thumb cpub-share-card-thumb-fallback">
            <i :class="post.sharedContent.type === 'project' ? 'fa-solid fa-microchip' : 'fa-solid fa-file-lines'"></i>
          </div>
          <div class="cpub-share-card-body">
            <span class="cpub-share-card-type">{{ post.sharedContent.type }}</span>
            <h3 class="cpub-share-card-title">{{ post.sharedContent.title }}</h3>
            <p v-if="post.sharedContent.description" class="cpub-share-card-desc">{{ post.sharedContent.description }}</p>
          </div>
        </div>
      </NuxtLink>

      <!-- Regular posts — linked or static -->
      <template v-else>
        <NuxtLink v-if="post.linkTo" :to="post.linkTo" class="cpub-feed-link">
          <FeedItem
            :type="(post.type as 'discussion' | 'question' | 'showcase' | 'announcement') || 'discussion'"
            :title="post.content?.slice(0, 80) || ''"
            :author="post.author.name"
            :author-avatar="post.author.avatarUrl ?? undefined"
            :author-handle="post.author.handle ?? undefined"
            :body="post.content || ''"
            :created-at="new Date(post.createdAt)"
            :reply-count="post.replyCount"
            :vote-count="post.likeCount"
            :pinned="post.isPinned"
            :locked="post.isLocked"
            :interactive="interactive"
            @vote="emit('post-vote', post.id)"
          />
        </NuxtLink>
        <div v-else>
          <FeedItem
            :type="(post.type as 'discussion' | 'question' | 'showcase' | 'announcement') || 'discussion'"
            :title="post.content?.slice(0, 80) || ''"
            :author="post.author.name"
            :author-avatar="post.author.avatarUrl ?? undefined"
            :author-handle="post.author.handle ?? undefined"
            :body="post.content || ''"
            :created-at="new Date(post.createdAt)"
            :reply-count="post.replyCount"
            :vote-count="post.likeCount"
            :pinned="post.isPinned"
            :locked="post.isLocked"
            :interactive="interactive"
            @vote="emit('post-vote', post.id)"
          />
        </div>
      </template>
    </template>
  </div>
  <div v-else class="cpub-empty-state">
    <div class="cpub-empty-state-icon"><i class="fa-solid fa-message"></i></div>
    <p class="cpub-empty-state-title">No posts yet</p>
    <p class="cpub-empty-state-desc">Be the first to start a discussion!</p>
  </div>
</template>

<style scoped>
.cpub-feed-list { display: flex; flex-direction: column; gap: 12px; }
.cpub-feed-link { text-decoration: none; color: inherit; display: block; }

/* Share card */
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

@media (max-width: 640px) {
  .cpub-share-card-thumb { width: 80px; }
}
</style>
