<script setup lang="ts">
const props = defineProps<{
  content: Record<string, unknown>;
}>();

const emit = defineEmits<{
  update: [content: Record<string, unknown>];
}>();

const tag = computed({
  get: () => (props.content.tag as string) || '',
  set: (v: string) => emit('update', { ...props.content, tag: v }),
});

const title = computed({
  get: () => (props.content.title as string) || '',
  set: (v: string) => emit('update', { ...props.content, title: v }),
});

const body = computed({
  get: () => (props.content.body as string) || '',
  set: (v: string) => emit('update', { ...props.content, body: v }),
});
</script>

<template>
  <div class="cpub-section-header-block">
    <input
      v-model="tag"
      type="text"
      class="cpub-shb-tag"
      placeholder="§ 01 — Section Name"
      aria-label="Section tag"
    />
    <input
      v-model="title"
      type="text"
      class="cpub-shb-title"
      placeholder="Section title"
      aria-label="Section title"
    />
    <textarea
      v-model="body"
      class="cpub-shb-body"
      placeholder="Brief intro for this section..."
      rows="2"
      aria-label="Section intro"
    />
  </div>
</template>

<style scoped>
.cpub-section-header-block {
  padding: 28px 24px 24px;
}

.cpub-shb-tag {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 10px;
  display: block;
  width: 100%;
  background: none;
  border: 2px solid transparent;
  padding: 2px 4px;
  outline: none;
}

.cpub-shb-tag::placeholder {
  color: var(--text-faint);
  font-weight: 500;
}

.cpub-shb-tag:focus {
  border-color: var(--accent-border);
  background: var(--accent-bg);
}

.cpub-shb-title {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text);
  line-height: 1.15;
  margin-bottom: 10px;
  display: block;
  width: 100%;
  background: none;
  border: 2px solid transparent;
  padding: 4px;
  outline: none;
  font-family: inherit;
}

.cpub-shb-title::placeholder {
  color: var(--text-faint);
}

.cpub-shb-title:focus {
  border-color: var(--accent-border);
  background: var(--surface2);
}

.cpub-shb-body {
  font-size: 14px;
  color: var(--text-dim);
  line-height: 1.75;
  max-width: 540px;
  width: 100%;
  resize: vertical;
  background: none;
  border: 2px solid transparent;
  padding: 4px;
  outline: none;
  font-family: inherit;
}

.cpub-shb-body::placeholder {
  color: var(--text-faint);
}

.cpub-shb-body:focus {
  border-color: var(--accent-border);
  background: var(--surface2);
}
</style>
