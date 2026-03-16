<script setup lang="ts">
const props = defineProps<{
  contentId: string;
}>();

const { user } = useAuth();

const { data: comments, refresh } = await useFetch('/api/social/comments', {
  query: { contentId: props.contentId },
  lazy: true,
});

const newComment = ref('');
const submitting = ref(false);

async function submitComment(): Promise<void> {
  if (!newComment.value.trim()) return;
  submitting.value = true;
  try {
    await $fetch('/api/social/comments', {
      method: 'POST',
      body: { contentId: props.contentId, body: newComment.value },
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
      <div v-for="comment in (comments || [])" :key="(comment as any).id" class="cpub-comment">
        <div class="cpub-comment-avatar">
          {{ ((comment as any).author?.displayName || (comment as any).author?.username || 'U').charAt(0).toUpperCase() }}
        </div>
        <div class="cpub-comment-body">
          <div class="cpub-comment-header">
            <NuxtLink :to="`/u/${(comment as any).author?.username}`" class="cpub-comment-author">
              {{ (comment as any).author?.displayName || (comment as any).author?.username }}
            </NuxtLink>
            <time class="cpub-comment-time">
              {{ new Date((comment as any).createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
            </time>
          </div>
          <p class="cpub-comment-text">{{ (comment as any).body }}</p>
          <button
            v-if="(user as any)?.id === (comment as any).authorId"
            class="cpub-comment-delete"
            @click="deleteComment((comment as any).id)"
            aria-label="Delete comment"
          >
            Delete
          </button>
        </div>
      </div>
      <p v-if="!comments?.length" class="cpub-comments-empty">No comments yet. Be the first!</p>
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
</style>
