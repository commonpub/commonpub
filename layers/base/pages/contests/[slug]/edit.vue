<script setup lang="ts">
// Thin route shell — the editor lives in the shared ContestEditor component
// (mode-aware), so create and edit stay identical. SEO + auth are handled inside.
definePageMeta({ middleware: 'auth', layout: false });
</script>

<template>
  <ContestEditor mode="edit" />
</template>
