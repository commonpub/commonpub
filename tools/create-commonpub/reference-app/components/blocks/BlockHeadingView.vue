<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();

const level = computed(() => Math.min(Math.max((props.content.level as number) || 2, 1), 6));
const text = computed(() => (props.content.text as string) || '');
const slug = computed(() => text.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
const tag = computed(() => `h${level.value}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6');
</script>

<template>
  <component :is="tag" :id="slug" class="cpub-block-heading" :class="`cpub-heading-${level}`">
    {{ text }}
  </component>
</template>

<style scoped>
.cpub-block-heading {
  color: var(--text);
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.cpub-heading-1 { font-size: 28px; font-weight: 700; margin: 48px 0 16px; }
.cpub-heading-2 { font-size: 22px; font-weight: 700; margin: 40px 0 12px; padding-bottom: 8px; border-bottom: 2px solid var(--border); }
.cpub-heading-3 { font-size: 17px; font-weight: 600; margin: 28px 0 8px; }
.cpub-heading-4 { font-size: 15px; font-weight: 600; margin: 24px 0 6px; }
.cpub-heading-5 { font-size: 14px; font-weight: 600; margin: 20px 0 6px; }
.cpub-heading-6 { font-size: 13px; font-weight: 600; margin: 16px 0 4px; text-transform: uppercase; letter-spacing: 0.05em; }
</style>
