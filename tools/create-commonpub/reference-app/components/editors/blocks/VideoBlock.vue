<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ update: [content: Record<string, unknown>] }>();
const url = computed(() => (props.content.url as string) ?? '');
function updateField(field: string, value: string): void { emit('update', { ...props.content, [field]: value }); }
</script>
<template>
  <div class="cpub-video-block">
    <div class="cpub-video-header"><i class="fa-solid fa-film"></i> Video Embed</div>
    <input class="cpub-video-url" type="url" :value="url" placeholder="Paste YouTube or Vimeo URL..." @input="updateField('url', ($event.target as HTMLInputElement).value)" />
    <div v-if="url" class="cpub-video-preview"><i class="fa-solid fa-play"></i> {{ url }}</div>
  </div>
</template>
<style scoped>
.cpub-video-block { border: 2px solid var(--border2); background: var(--surface); }
.cpub-video-header { padding: 8px 12px; font-size: 12px; font-weight: 600; background: var(--surface2); border-bottom: 2px solid var(--border2); display: flex; align-items: center; gap: 8px; }
.cpub-video-header i { color: var(--accent); }
.cpub-video-url { width: 100%; padding: 8px 12px; font-size: 12px; background: transparent; border: none; border-bottom: 2px solid var(--border2); color: var(--text); outline: none; }
.cpub-video-url:focus { border-bottom-color: var(--accent); }
.cpub-video-url::placeholder { color: var(--text-faint); }
.cpub-video-preview { padding: 32px; text-align: center; font-size: 12px; color: var(--text-dim); background: var(--text); color: var(--surface); display: flex; align-items: center; justify-content: center; gap: 8px; }
</style>
