<script setup lang="ts">
const route = useRoute();
const contentType = computed(() => route.params.type as string);
const slug = computed(() => route.params.slug as string);

const { data: content } = await useFetch(() => `/api/content/${slug.value}`);

useSeoMeta({
  title: () => content.value?.title ? `${content.value.title} — CommonPub` : 'CommonPub',
  description: () => content.value?.seoDescription || content.value?.description || '',
});

const { user } = useAuth();
const isOwner = computed(() => user.value?.id === content.value?.author?.id);

// Track view
onMounted(() => {
  if (content.value?.id) {
    $fetch(`/api/content/${content.value.id}/view`, { method: 'POST' }).catch(() => {});
  }
});
</script>

<template>
  <article class="content-page" v-if="content">
    <header class="content-header">
      <span class="content-type cpub-capitalize">{{ content.type }}</span>
      <h1 class="content-title">{{ content.title }}</h1>
      <p class="content-subtitle" v-if="content.subtitle">{{ content.subtitle }}</p>
      <div class="content-meta">
        <NuxtLink :to="`/u/${content.author.username}`" class="meta-author">
          {{ content.author.displayName || content.author.username }}
        </NuxtLink>
        <span class="meta-sep" aria-hidden="true">&middot;</span>
        <time class="meta-date">{{ new Date(content.publishedAt || content.createdAt).toLocaleDateString() }}</time>
        <span class="meta-sep" aria-hidden="true">&middot;</span>
        <span class="meta-stat">{{ content.viewCount }} views</span>
      </div>
      <div class="content-tags" v-if="content.tags?.length">
        <span class="content-tag" v-for="tag in content.tags" :key="tag.id">{{ tag.name }}</span>
      </div>
      <NuxtLink v-if="isOwner" :to="`/${content.type}/${content.slug}/edit`" class="cpub-edit-link">Edit</NuxtLink>
    </header>

    <div class="content-body">
      <p v-if="!content.content">No content body yet.</p>
      <div v-else v-html="'Content rendering coming soon'" />
    </div>

    <footer class="content-footer">
      <div class="content-engagement">
        <span>{{ content.likeCount }} likes</span>
        <span>{{ content.commentCount }} comments</span>
      </div>
    </footer>
  </article>
  <div v-else class="not-found">
    <h1>Content not found</h1>
    <p>The requested content could not be found.</p>
  </div>
</template>

<style scoped>
.content-page {
  max-width: var(--content-max-width);
}

.content-header {
  margin-bottom: var(--space-6);
}

.content-type {
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  color: var(--accent);
  letter-spacing: var(--tracking-wide);
}

.cpub-capitalize {
  text-transform: capitalize;
}

.content-title {
  font-size: var(--text-3xl);
  font-weight: var(--font-weight-bold);
  margin-top: var(--space-2);
  margin-bottom: var(--space-2);
  line-height: var(--leading-tight);
}

.content-subtitle {
  font-size: var(--text-lg);
  color: var(--text-dim);
  margin-bottom: var(--space-2);
}

.content-meta {
  display: flex;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-dim);
}

.meta-author {
  color: var(--text);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
}

.meta-author:hover {
  color: var(--accent);
}

.meta-stat {
  color: var(--text-faint);
}

.content-tags {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
  flex-wrap: wrap;
}

.content-tag {
  padding: var(--space-1) var(--space-2);
  background: var(--surface2);
  font-size: var(--text-xs);
  color: var(--text-dim);
}

.cpub-edit-link {
  display: inline-block;
  margin-top: var(--space-3);
  color: var(--accent);
  text-decoration: none;
  font-size: var(--text-sm);
}

.content-body {
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  color: var(--text);
}

.content-body p {
  margin-bottom: var(--space-4);
}

.content-footer {
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
}

.content-engagement {
  display: flex;
  gap: var(--space-4);
  font-size: var(--text-sm);
  color: var(--text-dim);
}

.not-found {
  text-align: center;
  padding: var(--space-10) 0;
  color: var(--text-dim);
}
</style>
