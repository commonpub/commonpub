<script setup lang="ts">
import type { BlockTuple } from '@commonpub/editor';

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

// Estimate reading time (~200 words per minute)
const readTime = computed(() => {
  if (!content.value?.content) return undefined;
  const blocks = content.value.content as BlockTuple[];
  let words = 0;
  for (const [type, data] of blocks) {
    // Extract text from any string field in the block data
    for (const val of Object.values(data)) {
      if (typeof val === 'string' && val.trim()) {
        // Strip HTML tags before counting
        const text = val.replace(/<[^>]*>/g, '').trim();
        if (text) words += text.split(/\s+/).length;
      }
    }
  }
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
});

// Enrich content with computed readTime
const enrichedContent = computed(() => {
  if (!content.value) return null;
  return { ...content.value, readTime: readTime.value };
});

// Map content types to specialized view components
const viewComponent = computed(() => {
  switch (contentType.value) {
    case 'article': return resolveComponent('ViewsArticleView');
    case 'blog': return resolveComponent('ViewsBlogView');
    case 'explainer': return resolveComponent('ViewsExplainerView');
    case 'project': return resolveComponent('ViewsProjectView');
    default: return null;
  }
});

// Related content
const { data: related } = await useFetch('/api/content', {
  query: { status: 'published', type: contentType.value, limit: 3, sort: 'recent' },
});

// Track view
onMounted(() => {
  if (content.value?.id) {
    $fetch(`/api/content/${content.value.id}/view`, { method: 'POST' }).catch(() => {});
  }
});
</script>

<template>
  <div v-if="enrichedContent">
    <!-- Edit button overlay -->
    <div v-if="isOwner" class="cpub-view-edit-bar">
      <NuxtLink :to="`/${enrichedContent.type}/${enrichedContent.slug}/edit`" class="cpub-edit-btn" aria-label="Edit">
        <i class="fa-solid fa-pen"></i> Edit
      </NuxtLink>
    </div>

    <!-- Specialized view -->
    <component
      v-if="viewComponent && typeof viewComponent !== 'string'"
      :is="viewComponent"
      :content="enrichedContent"
    />

    <!-- Fallback: generic view for unknown types -->
    <article v-else class="cpub-view">
      <div class="cpub-cover" v-if="enrichedContent.coverImage">
        <img :src="enrichedContent.coverImage" :alt="enrichedContent.title" />
      </div>
      <div class="cpub-cover cpub-cover-placeholder" v-else>
        <span class="cpub-cover-label">{{ contentType }}</span>
      </div>

      <div class="cpub-view-container">
        <header class="cpub-view-header">
          <ContentTypeBadge :type="enrichedContent.type" />
          <h1 class="cpub-view-title">{{ enrichedContent.title }}</h1>
          <p class="cpub-view-subtitle" v-if="enrichedContent.subtitle || enrichedContent.description">
            {{ enrichedContent.subtitle || enrichedContent.description }}
          </p>
          <AuthorRow
            :author="enrichedContent.author"
            :date="enrichedContent.publishedAt || enrichedContent.createdAt"
            :read-time="readTime"
          />
          <EngagementBar
            :content-id="enrichedContent.id"
            :like-count="enrichedContent.likeCount ?? 0"
            :comment-count="enrichedContent.commentCount ?? 0"
          />
        </header>

        <div class="cpub-view-body">
          <template v-if="enrichedContent.content && Array.isArray(enrichedContent.content) && enrichedContent.content.length > 0">
            <ClientOnly>
              <CpubEditor :model-value="enrichedContent.content as BlockTuple[]" :editable="false" />
            </ClientOnly>
          </template>
          <p v-else class="cpub-view-empty">No content body yet.</p>
        </div>

        <div class="cpub-view-tags" v-if="enrichedContent.tags?.length">
          <span class="cpub-view-tag" v-for="tag in enrichedContent.tags" :key="tag.id || tag.name">{{ tag.name || tag }}</span>
        </div>

        <AuthorCard :author="enrichedContent.author" />
        <CommentSection :content-id="enrichedContent.id" />
      </div>
    </article>

    <!-- Related content (shown for all types) -->
    <section class="cpub-view-related" v-if="related?.items?.length">
      <div class="cpub-view-related-inner">
        <h2 class="cpub-view-related-title">Related {{ contentType }}s</h2>
        <div class="cpub-view-related-grid">
          <ContentCard
            v-for="item in related.items.filter((i: any) => i.id !== enrichedContent.id).slice(0, 3)"
            :key="item.id"
            :item="item"
          />
        </div>
      </div>
    </section>
  </div>
  <div v-else class="cpub-not-found">
    <h1>Content not found</h1>
    <p>The requested content could not be found.</p>
  </div>
</template>

<style scoped>
.cpub-view-edit-bar {
  display: flex;
  justify-content: flex-end;
  padding: var(--space-2) var(--space-6);
  border-bottom: 1px solid var(--border2);
}

.cpub-edit-btn {
  padding: var(--space-1) var(--space-3);
  border: var(--border-width-default) solid var(--border);
  font-size: var(--text-xs);
  color: var(--text);
  text-decoration: none;
}

.cpub-edit-btn:hover {
  background: var(--surface2);
}

.cpub-view {
  max-width: 100%;
}

.cpub-cover {
  width: 100%;
  height: 300px;
  position: relative;
  overflow: hidden;
  border-bottom: var(--border-width-default) solid var(--border);
}

.cpub-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cpub-cover-placeholder {
  background: var(--surface2);
  display: flex;
  align-items: center;
  justify-content: center;
  background-image:
    linear-gradient(var(--border2) 1px, transparent 1px),
    linear-gradient(90deg, var(--border2) 1px, transparent 1px);
  background-size: 40px 40px;
}

.cpub-cover-label {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: var(--tracking-widest);
  color: var(--text-faint);
  background: var(--surface);
  padding: var(--space-2) var(--space-4);
  border: var(--border-width-default) solid var(--border);
}

.cpub-view-container {
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--space-8) var(--space-6);
}

.cpub-view-header {
  margin-bottom: var(--space-6);
}

.cpub-view-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-weight-bold);
  margin-top: var(--space-3);
  margin-bottom: var(--space-2);
  line-height: var(--leading-tight);
}

.cpub-view-subtitle {
  font-size: var(--text-md);
  color: var(--text-dim);
  margin-bottom: var(--space-4);
  line-height: var(--leading-relaxed);
}

.cpub-view-body {
  margin-bottom: var(--space-8);
}

.cpub-view-empty {
  color: var(--text-faint);
  font-style: italic;
  padding: var(--space-10) 0;
  text-align: center;
}

.cpub-view-tags {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-8);
}

.cpub-view-tag {
  padding: var(--space-1) var(--space-3);
  background: var(--surface2);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: var(--font-weight-medium);
  color: var(--text-dim);
  text-transform: lowercase;
}

.cpub-view-related {
  border-top: var(--border-width-default) solid var(--border2);
}

.cpub-view-related-inner {
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--space-8) var(--space-6);
}

.cpub-view-related-title {
  font-size: var(--text-lg);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-5);
  text-transform: capitalize;
}

.cpub-view-related-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}

.cpub-not-found {
  text-align: center;
  padding: var(--space-16) 0;
  color: var(--text-dim);
}

@media (max-width: 768px) {
  .cpub-view-related-grid {
    grid-template-columns: 1fr;
  }
}
</style>
