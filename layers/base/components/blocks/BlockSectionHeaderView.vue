<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();

const tag = computed(() => (props.content.tag as string) || '');
const title = computed(() => (props.content.title as string) || '');
const body = computed(() => (props.content.body as string) || '');
</script>

<template>
  <div class="cpub-block-section-header">
    <div v-if="tag" class="cpub-bsh-tag">{{ tag }}</div>
    <h1 v-if="title" class="cpub-bsh-title">{{ title }}</h1>
    <p v-if="body" class="cpub-bsh-body">{{ body }}</p>
  </div>
</template>

<style scoped>
.cpub-block-section-header {
  padding: 8px 0 16px;
}

.cpub-bsh-tag {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cpub-bsh-tag::before {
  content: '';
  display: inline-block;
  width: 12px;
  height: 2px;
  background: var(--accent);
}

.cpub-bsh-title {
  font-size: 30px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.25;
  margin-bottom: 12px;
  letter-spacing: -0.02em;
}

.cpub-bsh-body {
  font-size: 15px;
  color: var(--text-dim);
  line-height: 1.75;
  max-width: 560px;
}
</style>
