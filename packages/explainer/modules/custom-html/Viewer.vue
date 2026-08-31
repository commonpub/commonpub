<script setup lang="ts">
/* eslint-disable no-useless-escape -- see the note below; the escape is load-bearing */
/*
 * The backslash before the closing script tag in the srcdoc template literal
 * below is load-bearing, not decoration. This is a single-file component: an
 * UNESCAPED closing script tag inside that literal would terminate THIS block
 * and break the parse. (Writing one out in this very comment does the same
 * thing, which is why it is described in words here rather than shown.)
 *
 * The escape sits inside a template literal, where a line comment would become
 * string content, so the disable has to be file-scoped rather than local. It
 * must also be the first thing in its comment: ESLint does not detect a
 * directive that starts after a leading `*`, which is why this is two comments
 * and not one.
 */
import { ref, computed, watch, onMounted } from 'vue';

const props = defineProps<{ content: Record<string, unknown> }>();

const html = computed(() => (props.content.html as string) || '');
const css = computed(() => (props.content.css as string) || '');
const js = computed(() => (props.content.js as string) || '');
const height = computed(() => (props.content.height as number) || 300);

const iframeRef = ref<HTMLIFrameElement | null>(null);

const srcdoc = computed(() => {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; padding: 16px; font-family: system-ui, sans-serif; color: rgba(255,255,255,0.85); background: transparent; }
  ${css.value}
</style>
</head>
<body>
${html.value}
<script>${js.value}<\/script>
</body>
</html>`;
});

// Refresh iframe on content change
watch(srcdoc, () => {
  if (iframeRef.value) {
    iframeRef.value.srcdoc = srcdoc.value;
  }
});
</script>

<template>
  <div class="cpub-custom-html">
    <iframe
      ref="iframeRef"
      :srcdoc="srcdoc"
      :style="{ height: height + 'px' }"
      sandbox="allow-scripts"
      class="cpub-custom-iframe"
      title="Custom interactive"
    />
  </div>
</template>

<style scoped>
.cpub-custom-html {
  padding: 0;
}

.cpub-custom-iframe {
  width: 100%;
  border: none;
  display: block;
  background: transparent;
}
</style>
