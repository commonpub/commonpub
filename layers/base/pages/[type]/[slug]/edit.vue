<script setup lang="ts">
/**
 * Legacy edit route — redirects to /u/{username}/{type}/{slug}/edit.
 * For "new" content, redirects using the current user's username.
 */
definePageMeta({ layout: false, middleware: 'auth' });

const route = useRoute();
const contentType = computed(() => route.params.type as string);
const slug = computed(() => route.params.slug as string);
const { user } = useAuth();

if (slug.value === 'new') {
  // Creating new content — redirect to new URL using current user
  if (user.value?.username) {
    await navigateTo(
      `/u/${user.value.username}/${contentType.value}/new/edit${route.query.hub ? `?hub=${route.query.hub}` : ''}`,
      { redirectCode: 301, replace: true },
    );
  }
} else {
  // Editing existing content — look up author
  const reqHeaders = import.meta.server ? useRequestHeaders(['cookie']) : {};
  const { data } = await useFetch(() => `/api/content/${slug.value}`, { headers: reqHeaders });
  if (data.value) {
    const d = data.value as { author?: { username: string }; type: string; slug: string };
    if (d.author?.username) {
      await navigateTo(`/u/${d.author.username}/${d.type}/${d.slug}/edit`, { redirectCode: 301, replace: true });
    }
  }
}
</script>

<template>
  <div class="cpub-loading" aria-live="polite">Redirecting...</div>
</template>
