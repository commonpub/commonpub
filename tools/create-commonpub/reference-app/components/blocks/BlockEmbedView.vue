<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();

const url = computed(() => {
  const raw = (props.content.url as string) || '';
  // Only allow http/https URLs — block javascript:, data:, etc.
  if (raw && (raw.startsWith('https://') || raw.startsWith('http://'))) return raw;
  return '';
});
</script>

<template>
  <div v-if="url" class="cpub-block-embed">
    <div class="cpub-embed-label">
      <i class="fa-solid fa-globe"></i> Embed
    </div>
    <div class="cpub-embed-wrap">
      <iframe :src="url" class="cpub-embed-iframe" frameborder="0" loading="lazy" title="Embedded content" />
    </div>
  </div>
</template>

<style scoped>
.cpub-block-embed {
  margin: 24px 0;
  border: 2px solid var(--border);
  overflow: hidden;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-embed-label {
  padding: 6px 12px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
  background: var(--surface2);
  border-bottom: 2px solid var(--border);
  display: flex;
  align-items: center;
  gap: 6px;
}

.cpub-embed-label i { color: var(--accent); }

.cpub-embed-wrap {
  position: relative;
  padding-bottom: 56.25%;
  height: 0;
}

.cpub-embed-iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
