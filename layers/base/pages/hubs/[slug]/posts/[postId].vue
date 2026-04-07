<script setup lang="ts">
import type { Serialized, HubPostItem, HubDetail, HubReplyItem } from '@commonpub/server';

const route = useRoute();
const slug = computed(() => route.params.slug as string);
const postId = computed(() => route.params.postId as string);

const { isAuthenticated, user: authUser } = useAuth();
const toast = useToast();

const { data: hub } = useLazyFetch<Serialized<HubDetail>>(() => `/api/hubs/${slug.value}`);
const { data: postData, refresh: refreshPost } = useLazyFetch<Serialized<HubPostItem> & { isLiked?: boolean }>(() => `/api/hubs/${slug.value}/posts/${postId.value}`);
const { data: repliesData, refresh: refreshReplies } = useLazyFetch<{ items: Serialized<HubReplyItem>[]; total: number }>(() => `/api/hubs/${slug.value}/posts/${postId.value}/replies`, { default: () => ({ items: [], total: 0 }) });

const post = computed(() => postData.value);
const replies = computed(() => repliesData.value?.items ?? []);

const isMod = computed(() => {
  const role = hub.value?.currentUserRole;
  return role === 'owner' || role === 'admin' || role === 'moderator';
});

const isAuthor = computed(() => post.value?.author?.id === authUser.value?.id);

// Reply
const replyContent = ref('');
const replying = ref(false);
const replyingTo = ref<string | null>(null);

async function handleReply(): Promise<void> {
  if (!replyContent.value.trim()) return;
  replying.value = true;
  try {
    await $fetch(`/api/hubs/${slug.value}/posts/${postId.value}/replies`, {
      method: 'POST',
      body: { content: replyContent.value, parentId: replyingTo.value || undefined },
    });
    replyContent.value = '';
    replyingTo.value = null;
    await Promise.all([refreshReplies(), refreshPost()]);
  } catch {
    toast.error('Failed to post reply');
  } finally {
    replying.value = false;
  }
}

// Like
const liking = ref(false);
async function toggleLike(): Promise<void> {
  if (!isAuthenticated.value) return;
  liking.value = true;
  try {
    await $fetch(`/api/hubs/${slug.value}/posts/${postId.value}/like`, { method: 'POST' });
    await refreshPost();
  } catch {
    toast.error('Failed to like post');
  } finally {
    liking.value = false;
  }
}

// Mod actions
async function togglePin(): Promise<void> {
  const wasPinned = post.value?.isPinned;
  try {
    await $fetch(`/api/hubs/${slug.value}/posts/${postId.value}/pin`, { method: 'POST' });
    await refreshPost();
    toast.success(wasPinned ? 'Post unpinned' : 'Post pinned');
  } catch {
    toast.error('Failed to toggle pin');
  }
}

async function toggleLock(): Promise<void> {
  const wasLocked = post.value?.isLocked;
  try {
    await $fetch(`/api/hubs/${slug.value}/posts/${postId.value}/lock`, { method: 'POST' });
    await refreshPost();
    toast.success(wasLocked ? 'Post unlocked' : 'Post locked');
  } catch {
    toast.error('Failed to toggle lock');
  }
}

async function deletePost(): Promise<void> {
  if (!confirm('Delete this post?')) return;
  try {
    await $fetch(`/api/hubs/${slug.value}/posts/${postId.value}`, { method: 'DELETE' });
    toast.success('Post deleted');
    await navigateTo(`/hubs/${slug.value}`);
  } catch {
    toast.error('Failed to delete post');
  }
}

// Edit
const editing = ref(false);
const editContent = ref('');
const saving = ref(false);

function startEdit(): void {
  editContent.value = post.value?.content ?? '';
  editing.value = true;
}

async function saveEdit(): Promise<void> {
  if (!editContent.value.trim()) return;
  saving.value = true;
  try {
    await $fetch(`/api/hubs/${slug.value}/posts/${postId.value}`, {
      method: 'PUT',
      body: { content: editContent.value },
    });
    editing.value = false;
    await refreshPost();
    toast.success('Post updated');
  } catch {
    toast.error('Failed to update post');
  } finally {
    saving.value = false;
  }
}

function replyDisplayName(reply: { author?: { displayName?: string | null; username?: string } | null; remoteActorName?: string | null }): string {
  if (reply.author) return reply.author.displayName || reply.author.username || 'U';
  return reply.remoteActorName || 'Someone';
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

useSeoMeta({
  title: () => post.value ? `${post.value.content?.slice(0, 60)} — ${hub.value?.name ?? 'Hub'}` : 'Post',
});
</script>

<template>
  <div v-if="post" class="cpub-post-page">
    <!-- Breadcrumb -->
    <div class="cpub-post-breadcrumb">
      <NuxtLink :to="`/hubs/${slug}`" class="cpub-breadcrumb-link">
        <i class="fa-solid fa-arrow-left"></i> {{ hub?.name ?? 'Hub' }}
      </NuxtLink>
    </div>

    <!-- Post -->
    <article class="cpub-post-card">
      <div v-if="post.isPinned" class="cpub-post-pin">
        <i class="fa-solid fa-thumbtack"></i> Pinned
      </div>

      <div class="cpub-post-header">
        <span class="cpub-post-type-badge">{{ post.type }}</span>
        <span v-if="post.isLocked" class="cpub-post-locked"><i class="fa-solid fa-lock"></i> Locked</span>
      </div>

      <div v-if="editing" class="cpub-post-edit-form">
        <textarea v-model="editContent" class="cpub-post-edit-textarea" rows="4" aria-label="Edit post content"></textarea>
        <div class="cpub-post-edit-actions">
          <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="saving || !editContent.trim()" @click="saveEdit">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
          <button class="cpub-btn cpub-btn-sm" @click="editing = false">Cancel</button>
        </div>
      </div>
      <div v-else class="cpub-post-content">
        <MentionText :text="post.content || ''" />
        <div v-if="post.updatedAt && post.updatedAt !== post.createdAt" class="cpub-post-edited">
          <i class="fa-solid fa-pen"></i> edited
        </div>
      </div>

      <div class="cpub-post-meta">
        <div class="cpub-post-author">
          <div class="cpub-post-avatar">
            <img v-if="post.author?.avatarUrl" :src="post.author.avatarUrl" :alt="post.author?.displayName || post.author?.username" class="cpub-post-avatar-img" />
            <span v-else>{{ (post.author?.displayName || post.author?.username || post.remoteActorName || 'U').charAt(0).toUpperCase() }}</span>
          </div>
          <NuxtLink v-if="post.author" :to="`/u/${post.author.username}`" class="cpub-post-author-name">{{ post.author.displayName || post.author.username }}</NuxtLink>
          <span v-else class="cpub-post-author-name cpub-reply-remote">
            <i class="fa-solid fa-globe" title="Federated post"></i> {{ post.remoteActorName || 'Someone' }}
          </span>
          <span class="cpub-post-sep">&middot;</span>
          <time class="cpub-post-time">{{ formatDate(post.createdAt) }}</time>
        </div>

        <div class="cpub-post-actions">
          <button class="cpub-post-action-btn" :class="{ active: post.isLiked }" :disabled="liking || !isAuthenticated" @click="toggleLike" :aria-label="post.isLiked ? 'Unlike post' : 'Like post'" :aria-pressed="post.isLiked ?? false">
            <i :class="post.isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart'"></i>
            {{ post.likeCount ?? 0 }}
          </button>
          <span class="cpub-post-action-btn" style="cursor: default">
            <i class="fa-solid fa-comment"></i> {{ post.replyCount ?? 0 }}
          </span>
        </div>
      </div>

      <!-- Mod actions -->
      <div v-if="isMod || isAuthor" class="cpub-post-mod-bar">
        <button v-if="isAuthor && !editing" class="cpub-btn cpub-btn-sm" @click="startEdit">
          <i class="fa-solid fa-pen"></i> Edit
        </button>
        <button v-if="isMod" class="cpub-btn cpub-btn-sm" @click="togglePin">
          <i class="fa-solid fa-thumbtack"></i> {{ post.isPinned ? 'Unpin' : 'Pin' }}
        </button>
        <button v-if="isMod" class="cpub-btn cpub-btn-sm" @click="toggleLock">
          <i class="fa-solid fa-lock"></i> {{ post.isLocked ? 'Unlock' : 'Lock' }}
        </button>
        <button v-if="isMod || isAuthor" class="cpub-btn cpub-btn-sm cpub-btn-danger" @click="deletePost">
          <i class="fa-solid fa-trash"></i> Delete
        </button>
      </div>
    </article>

    <!-- Reply form -->
    <div v-if="isAuthenticated && !post.isLocked && hub?.currentUserRole" class="cpub-reply-form">
      <div v-if="replyingTo" class="cpub-replying-to">
        Replying to a comment <button class="cpub-cancel-reply" @click="replyingTo = null"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="cpub-reply-row">
        <input v-model="replyContent" class="cpub-reply-input" type="text" placeholder="Write a reply..." aria-label="Write a reply" @keydown.enter="handleReply" />
        <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="replying || !replyContent.trim()" @click="handleReply">
          <i class="fa-solid fa-paper-plane"></i> Reply
        </button>
      </div>
    </div>
    <div v-else-if="post.isLocked" class="cpub-post-locked-notice">
      <i class="fa-solid fa-lock"></i> This post is locked. No new replies.
    </div>

    <!-- Replies -->
    <div class="cpub-replies-section">
      <h3 v-if="replies.length" class="cpub-replies-title">{{ repliesData?.total ?? 0 }} Replies</h3>
      <div v-for="reply in replies" :key="reply.id" class="cpub-reply">
        <div class="cpub-reply-author">
          <div class="cpub-reply-avatar">
            <img v-if="reply.author?.avatarUrl" :src="reply.author.avatarUrl" :alt="reply.author?.displayName || reply.author?.username" class="cpub-reply-avatar-img" />
            <span v-else>{{ (replyDisplayName(reply)).charAt(0).toUpperCase() }}</span>
          </div>
          <NuxtLink v-if="reply.author" :to="`/u/${reply.author.username}`" class="cpub-reply-author-name">{{ reply.author.displayName || reply.author.username }}</NuxtLink>
          <span v-else class="cpub-reply-author-name cpub-reply-remote">
            <i class="fa-solid fa-globe" title="Federated reply"></i> {{ reply.remoteActorName || 'Someone' }}
          </span>
          <span class="cpub-post-sep">&middot;</span>
          <time class="cpub-post-time">{{ formatDate(reply.createdAt) }}</time>
        </div>
        <div class="cpub-reply-content"><MentionText :text="reply.content" /></div>
        <div class="cpub-reply-actions">
          <button v-if="isAuthenticated && hub?.currentUserRole && !post.isLocked" class="cpub-reply-btn" @click="replyingTo = reply.id; replyContent = `@${reply.author?.username ?? reply.remoteActorName ?? ''} `">
            <i class="fa-solid fa-reply"></i> Reply
          </button>
        </div>

        <!-- Nested replies -->
        <div v-if="reply.replies?.length" class="cpub-nested-replies">
          <div v-for="child in reply.replies" :key="child.id" class="cpub-reply cpub-reply-nested">
            <div class="cpub-reply-author">
              <div class="cpub-reply-avatar">
                <img v-if="child.author?.avatarUrl" :src="child.author.avatarUrl" :alt="child.author?.displayName || child.author?.username" class="cpub-reply-avatar-img" />
                <span v-else>{{ (replyDisplayName(child)).charAt(0).toUpperCase() }}</span>
              </div>
              <NuxtLink v-if="child.author" :to="`/u/${child.author.username}`" class="cpub-reply-author-name">{{ child.author.displayName || child.author.username }}</NuxtLink>
              <span v-else class="cpub-reply-author-name cpub-reply-remote">
                <i class="fa-solid fa-globe" title="Federated reply"></i> {{ child.remoteActorName || 'Someone' }}
              </span>
              <span class="cpub-post-sep">&middot;</span>
              <time class="cpub-post-time">{{ formatDate(child.createdAt) }}</time>
            </div>
            <div class="cpub-reply-content"><MentionText :text="child.content" /></div>
          </div>
        </div>
      </div>

      <div v-if="!replies.length" class="cpub-empty-state" style="padding: 32px 16px">
        <p class="cpub-empty-state-title">No replies yet</p>
        <p v-if="!post.isLocked" class="cpub-empty-state-desc">Be the first to reply.</p>
      </div>
    </div>
  </div>

  <div v-else class="cpub-loading" style="padding: 64px 24px; text-align: center">Loading post...</div>
</template>

<style scoped>
.cpub-post-page { max-width: 800px; margin: 0 auto; padding: 24px 16px; }

.cpub-post-breadcrumb { margin-bottom: 16px; }
.cpub-breadcrumb-link {
  font-size: 13px; color: var(--text-dim); text-decoration: none;
  display: inline-flex; align-items: center; gap: 6px;
}
.cpub-breadcrumb-link:hover { color: var(--accent); }

.cpub-post-card {
  background: var(--surface); border: var(--border-width-default) solid var(--border);
  padding: 20px; margin-bottom: 16px;
}

.cpub-post-pin {
  font-family: var(--font-mono); font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--accent); margin-bottom: 8px;
}

.cpub-post-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }

.cpub-post-type-badge {
  display: inline-block; padding: 2px 8px; font-family: var(--font-mono);
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--accent); background: var(--accent-bg);
  border: 1px solid var(--accent-border);
}

.cpub-post-locked { font-size: 11px; color: var(--text-faint); }

.cpub-post-content {
  font-size: 15px; line-height: 1.7; color: var(--text);
  margin-bottom: 16px; white-space: pre-wrap;
}
.cpub-post-edited {
  font-size: 10px; font-family: var(--font-mono); color: var(--text-faint);
  margin-top: 4px;
}
.cpub-post-edit-form { margin-bottom: 16px; }
.cpub-post-edit-textarea {
  width: 100%; padding: 10px 12px; background: var(--surface);
  border: var(--border-width-default) solid var(--accent-border);
  color: var(--text); font-size: 14px; font-family: var(--font-sans);
  line-height: 1.6; resize: vertical;
}
.cpub-post-edit-textarea:focus { outline: none; border-color: var(--accent); }
.cpub-post-edit-actions { display: flex; gap: 6px; margin-top: 8px; }

.cpub-post-meta {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 8px;
}

.cpub-post-author { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-faint); }

.cpub-post-avatar {
  width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
  background: var(--surface2); border: 1px solid var(--border);
  font-family: var(--font-mono); font-size: 10px; font-weight: 700; color: var(--text-dim);
  overflow: hidden;
}
.cpub-post-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }

.cpub-post-author-name { font-weight: 500; color: var(--text-dim); text-decoration: none; }
.cpub-post-author-name:hover { color: var(--accent); }
.cpub-post-sep { color: var(--text-faint); }
.cpub-post-time { color: var(--text-faint); }

.cpub-post-actions { display: flex; align-items: center; gap: 12px; }

.cpub-post-action-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; color: var(--text-faint); background: none; border: none; cursor: pointer;
  padding: 4px 8px; border: 1px solid var(--border); transition: all 0.1s;
}
.cpub-post-action-btn:hover:not(:disabled) { color: var(--accent); border-color: var(--accent-border); }
.cpub-post-action-btn.active { color: var(--red); border-color: var(--red); }
.cpub-post-action-btn:disabled { opacity: 0.5; cursor: default; }

.cpub-post-mod-bar {
  margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);
  display: flex; gap: 6px;
}

.cpub-btn-primary { background: var(--accent); color: var(--accent-text, #fff); border-color: var(--accent); }
.cpub-btn-primary:hover:not(:disabled) { opacity: 0.9; }
.cpub-btn-primary:disabled { opacity: 0.5; cursor: default; }
.cpub-btn-danger { color: var(--red); border-color: var(--red); }
.cpub-btn-danger:hover { background: var(--red); color: var(--accent-text, #fff); }

/* Reply form */
.cpub-reply-form { margin-bottom: 16px; }
.cpub-replying-to {
  font-size: 11px; color: var(--text-dim); margin-bottom: 6px;
  display: flex; align-items: center; gap: 6px;
}
.cpub-cancel-reply { background: none; border: none; cursor: pointer; color: var(--text-faint); font-size: 12px; }
.cpub-reply-row { display: flex; gap: 8px; }
.cpub-reply-input {
  flex: 1; padding: 8px 12px; background: var(--surface); border: var(--border-width-default) solid var(--border);
  color: var(--text); font-size: 13px;
}
.cpub-reply-input:focus { outline: none; border-color: var(--accent); }

.cpub-post-locked-notice {
  padding: 12px 16px; background: var(--surface2); border: 1px solid var(--border);
  font-size: 12px; color: var(--text-faint); margin-bottom: 16px; text-align: center;
}

/* Replies */
.cpub-replies-section { }
.cpub-replies-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; }

.cpub-reply {
  padding: 12px 16px; background: var(--surface); border: var(--border-width-default) solid var(--border);
  margin-bottom: 8px;
}

.cpub-reply-nested { margin-left: 24px; border-color: var(--border2); }
.cpub-nested-replies { margin-top: 8px; }

.cpub-reply-author { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-faint); margin-bottom: 6px; }

.cpub-reply-avatar {
  width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;
  background: var(--surface2); border: 1px solid var(--border);
  font-family: var(--font-mono); font-size: 9px; font-weight: 700; color: var(--text-dim);
  overflow: hidden;
}
.cpub-reply-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }

.cpub-reply-author-name { font-weight: 500; color: var(--text-dim); text-decoration: none; }
.cpub-reply-author-name:hover { color: var(--accent); }
.cpub-reply-remote { display: inline-flex; align-items: center; gap: 4px; }
.cpub-reply-remote > i { font-size: 10px; color: var(--accent); }

.cpub-reply-content { font-size: 13px; line-height: 1.6; color: var(--text); }

.cpub-reply-actions { margin-top: 6px; }
.cpub-reply-btn {
  background: none; border: none; cursor: pointer; font-size: 11px;
  color: var(--text-faint); padding: 2px 0;
}
.cpub-reply-btn:hover { color: var(--accent); }
</style>
