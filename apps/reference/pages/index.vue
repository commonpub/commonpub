<script setup lang="ts">
useSeoMeta({
  title: 'CommonPub — Self-hosted maker community',
  description: 'An open ActivityPub federation protocol for self-hosted maker communities.',
  ogTitle: 'CommonPub',
  ogDescription: 'An open ActivityPub federation protocol for self-hosted maker communities.',
});

const { data: feed } = await useFetch('/api/content', {
  query: { status: 'published', sort: 'recent', limit: 20 },
});

const { data: trending } = await useFetch('/api/content', {
  query: { status: 'published', sort: 'popular', limit: 5 },
});
</script>

<template>
  <div class="home">
    <div class="feed">
      <h1 class="home-title">Feed</h1>
      <template v-if="feed?.items?.length">
        <div class="card" v-for="item in feed.items" :key="item.id">
          <div class="card-header">
            <div class="card-avatar" />
            <div>
              <NuxtLink :to="`/u/${item.author.username}`" class="card-author">
                {{ item.author.displayName || item.author.username }}
              </NuxtLink>
              <p class="card-date">{{ new Date(item.publishedAt || item.createdAt).toLocaleDateString() }}</p>
            </div>
          </div>
          <h2 class="card-title">
            <NuxtLink :to="`/${item.type}/${item.slug}`">{{ item.title }}</NuxtLink>
          </h2>
          <p class="card-body" v-if="item.description">{{ item.description }}</p>
          <div class="card-footer">
            <span class="card-type">{{ item.type }}</span>
            <span class="card-stat">{{ item.viewCount }} views</span>
            <span class="card-stat">{{ item.likeCount }} likes</span>
          </div>
        </div>
      </template>
      <p class="empty-state" v-else>No published content yet. Be the first to create something!</p>
    </div>

    <aside class="home-sidebar" aria-label="Trending">
      <h2 class="sidebar-heading">Trending</h2>
      <ul class="trending-list">
        <template v-if="trending?.items?.length">
          <li v-for="item in trending.items" :key="item.id">
            <NuxtLink :to="`/${item.type}/${item.slug}`" class="trending-link">
              {{ item.title }}
            </NuxtLink>
          </li>
        </template>
        <li v-else class="trending-empty">Nothing trending yet.</li>
      </ul>
    </aside>
  </div>
</template>

<style scoped>
.home {
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: var(--space-6);
}

.home-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-4);
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-bottom: var(--space-3);
}

.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.card-avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--surface2);
}

.card-author {
  font-weight: var(--font-weight-medium);
  font-size: var(--text-sm);
  color: var(--text);
  text-decoration: none;
}

.card-author:hover {
  color: var(--accent);
}

.card-date {
  font-size: var(--text-xs);
  color: var(--text-faint);
}

.card-title {
  font-size: var(--text-md);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-1);
}

.card-title a {
  color: var(--text);
  text-decoration: none;
}

.card-title a:hover {
  color: var(--accent);
}

.card-body {
  font-size: var(--text-sm);
  color: var(--text-dim);
  line-height: var(--leading-relaxed);
}

.card-footer {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-3);
  font-size: var(--text-xs);
  color: var(--text-faint);
}

.card-type {
  text-transform: capitalize;
  color: var(--accent);
  font-weight: var(--font-weight-medium);
}

.empty-state {
  color: var(--text-faint);
  font-size: var(--text-sm);
  text-align: center;
  padding: var(--space-10) 0;
}

.home-sidebar {
  border-left: 1px solid var(--border);
  padding-left: var(--space-4);
}

.sidebar-heading {
  font-size: var(--text-md);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-3);
}

.trending-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.trending-link {
  color: var(--accent);
  text-decoration: none;
  font-size: var(--text-sm);
}

.trending-link:hover {
  text-decoration: underline;
}

.trending-empty {
  color: var(--text-faint);
  font-size: var(--text-sm);
}
</style>
