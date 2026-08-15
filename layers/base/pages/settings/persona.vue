<script setup lang="ts">
/**
 * `/settings/persona` is now a redirect to `/settings/profile/questions`
 * (plan R3.1 D8).
 *
 * The editor that used to live here moved into the Profile tab set, because two
 * adjacent tabs called Profile and Profile Details, both writing the same
 * `users` columns, is how a member ended up with two places to change their job
 * title and no hint they were the same field.
 *
 * A redirect and not a rename: this path is linked from the invitation banner,
 * from the public profile's own empty state, and from the e2e specs, and it is
 * the URL anyone who bookmarked the editor holds. One file costs less than
 * three broken entry points, and "persona" was never a word to show a member
 * anyway.
 *
 * `navigateTo` in setup rather than `definePageMeta({ redirect })`: it is the
 * shape already used by `pages/settings/index.vue`, and server-side it answers
 * with a 302 before anything is painted.
 */
definePageMeta({ middleware: 'auth' });
navigateTo('/settings/profile/questions', { replace: true });
</script>

<template>
  <div />
</template>
