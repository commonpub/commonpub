<script setup lang="ts">
const route = useRoute();
const slug = computed(() => route.params.slug as string);

const { data: community } = await useFetch(() => `/api/communities/${slug.value}`);
const { data: posts } = await useFetch(() => `/api/communities/${slug.value}/posts`);

useSeoMeta({
  title: () => community.value ? `${community.value.name} — CommonPub` : 'Community — CommonPub',
  description: () => community.value?.description || '',
});

const { isAuthenticated } = useAuth();
const newPostContent = ref('');
const posting = ref(false);

async function handlePost(): Promise<void> {
  posting.value = true;
  try {
    await $fetch(`/api/communities/${slug.value}/posts`, {
      method: 'POST',
      body: { content: newPostContent.value, type: 'discussion' },
    });
    newPostContent.value = '';
    refreshNuxtData();
  } catch {
    // Silently fail for now
  } finally {
    posting.value = false;
  }
}
</script>

<template>
  <div class="community-page" v-if="community">
    <header class="community-header">
      <h1 class="community-name">{{ community.name }}</h1>
      <p class="community-desc" v-if="community.description">{{ community.description }}</p>
      <div class="community-stats">
        <span>{{ community.memberCount }} members</span>
        <span>{{ community.postCount }} posts</span>
      </div>
      <div class="community-actions">
        <NuxtLink :to="`/communities/${slug}/members`" class="cpub-link">Members</NuxtLink>
        <NuxtLink v-if="community.currentUserRole === 'owner' || community.currentUserRole === 'admin'" :to="`/communities/${slug}/settings`" class="cpub-link">Settings</NuxtLink>
      </div>
    </header>

    <section class="community-posts">
      <div v-if="isAuthenticated" class="post-composer">
        <textarea
          v-model="newPostContent"
          class="post-textarea"
          placeholder="Write something..."
          rows="3"
          aria-label="New post content"
        />
        <button class="cpub-btn-primary" :disabled="posting || !newPostContent" @click="handlePost">
          {{ posting ? 'Posting...' : 'Post' }}
        </button>
      </div>

      <template v-if="posts?.length">
        <div class="post-card" v-for="post in posts" :key="post.id">
          <div class="post-header">
            <NuxtLink :to="`/u/${post.author.username}`" class="post-author">
              {{ post.author.displayName || post.author.username }}
            </NuxtLink>
            <time class="post-time">{{ new Date(post.createdAt).toLocaleDateString() }}</time>
          </div>
          <p class="post-content">{{ post.content }}</p>
          <div class="post-footer">
            <span>{{ post.likeCount }} likes</span>
            <span>{{ post.replyCount }} replies</span>
          </div>
        </div>
      </template>
      <p class="posts-empty" v-else>No posts yet. Be the first to start a discussion!</p>
    </section>
  </div>
  <div v-else class="not-found">
    <h1>Community not found</h1>
  </div>
</template>

<style scoped>
.community-page {
  max-width: var(--content-max-width);
}

.community-header {
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--border);
}

.community-name {
  font-size: var(--text-2xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-2);
}

.community-desc {
  font-size: var(--text-sm);
  color: var(--text-dim);
  line-height: var(--leading-relaxed);
  margin-bottom: var(--space-3);
}

.community-stats {
  display: flex;
  gap: var(--space-4);
  font-size: var(--text-xs);
  color: var(--text-faint);
  margin-bottom: var(--space-3);
}

.community-actions {
  display: flex;
  gap: var(--space-3);
}

.cpub-link {
  color: var(--accent);
  text-decoration: none;
  font-size: var(--text-sm);
}

.cpub-link:hover {
  text-decoration: underline;
}

.cpub-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.post-composer {
  margin-bottom: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.post-textarea {
  padding: var(--space-3);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  resize: vertical;
}

.post-textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

.cpub-btn-primary {
  padding: var(--space-2) var(--space-4);
  background: var(--accent);
  color: var(--color-on-primary);
  border: 1px solid var(--border);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-sans);
  cursor: pointer;
  align-self: flex-start;
}

.cpub-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cpub-btn-primary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.post-card {
  padding: var(--space-4);
  border: 1px solid var(--border);
  background: var(--surface);
  margin-bottom: var(--space-3);
}

.post-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.post-author {
  font-weight: var(--font-weight-medium);
  font-size: var(--text-sm);
  color: var(--text);
  text-decoration: none;
}

.post-author:hover {
  color: var(--accent);
}

.post-time {
  font-size: var(--text-xs);
  color: var(--text-faint);
}

.post-content {
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  margin-bottom: var(--space-3);
}

.post-footer {
  display: flex;
  gap: var(--space-4);
  font-size: var(--text-xs);
  color: var(--text-faint);
}

.posts-empty {
  color: var(--text-faint);
  text-align: center;
  padding: var(--space-8) 0;
}

.not-found {
  text-align: center;
  padding: var(--space-10) 0;
  color: var(--text-dim);
}
</style>
