<script setup lang="ts">
/**
 * `/settings/profile` has no content of its own now that Profile is a set of
 * tabs, so it sends the member to the first one (plan R3.1 D7). Every existing
 * link into `/settings/profile` therefore still lands on a real editor.
 *
 * Same shape as `pages/settings/index.vue`, which does exactly this for
 * `/settings`: `navigateTo` in setup, so server-side this is a 302 and no shell
 * is painted before the move.
 */
definePageMeta({ middleware: 'auth' });
navigateTo('/settings/profile/basics', { replace: true });
</script>

<template>
  <div />
</template>
