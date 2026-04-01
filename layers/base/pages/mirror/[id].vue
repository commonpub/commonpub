<script setup lang="ts">
definePageMeta({ layout: 'default' });

const route = useRoute();
const id = route.params.id as string;

const { data: fedContent, error, pending } = await useFetch<Record<string, unknown>>(`/api/federation/content/${id}`);

const {
  transformedContent,
  viewComponent,
  originDomain,
  originUrl,
  authorHandle,
} = useMirrorContent(fedContent);

// SEO
if (originUrl.value) {
  useHead({
    link: [{ rel: 'canonical', href: originUrl.value }],
    meta: [{ name: 'robots', content: 'noindex, follow' }],
  });
}

useSeoMeta({
  title: transformedContent.value?.title ?? 'Mirrored Content',
  description: transformedContent.value?.description ?? '',
});
</script>

<template>
  <div v-if="pending" class="cpub-loading" style="padding: 64px 24px; text-align: center">Loading content...</div>
  <div v-else-if="error" class="cpub-not-found">
    <h1>Content not found</h1>
    <p>This mirrored content may have been removed or is unavailable.</p>
    <NuxtLink to="/">Back to home</NuxtLink>
  </div>

  <template v-else-if="transformedContent">
    <!-- Federation banner -->
    <div class="cpub-fed-banner">
      <div class="cpub-fed-banner-inner">
        <i class="fa-solid fa-globe"></i>
        <span>
          Federated from <strong>{{ originDomain }}</strong>
          <span v-if="authorHandle" class="cpub-fed-banner-handle">{{ authorHandle }}</span>
        </span>
        <a v-if="originUrl" :href="originUrl" target="_blank" rel="noopener noreferrer" class="cpub-fed-banner-link">
          View Original <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      </div>
    </div>

    <!-- Reuse existing content view component -->
    <component
      v-if="viewComponent && typeof viewComponent !== 'string'"
      :is="viewComponent"
      :content="transformedContent"
      :federated-id="id"
    />

    <!-- Fallback for non-CommonPub content -->
    <article v-else class="cpub-mirror-fallback">
      <div class="cpub-mirror-container">
        <img v-if="transformedContent.coverImageUrl" :src="transformedContent.coverImageUrl" :alt="transformedContent.title" class="cpub-mirror-cover" />
        <h1 class="cpub-mirror-title">{{ transformedContent.title }}</h1>
        <p v-if="transformedContent.description" class="cpub-mirror-desc">{{ transformedContent.description }}</p>
        <div class="cpub-mirror-author">
          <strong>{{ transformedContent.author.displayName }}</strong>
          <span v-if="authorHandle" class="cpub-mirror-handle">{{ authorHandle }}</span>
        </div>
        <div v-if="typeof transformedContent.content === 'string'" class="cpub-mirror-body prose" v-html="transformedContent.content" />
        <div v-if="transformedContent.tags?.length" class="cpub-mirror-tags">
          <span v-for="tag in transformedContent.tags" :key="tag.name" class="cpub-mirror-tag">{{ tag.name }}</span>
        </div>
      </div>
    </article>
  </template>
</template>

<style scoped>
.cpub-fed-banner {
  background: var(--accent-bg); border-bottom: 1px solid var(--accent-border);
}
.cpub-fed-banner-inner {
  max-width: 1200px; margin: 0 auto; padding: 8px 24px;
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: var(--text-dim);
}
.cpub-fed-banner-inner > i { color: var(--accent); flex-shrink: 0; }
.cpub-fed-banner-handle { color: var(--text-faint); margin-left: 4px; }
.cpub-fed-banner-link {
  margin-left: auto; color: var(--accent); font-weight: 600;
  text-decoration: none; white-space: nowrap;
  display: flex; align-items: center; gap: 4px; font-size: 11px;
}
.cpub-fed-banner-link:hover { text-decoration: underline; }

/* Fallback for non-CommonPub content */
.cpub-mirror-fallback { max-width: 780px; margin: 0 auto; padding: 32px 16px 60px; }
.cpub-mirror-cover { width: 100%; max-height: 400px; object-fit: cover; margin-bottom: 20px; }
.cpub-mirror-title { font-size: 2rem; font-weight: 800; line-height: 1.2; margin-bottom: 12px; }
.cpub-mirror-desc { font-size: 1.0625rem; color: var(--text-dim); line-height: 1.6; margin-bottom: 16px; }
.cpub-mirror-author { font-size: 0.875rem; color: var(--text-dim); margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
.cpub-mirror-handle { color: var(--text-faint); margin-left: 6px; }
.cpub-mirror-body { font-size: 1rem; line-height: 1.75; margin-bottom: 32px; }
.cpub-mirror-body :deep(img) { max-width: 100%; }
.cpub-mirror-body :deep(a) { color: var(--accent); }
.cpub-mirror-body :deep(pre) { background: var(--surface2); padding: 12px; overflow-x: auto; }
.cpub-mirror-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.cpub-mirror-tag { font-size: 0.75rem; padding: 3px 8px; background: var(--surface2); color: var(--text-dim); }

.cpub-not-found { text-align: center; padding: 60px 20px; color: var(--text-dim); }
.cpub-not-found h1 { font-size: 1.5rem; color: var(--text); margin-bottom: 8px; }
</style>
