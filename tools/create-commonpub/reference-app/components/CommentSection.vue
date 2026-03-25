<script setup lang="ts">
interface CommentAuthor {
  id: string;
  username: string;
  displayName: string | null;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: CommentAuthor | null;
}

const props = defineProps<{
  targetType: string;
  targetId: string;
}>();

const { user } = useAuth();

const commentLimit = 20;

const queryParams = computed(() => ({
  targetType: props.targetType,
  targetId: props.targetId,
  limit: commentLimit,
}));

const { data: comments, refresh } = await useFetch<Comment[]>('/api/social/comments', {
  query: queryParams,
  lazy: true,
});

const allCommentsLoaded = ref(false);
const hasMore = computed(() => !allCommentsLoaded.value && (comments.value?.length ?? 0) >= commentLimit);
const loadingMore = ref(false);

async function loadMoreComments(): Promise<void> {
  loadingMore.value = true;
  try {
    const more = await $fetch<Comment[]>('/api/social/comments', {
      query: {
        targetType: props.targetType,
        targetId: props.targetId,
        limit: commentLimit,
        offset: comments.value?.length ?? 0,
      },
    });
    if (more?.length && comments.value) {
      comments.value.push(...more);
    }
    if (!more?.length || more.length < commentLimit) {
      allCommentsLoaded.value = true;
    }
  } finally {
    loadingMore.value = false;
  }
}

const newComment = ref('');
const submitting = ref(false);

async function submitComment(): Promise<void> {
  if (!newComment.value.trim()) return;
  submitting.value = true;
  try {
    await $fetch('/api/social/comments', {
      method: 'POST',
      body: {
        targetType: props.targetType,
        targetId: props.targetId,
        content: newComment.value,
      },
    });
    newComment.value = '';
    await refresh();
  } finally {
    submitting.value = false;
  }
}

async function deleteComment(id: string): Promise<void> {
  await $fetch(`/api/social/comments/${id}`, { method: 'DELETE' });
  await refresh();
}
</script>

<template>
  <section class="cpub-comments" aria-label="Comments">
    <h3 class="cpub-comments-title">
      Comments
      <span v-if="comments?.length" class="cpub-comments-count">{{ comments.length }}</span>
    </h3>

    <!-- New comment form -->
    <div v-if="user" class="cpub-comment-form">
      <textarea
        v-model="newComment"
        class="cpub-textarea"
        placeholder="Write a comment..."
        rows="3"
        aria-label="Write a comment"
      ></textarea>
      <button
        class="cpub-btn cpub-btn-primary cpub-btn-sm"
        :disabled="!newComment.trim() || submitting"
        @click="submitComment"
      >
        {{ submitting ? 'Posting...' : 'Post Comment' }}
      </button>
    </div>
    <p v-else class="cpub-comment-login">
      <NuxtLink to="/auth/login" class="cpub-link">Log in</NuxtLink> to comment.
    </p>

    <!-- Comments list -->
    <div class="cpub-comment-list">
      <div v-for="comment in (comments || [])" :key="comment.id" class="cpub-comment">
        <div class="cpub-comment-avatar">
          {{ (comment.author?.displayName || comment.author?.username || 'U').charAt(0).toUpperCase() }}
        </div>
        <div class="cpub-comment-body">
          <div class="cpub-comment-header">
            <NuxtLink :to="`/u/${comment.author?.username}`" class="cpub-comment-author">
              {{ comment.author?.displayName || comment.author?.username }}
            </NuxtLink>
            <time class="cpub-comment-time">
              {{ new Date(comment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
            </time>
          </div>
          <p class="cpub-comment-text">{{ comment.content }}</p>
          <button
            v-if="user?.id === comment.author?.id"
            class="cpub-comment-delete"
            @click="deleteComment(comment.id)"
            aria-label="Delete comment"
          >
            Delete
          </button>
        </div>
      </div>
      <p v-if="!comments?.length" class="cpub-comments-empty">No comments yet. Be the first!</p>
      <div v-if="hasMore" class="cpub-comments-more">
        <button class="cpub-btn cpub-btn-sm" :disabled="loadingMore" @click="loadMoreComments">
          {{ loadingMore ? 'Loading...' : 'Load more comments' }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cpub-comments {
  margin-top: var(--space-8);
  padding-top: var(--space-6);
  border-top: 2px solid var(--border);
}

.cpub-comments-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: var(--space-4);
  display: flex;
  align-items: center;
  gap: 8px;
}

.cpub-comments-count {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-faint);
  background: var(--surface2);
  padding: 1px 6px;
  border: 1px solid var(--border2);
}

.cpub-comment-form {
  margin-bottom: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: flex-end;
}

.cpub-comment-form .cpub-textarea {
  width: 100%;
}

.cpub-comment-login {
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: var(--space-6);
}

.cpub-comment-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.cpub-comment {
  display: flex;
  gap: 10px;
}

.cpub-comment-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--surface3);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-dim);
  flex-shrink: 0;
}

.cpub-comment-body {
  flex: 1;
  min-width: 0;
}

.cpub-comment-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.cpub-comment-author {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  text-decoration: none;
}

.cpub-comment-author:hover {
  color: var(--accent);
}

.cpub-comment-time {
  font-size: 10px;
  color: var(--text-faint);
  font-family: var(--font-mono);
}

.cpub-comment-text {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.6;
}

.cpub-comment-delete {
  font-size: 10px;
  color: var(--text-faint);
  background: none;
  border: none;
  cursor: pointer;
  margin-top: 4px;
  padding: 0;
}

.cpub-comment-delete:hover {
  color: var(--red);
}

.cpub-comments-empty {
  color: var(--text-faint);
  font-size: 13px;
  text-align: center;
  padding: var(--space-6) 0;
}

.cpub-comments-more {
  text-align: center;
  padding: var(--space-4) 0;
}
</style>
