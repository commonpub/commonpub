<script setup lang="ts">
definePageMeta({});

useHead({
  title: 'Find Remote Users — Federation',
});
</script>

<template>
  <div class="cpub-page-federation-search">
    <SectionHeader title="Find Remote Users" />

    <p class="cpub-page-federation-search__desc">
      Search for users on other instances by their handle. Enter a full handle
      like <code>@alice@mastodon.social</code> to discover and follow users
      across the fediverse.
    </p>

    <RemoteUserSearch />
  </div>
</template>

<style scoped>
.cpub-page-federation-search {
  max-width: 640px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}

.cpub-page-federation-search__desc {
  margin-bottom: var(--space-6);
  color: var(--text-2);
  line-height: 1.6;
}

.cpub-page-federation-search__desc code {
  font-family: var(--font-mono);
  background: var(--surface-2);
  padding: 0.1em 0.3em;
}
</style>
