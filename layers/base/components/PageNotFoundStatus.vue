<script setup lang="ts">
/**
 * Renders nothing; place it inside a page's "not found" state.
 *
 * Pages that load their record lazily show a "not found" message in place, but
 * answered 200, so a missing profile, hub or doc page was an indexable page with
 * a title echoing whatever was typed into the URL (session 262 audit). Rendering
 * this during SSR sets the real status and keeps the page out of search results;
 * on the client it only adds the robots tag.
 */
if (import.meta.server) {
  const event = useRequestEvent();
  if (event) setResponseStatus(event, 404, 'Not Found');
}
useHead({ meta: [{ name: 'robots', content: 'noindex' }] });
</script>

<template>
  <span hidden aria-hidden="true" />
</template>
