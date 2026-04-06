<script setup lang="ts">
/**
 * Legacy content route — redirects to /u/{username}/{type}/{slug}.
 * Kept for backwards compatibility with existing links and bookmarks.
 */
import type { Serialized, ContentDetail } from '@commonpub/server';

const route = useRoute();
const contentType = computed(() => route.params.type as string);
const slug = computed(() => route.params.slug as string);

const reqHeaders = import.meta.server ? useRequestHeaders(['cookie']) : {};
const { data: content } = await useFetch<Serialized<ContentDetail>>(() => `/api/content/${slug.value}`, { headers: reqHeaders });

// Redirect to new user-scoped URL if we can resolve the author
if (content.value?.author?.username) {
  await navigateTo(`/u/${content.value.author.username}/${content.value.type}/${content.value.slug}`, { redirectCode: 301, replace: true });
}
</script>

<template>
  <div v-if="!content" class="cpub-not-found">
    <h1>Content not found</h1>
    <p>The requested content could not be found.</p>
  </div>
</template>

<style scoped>
.cpub-not-found {
  text-align: center;
  padding: var(--space-16) 0;
  color: var(--text-dim);
}
</style>
