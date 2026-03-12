<script setup lang="ts">
useSeoMeta({
  title: 'Communities — CommonPub',
  description: 'Browse and join maker communities.',
});

const { data } = await useFetch('/api/communities');
const { isAuthenticated } = useAuth();
</script>

<template>
  <div class="communities-page">
    <div class="communities-header">
      <h1 class="communities-title">Communities</h1>
      <NuxtLink v-if="isAuthenticated" to="/communities/create" class="cpub-btn-primary">Create Community</NuxtLink>
    </div>

    <div class="communities-grid" v-if="data?.length">
      <div class="community-card" v-for="c in data" :key="c.id">
        <NuxtLink :to="`/communities/${c.slug}`" class="community-card-link">
          <h2 class="community-card-name">{{ c.name }}</h2>
          <p class="community-card-desc" v-if="c.description">{{ c.description }}</p>
          <div class="community-card-stats">
            <span>{{ c.memberCount }} members</span>
            <span>{{ c.postCount }} posts</span>
          </div>
        </NuxtLink>
      </div>
    </div>
    <p class="communities-empty" v-else>No communities yet. Be the first to create one!</p>
  </div>
</template>

<style scoped>
.communities-page {
  max-width: var(--content-max-width);
}

.communities-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.communities-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
}

.cpub-btn-primary {
  padding: var(--space-2) var(--space-4);
  background: var(--accent);
  color: var(--color-on-primary);
  border: 1px solid var(--border);
  text-decoration: none;
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
}

.cpub-btn-primary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.communities-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}

.community-card {
  border: 1px solid var(--border);
  background: var(--surface);
  padding: var(--space-4);
}

.community-card-link {
  color: var(--text);
  text-decoration: none;
}

.community-card-name {
  font-size: var(--text-md);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-2);
}

.community-card-link:hover .community-card-name {
  color: var(--accent);
}

.community-card-desc {
  font-size: var(--text-sm);
  color: var(--text-dim);
  line-height: var(--leading-relaxed);
  margin-bottom: var(--space-3);
}

.community-card-stats {
  display: flex;
  gap: var(--space-3);
  font-size: var(--text-xs);
  color: var(--text-faint);
}

.communities-empty {
  color: var(--text-faint);
  text-align: center;
  padding: var(--space-10) 0;
}
</style>
