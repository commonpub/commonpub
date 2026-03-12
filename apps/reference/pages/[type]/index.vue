<script setup lang="ts">
const route = useRoute();
const contentType = computed(() => route.params.type as string);

useSeoMeta({
  title: () => `${contentType.value} — CommonPub`,
  description: () => `Browse ${contentType.value} on CommonPub.`,
});

const { data } = await useFetch('/api/content', {
  query: computed(() => ({
    status: 'published',
    type: contentType.value,
    limit: 20,
  })),
});
</script>

<template>
  <div class="listing-page">
    <h1 class="listing-title cpub-capitalize">{{ contentType }}</h1>

    <div class="listing-grid" v-if="data?.items?.length">
      <div class="listing-card" v-for="item in data.items" :key="item.id">
        <div class="listing-card-thumb" :style="item.coverImageUrl ? `background-image: url(${item.coverImageUrl})` : ''" />
        <div class="listing-card-body">
          <h2 class="listing-card-title">
            <NuxtLink :to="`/${contentType}/${item.slug}`">{{ item.title }}</NuxtLink>
          </h2>
          <p class="listing-card-desc" v-if="item.description">{{ item.description }}</p>
          <div class="listing-card-meta">
            <span>{{ item.author.displayName || item.author.username }}</span>
            <span>{{ item.viewCount }} views</span>
          </div>
        </div>
      </div>
    </div>
    <p class="listing-empty" v-else>No {{ contentType }} published yet.</p>
  </div>
</template>

<style scoped>
.listing-page {
  max-width: var(--content-max-width);
}

.listing-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-6);
}

.cpub-capitalize {
  text-transform: capitalize;
}

.listing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}

.listing-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--surface);
}

.listing-card-thumb {
  height: 140px;
  background: var(--surface2);
  background-size: cover;
  background-position: center;
}

.listing-card-body {
  padding: var(--space-3);
}

.listing-card-title {
  font-size: var(--text-md);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-1);
}

.listing-card-title a {
  color: var(--text);
  text-decoration: none;
}

.listing-card-title a:hover {
  color: var(--accent);
}

.listing-card-desc {
  font-size: var(--text-sm);
  color: var(--text-dim);
  line-height: var(--leading-relaxed);
}

.listing-card-meta {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-faint);
}

.listing-empty {
  color: var(--text-faint);
  font-size: var(--text-sm);
  text-align: center;
  padding: var(--space-10) 0;
}
</style>
