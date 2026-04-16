<script setup lang="ts">
import type { HubPostViewModel } from '../../types/hub';
import type { VoteDirection } from '@commonpub/server';

const props = defineProps<{
  posts: HubPostViewModel[];
  hubSlug?: string;
}>();

const { isAuthenticated } = useAuth();
const toast = useToast();

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

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

// --- Voting state ---
const votedPosts = reactive<Map<string, VoteDirection>>(new Map());
const scoreOverrides = reactive<Map<string, number>>(new Map());
const votingInProgress = reactive<Set<string>>(new Set());

function getScore(post: HubPostViewModel): number {
  return scoreOverrides.get(post.id) ?? post.voteScore;
}

function isVoted(postId: string): boolean {
  return votedPosts.has(postId);
}

async function handleVote(postId: string): Promise<void> {
  if (!isAuthenticated.value || !props.hubSlug || votingInProgress.has(postId)) return;
  votingInProgress.add(postId);
  try {
    const result = await ($fetch as Function)(
      `/api/hubs/${props.hubSlug}/posts/${postId}/vote`,
      { method: 'POST', body: { direction: 'up' } },
    ) as { voted: boolean; direction: VoteDirection | null; voteScore: number };
    scoreOverrides.set(postId, result.voteScore);
    if (result.direction) {
      votedPosts.set(postId, result.direction);
    } else {
      votedPosts.delete(postId);
    }
  } catch {
    toast.error('Vote failed');
  } finally {
    votingInProgress.delete(postId);
  }
}
</script>

<template>
  <!-- Pinned announcements -->
  <AnnouncementBand
    v-for="post in filteredPosts.filter(p => p.isPinned && p.type === 'announcement')"
    :key="`ann-${post.id}`"
    :title="stripHtml(post.content || '').slice(0, 80) || 'Announcement'"
    :body="stripHtml(post.content || '')"
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
      <NuxtLink v-if="post.sharedContent?.slug && !post.sharedContent?.url" :to="(post.sharedContent as any).authorUsername ? `/u/${(post.sharedContent as any).authorUsername}/${post.sharedContent.type}/${post.sharedContent.slug}` : `/${post.sharedContent.type}/${post.sharedContent.slug}`" class="cpub-share-card">
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
      <a v-else-if="post.sharedContent?.url" :href="post.sharedContent.url" target="_blank" rel="noopener noreferrer" class="cpub-share-card">
        <div class="cpub-share-card-context">
          <i class="fa-solid fa-share-nodes"></i>
          {{ post.author.name }} shared a {{ post.sharedContent.type }}
          <span v-if="post.sharedContent.url" class="cpub-share-card-origin">
            <i class="fa-solid fa-globe"></i> {{ post.sharedContent.url.replace(/^https?:\/\//, '').split('/')[0] }}
          </span>
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
      </a>

      <!-- Poll posts -->
      <div v-else-if="post.type === 'poll' && hubSlug" class="cpub-feed-poll-wrapper">
        <FeedItem
          type="discussion"
          :title="stripHtml(post.content || '').slice(0, 80) || 'Poll'"
          :author="post.author.name"
          :author-avatar="post.author.avatarUrl ?? undefined"
          :author-handle="post.author.handle ?? undefined"
          :body="post.content || ''"
          :created-at="new Date(post.createdAt)"
          :reply-count="post.replyCount"
          :vote-count="getScore(post)"
          :pinned="post.isPinned"
          :locked="post.isLocked"
        />
        <div class="cpub-feed-poll-body">
          <PollDisplay :hub-slug="hubSlug" :post-id="post.id" />
        </div>
      </div>

      <!-- Regular posts — linked or static -->
      <template v-else>
        <NuxtLink v-if="post.linkTo" :to="post.linkTo" class="cpub-feed-link">
          <FeedItem
            :type="(post.type as 'discussion' | 'question' | 'showcase' | 'announcement') || 'discussion'"
            :title="stripHtml(post.content || '').slice(0, 80) || ''"
            :author="post.author.name"
            :author-avatar="post.author.avatarUrl ?? undefined"
            :author-handle="post.author.handle ?? undefined"
            :body="post.content || ''"
            :created-at="new Date(post.createdAt)"
            :reply-count="post.replyCount"
            :vote-count="getScore(post)"
            :pinned="post.isPinned"
            :locked="post.isLocked"
            :interactive="!!hubSlug && isAuthenticated"
            :voted="isVoted(post.id)"
            @vote="handleVote(post.id)"
          />
        </NuxtLink>
        <div v-else>
          <FeedItem
            :type="(post.type as 'discussion' | 'question' | 'showcase' | 'announcement') || 'discussion'"
            :title="stripHtml(post.content || '').slice(0, 80) || ''"
            :author="post.author.name"
            :author-avatar="post.author.avatarUrl ?? undefined"
            :author-handle="post.author.handle ?? undefined"
            :body="post.content || ''"
            :created-at="new Date(post.createdAt)"
            :reply-count="post.replyCount"
            :vote-count="getScore(post)"
            :pinned="post.isPinned"
            :locked="post.isLocked"
            :interactive="!!hubSlug && isAuthenticated"
            :voted="isVoted(post.id)"
            @vote="handleVote(post.id)"
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
.cpub-share-card-origin {
  display: inline-flex; align-items: center; gap: 3px;
  color: var(--accent); font-size: 10px;
}
.cpub-share-card-origin i { font-size: 9px; }
.cpub-share-card-embed {
  display: flex; gap: 0;
  background: var(--surface); border: var(--border-width-default) solid var(--border);
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

/* Poll wrapper */
.cpub-feed-poll-wrapper { border: var(--border-width-default) solid var(--border); background: var(--surface); }
.cpub-feed-poll-body { padding: 0 16px 16px; }

@media (max-width: 640px) {
  .cpub-share-card-thumb { width: 80px; }
}
</style>
