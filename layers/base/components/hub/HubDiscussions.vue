<script setup lang="ts">
import type { HubPostViewModel } from '../../types/hub';

const props = defineProps<{
  posts: HubPostViewModel[]
}>();

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

const discussionPosts = computed(() => {
  return props.posts.filter((p) =>
    (p.type === 'text' || p.type === 'link' || p.type === 'discussion' || p.type === 'question')
    && !p.sharedContent,
  );
});
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
          :vote-score="post.voteScore"
        />
      </NuxtLink>
      <div v-else>
        <DiscussionItem
          :title="stripHtml(post.content || '').slice(0, 80) || 'Untitled'"
          :author="post.author.name"
          :reply-count="post.replyCount"
          :vote-count="post.likeCount"
          :vote-score="post.voteScore"
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
