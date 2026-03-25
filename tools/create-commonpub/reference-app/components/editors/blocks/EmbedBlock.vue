<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ update: [content: Record<string, unknown>] }>();
const url = computed(() => (props.content.url as string) ?? '');
function updateField(field: string, value: string): void { emit('update', { ...props.content, [field]: value }); }
</script>
<template>
  <div class="cpub-embed-block">
    <div class="cpub-embed-header"><i class="fa-solid fa-globe"></i> Embed</div>
    <input class="cpub-embed-url" type="url" :value="url" placeholder="Paste embed URL..." @input="updateField('url', ($event.target as HTMLInputElement).value)" />
  </div>
</template>
<style scoped>
.cpub-embed-block { border: 2px solid var(--border2); background: var(--surface); }
.cpub-embed-header { padding: 8px 12px; font-size: 12px; font-weight: 600; background: var(--surface2); border-bottom: 2px solid var(--border2); display: flex; align-items: center; gap: 8px; }
.cpub-embed-header i { color: var(--accent); }
.cpub-embed-url { width: 100%; padding: 8px 12px; font-size: 12px; background: transparent; border: none; color: var(--text); outline: none; }
.cpub-embed-url:focus { background: var(--accent-bg); }
.cpub-embed-url::placeholder { color: var(--text-faint); }
</style>
