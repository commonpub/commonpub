<script setup lang="ts">
import type { FederatedHubListItem, FederatedHubPostItem } from '@commonpub/server';

const route = useRoute();
const id = route.params.id as string;
const postId = route.params.postId as string;

const { isAuthenticated } = useAuth();
const toast = useToast();

const { data: hub } = useLazyFetch<FederatedHubListItem>(`/api/federated-hubs/${id}`);
const { data: post, refresh: refreshPost } = useLazyFetch<FederatedHubPostItem>(`/api/federated-hubs/${id}/posts/${postId}`);

function formatDate(d: string | Date | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const authorHandle = computed(() => {
  if (!post.value?.author) return '';
  return `@${post.value.author.preferredUsername ?? 'unknown'}@${post.value.author.instanceDomain}`;
});

const likeCount = computed(() => (post.value?.localLikeCount ?? 0) + (post.value?.remoteLikeCount ?? 0));
const replyCount = computed(() => (post.value?.localReplyCount ?? 0) + (post.value?.remoteReplyCount ?? 0));

// Like toggle
const liking = ref(false);
const liked = ref(false);

async function fetchLikedState(): Promise<void> {
  if (!isAuthenticated.value) return;
  try {
    const result = await $fetch<{ likedPostIds: string[] }>(`/api/federation/hub-post-likes?postIds=${postId}`);
    liked.value = result.likedPostIds.includes(postId);
  } catch { /* best-effort */ }
}

onMounted(fetchLikedState);

async function handleLike(): Promise<void> {
  if (!isAuthenticated.value) {
    await navigateTo(`/auth/login?redirect=/federated-hubs/${id}/posts/${postId}`);
    return;
  }
  liking.value = true;
  try {
    const result = await $fetch<{ liked: boolean }>('/api/federation/hub-post-like' as string, {
      method: 'POST',
      body: { federatedHubPostId: postId },
    });
    liked.value = result.liked;
    if (post.value) {
      if (result.liked) {
        post.value.localLikeCount = (post.value.localLikeCount ?? 0) + 1;
      } else {
        post.value.localLikeCount = Math.max((post.value.localLikeCount ?? 0) - 1, 0);
      }
    }
    toast.success(result.liked ? 'Liked!' : 'Unliked');
  } catch {
    toast.error('Failed to toggle like');
  } finally {
    liking.value = false;
  }
}

// Reply
const replyContent = ref('');
const replying = ref(false);

async function handleReply(): Promise<void> {
  if (!replyContent.value.trim()) return;
  replying.value = true;
  try {
    await $fetch('/api/federation/hub-post-reply' as string, {
      method: 'POST',
      body: { federatedHubPostId: postId, content: replyContent.value },
    });
    replyContent.value = '';
    toast.success('Reply sent via federation');
    await refreshPost();
  } catch {
    toast.error('Failed to send reply');
  } finally {
    replying.value = false;
  }
}

useSeoMeta({
  title: () => post.value ? `${post.value.content?.slice(0, 60)} — ${hub.value?.name ?? 'Hub'}` : 'Post',
  description: () => post.value?.content?.slice(0, 160) ?? '',
});

if (hub.value?.url) {
  useHead({
    link: [{ rel: 'canonical', href: hub.value.url }],
    meta: [{ name: 'robots', content: 'noindex, follow' }],
  });
}
</script>

<template>
  <div v-if="post" class="cpub-post-page">
    <!-- Federation banner -->
    <div class="cpub-fed-banner">
      <div class="cpub-fed-banner-inner">
        <i class="fa-solid fa-globe"></i>
        <span>Mirrored from <strong>{{ hub?.originDomain }}</strong></span>
        <a v-if="hub?.url" :href="hub.url" target="_blank" rel="noopener noreferrer" class="cpub-fed-banner-link">
          Visit original <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      </div>
    </div>

    <!-- Breadcrumb -->
    <div class="cpub-post-breadcrumb">
      <NuxtLink :to="`/federated-hubs/${id}`" class="cpub-breadcrumb-link">
        <i class="fa-solid fa-arrow-left"></i> {{ hub?.name ?? 'Hub' }}
      </NuxtLink>
    </div>

    <!-- Post -->
    <article class="cpub-post-card">
      <div v-if="post.isPinned" class="cpub-post-pin">
        <i class="fa-solid fa-thumbtack"></i> Pinned
      </div>

      <div class="cpub-post-header">
        <span class="cpub-post-type-badge">{{ post.postType }}</span>
      </div>

      <div class="cpub-post-content">{{ post.content }}</div>

      <div class="cpub-post-meta">
        <div class="cpub-post-author">
          <div class="cpub-post-avatar">
            <img v-if="post.author?.avatarUrl" :src="post.author.avatarUrl" :alt="post.author?.displayName || post.author?.preferredUsername || 'User'" class="cpub-post-avatar-img" />
            <span v-else>{{ (post.author?.displayName || post.author?.preferredUsername || 'U').charAt(0).toUpperCase() }}</span>
          </div>
          <span class="cpub-post-author-name">{{ post.author?.displayName || post.author?.preferredUsername || 'Unknown' }}</span>
          <span class="cpub-post-handle">{{ authorHandle }}</span>
          <span class="cpub-post-sep">&middot;</span>
          <time class="cpub-post-time">{{ formatDate(post.publishedAt ?? post.receivedAt) }}</time>
        </div>

        <div class="cpub-post-actions">
          <button class="cpub-post-action-btn" :class="{ active: liked }" :disabled="liking" @click="handleLike" :title="isAuthenticated ? (liked ? 'Unlike' : 'Like') : 'Log in to like'">
            <i :class="liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart'"></i>
            {{ likeCount }}
          </button>
          <span class="cpub-post-action-btn" style="cursor: default">
            <i class="fa-solid fa-comment"></i> {{ replyCount }}
          </span>
        </div>
      </div>
    </article>

    <!-- Reply form -->
    <div v-if="isAuthenticated" class="cpub-reply-form">
      <div class="cpub-reply-row">
        <input
          v-model="replyContent"
          class="cpub-reply-input"
          type="text"
          placeholder="Write a reply (sent via federation)..."
          @keydown.enter="handleReply"
        />
        <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="replying || !replyContent.trim()" @click="handleReply">
          <i class="fa-solid fa-paper-plane"></i> Reply
        </button>
      </div>
      <p class="cpub-fed-reply-hint">
        <i class="fa-solid fa-globe"></i> Your reply will be sent to {{ hub?.originDomain }} via ActivityPub
      </p>
    </div>

    <!-- Empty state for replies -->
    <div class="cpub-replies-section">
      <div class="cpub-empty-state" style="padding: 32px 16px">
        <p class="cpub-empty-state-title">Replies are on the origin instance</p>
        <p class="cpub-empty-state-desc">
          Reply threads live on <strong>{{ hub?.originDomain }}</strong>.
          <a v-if="post.objectUri" :href="post.objectUri" target="_blank" rel="noopener noreferrer" class="cpub-inline-link">
            View thread on origin <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
        </p>
      </div>
    </div>
  </div>

  <div v-else class="cpub-loading" style="padding: 64px 24px; text-align: center">Loading post...</div>
</template>

<style scoped>
.cpub-post-page { max-width: 800px; margin: 0 auto; padding: 0 16px 40px; }

.cpub-fed-banner { background: var(--accent-bg); border-bottom: 1px solid var(--accent-border); margin: 0 -16px 16px; }
.cpub-fed-banner-inner {
  max-width: 800px; margin: 0 auto; padding: 8px 16px;
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: var(--text-dim);
}
.cpub-fed-banner-inner > i { color: var(--accent); flex-shrink: 0; }
.cpub-fed-banner-link {
  margin-left: auto; color: var(--accent); font-weight: 600;
  text-decoration: none; white-space: nowrap;
  display: flex; align-items: center; gap: 4px; font-size: 11px;
}
.cpub-fed-banner-link:hover { text-decoration: underline; }

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

.cpub-post-content {
  font-size: 15px; line-height: 1.7; color: var(--text);
  margin-bottom: 16px; white-space: pre-wrap;
}

.cpub-post-meta {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 8px;
}

.cpub-post-author { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-faint); }

.cpub-post-avatar {
  width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
  background: var(--surface2); border: 1px solid var(--border);
  font-family: var(--font-mono); font-size: 10px; font-weight: 700; color: var(--text-dim);
  border-radius: 50%; overflow: hidden;
}
.cpub-post-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }

.cpub-post-author-name { font-weight: 500; color: var(--text-dim); }
.cpub-post-handle { color: var(--text-faint); font-size: 11px; }
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

/* Reply form */
.cpub-reply-form { margin-bottom: 16px; }
.cpub-reply-row { display: flex; gap: 8px; }
.cpub-reply-input {
  flex: 1; padding: 8px 12px; background: var(--surface); border: var(--border-width-default) solid var(--border);
  color: var(--text); font-size: 13px;
}
.cpub-reply-input:focus { outline: none; border-color: var(--accent); }

.cpub-fed-reply-hint {
  font-size: 11px; color: var(--text-faint); margin-top: 6px;
  display: flex; align-items: center; gap: 5px;
}
.cpub-fed-reply-hint i { font-size: 10px; color: var(--accent); }

/* Replies section */
.cpub-replies-section {}
.cpub-empty-state { text-align: center; }
.cpub-empty-state-title { font-size: 14px; font-weight: 600; color: var(--text-dim); margin-bottom: 4px; }
.cpub-empty-state-desc { font-size: 12px; color: var(--text-faint); line-height: 1.5; }
.cpub-inline-link { color: var(--accent); text-decoration: none; white-space: nowrap; }
.cpub-inline-link:hover { text-decoration: underline; }

.cpub-loading { color: var(--text-dim); }

@media (max-width: 768px) {
  .cpub-post-page { padding: 0 12px 32px; }
  .cpub-fed-banner { margin: 0 -12px 12px; }
  .cpub-post-card { padding: 16px; }
  .cpub-post-content { font-size: 14px; }
  .cpub-post-meta { flex-direction: column; align-items: flex-start; }
  .cpub-post-author { flex-wrap: wrap; }
  .cpub-reply-row { flex-direction: column; }
  .cpub-reply-input { width: 100%; }
}
</style>
