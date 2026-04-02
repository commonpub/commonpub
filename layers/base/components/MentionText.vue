<script setup lang="ts">
const props = defineProps<{
  text: string;
}>();

interface TextSegment {
  type: 'text' | 'mention';
  value: string;
}

const MENTION_RE = /(?:^|(?<=[\s(]))@([a-zA-Z0-9_-]{1,39})(?=[\s,.!?;:)\]|]|$)/g;

const segments = computed((): TextSegment[] => {
  const result: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of props.text.matchAll(MENTION_RE)) {
    const start = match.index!;
    if (start > lastIndex) {
      result.push({ type: 'text', value: props.text.slice(lastIndex, start) });
    }
    result.push({ type: 'mention', value: match[1]! });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < props.text.length) {
    result.push({ type: 'text', value: props.text.slice(lastIndex) });
  }

  return result.length > 0 ? result : [{ type: 'text', value: props.text }];
});
</script>

<template>
  <span class="cpub-mention-text">
    <template v-for="(seg, idx) in segments" :key="idx">
      <NuxtLink v-if="seg.type === 'mention'" :to="`/u/${seg.value}`" class="cpub-mention">@{{ seg.value }}</NuxtLink>
      <template v-else>{{ seg.value }}</template>
    </template>
  </span>
</template>

<style scoped>
.cpub-mention {
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}

.cpub-mention:hover {
  text-decoration: underline;
}
</style>
