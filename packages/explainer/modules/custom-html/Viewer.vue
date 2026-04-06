<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';

const props = defineProps<{ content: Record<string, unknown> }>();

const html = computed(() => (props.content.html as string) || '');
const css = computed(() => (props.content.css as string) || '');
const js = computed(() => (props.content.js as string) || '');
const height = computed(() => (props.content.height as number) || 300);
const sandboxed = computed(() => (props.content.sandboxed as boolean) !== false);

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
      :sandbox="sandboxed ? 'allow-scripts' : undefined"
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
