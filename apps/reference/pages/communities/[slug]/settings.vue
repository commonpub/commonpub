<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const route = useRoute();
const slug = computed(() => route.params.slug as string);

const { data: community } = await useFetch(() => `/api/communities/${slug.value}`);

useSeoMeta({
  title: () => `Settings — ${community.value?.name ?? 'Community'} — CommonPub`,
});
</script>

<template>
  <div class="settings-page" v-if="community">
    <h1 class="settings-title">{{ community.name }} Settings</h1>
    <NuxtLink :to="`/communities/${slug}`" class="cpub-back-link">Back to community</NuxtLink>

    <section class="settings-section">
      <h2 class="section-heading">General</h2>
      <p class="settings-placeholder">Community settings management coming soon.</p>
    </section>

    <section class="settings-section">
      <h2 class="section-heading">Moderation</h2>
      <p class="settings-placeholder">Ban management and moderation tools coming soon.</p>
    </section>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 600px;
}

.settings-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-2);
}

.cpub-back-link {
  color: var(--accent);
  text-decoration: none;
  font-size: var(--text-sm);
  display: inline-block;
  margin-bottom: var(--space-6);
}

.cpub-back-link:hover {
  text-decoration: underline;
}

.settings-section {
  margin-bottom: var(--space-6);
  padding: var(--space-4);
  border: 1px solid var(--border);
  background: var(--surface);
}

.section-heading {
  font-size: var(--text-md);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-3);
}

.settings-placeholder {
  color: var(--text-faint);
  font-size: var(--text-sm);
}
</style>
