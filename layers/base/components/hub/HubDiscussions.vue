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

const discussionPosts = computed(() => {
  return props.posts.filter((p) =>
    (p.type === 'text' || p.type === 'link' || p.type === 'discussion' || p.type === 'question')
    && !p.sharedContent,
  );
});

// --- Voting ---
const scoreOverrides = reactive<Map<string, number>>(new Map());
const userVotes = reactive<Map<string, VoteDirection>>(new Map());
const voting = reactive<Set<string>>(new Set());

function getScore(post: HubPostViewModel): number {
  return scoreOverrides.get(post.id) ?? post.voteScore;
}

function getUserVote(postId: string): VoteDirection | undefined {
  return userVotes.get(postId);
}

async function handleVote(postId: string, direction: VoteDirection): Promise<void> {
  if (!isAuthenticated.value || !props.hubSlug || voting.has(postId)) return;
  voting.add(postId);
  try {
    const result = await ($fetch as Function)(
      `/api/hubs/${props.hubSlug}/posts/${postId}/vote`,
      { method: 'POST', body: { direction } },
    ) as { voted: boolean; direction: VoteDirection | null; voteScore: number };
    scoreOverrides.set(postId, result.voteScore);
    if (result.direction) {
      userVotes.set(postId, result.direction);
    } else {
      userVotes.delete(postId);
    }
  } catch {
    toast.error('Vote failed');
  } finally {
    voting.delete(postId);
  }
}
</script>

<template>
  <!-- Compose slot (page provides compose bar for local, nothing for federated) -->
  <slot name="compose" />

  <div v-if="discussionPosts.length" class="cpub-disc-list">
    <template v-for="post in discussionPosts" :key="post.id">
      <NuxtLink v-if="post.linkTo" :to="post.linkTo" class="cpub-feed-link">
        <DiscussionItem
          :title="stripHtml(post.content || '').slice(0, 80) || 'Untitled'"
          :author="post.author.name"
          :reply-count="post.replyCount"
          :vote-count="post.likeCount"
          :vote-score="getScore(post)"
          @upvote.prevent.stop="handleVote(post.id, 'up')"
          @downvote.prevent.stop="handleVote(post.id, 'down')"
        />
      </NuxtLink>
      <div v-else>
        <DiscussionItem
          :title="stripHtml(post.content || '').slice(0, 80) || 'Untitled'"
          :author="post.author.name"
          :reply-count="post.replyCount"
          :vote-count="post.likeCount"
          :vote-score="getScore(post)"
          @upvote="handleVote(post.id, 'up')"
          @downvote="handleVote(post.id, 'down')"
        />
      </div>
    </template>
  </div>
  <div v-else class="cpub-empty-state">
    <div class="cpub-empty-state-icon"><i class="fa-solid fa-comments"></i></div>
    <p class="cpub-empty-state-title">No discussions yet</p>
    <p class="cpub-empty-state-desc">Be the first to start a conversation.</p>
  </div>
</template>

<style scoped>
.cpub-disc-list { display: flex; flex-direction: column; gap: 8px; }
.cpub-feed-link { text-decoration: none; color: inherit; display: block; }
</style>
