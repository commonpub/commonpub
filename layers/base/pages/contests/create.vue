<script setup lang="ts">
// Thin route shell — the editor lives in the shared ContestEditor component
// (mode-aware), so creating a contest is identical to editing one (block body,
// canvas tabs, the same settings). SEO + auth are handled inside.
definePageMeta({ middleware: 'auth', layout: false });
</script>

<template>
  <ContestEditor mode="create" />
</template>
