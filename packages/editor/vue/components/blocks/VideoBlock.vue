<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ update: [content: Record<string, unknown>] }>();
const url = computed(() => (props.content.url as string) ?? '');

type Size = 's' | 'm' | 'l' | 'full';
const size = computed<Size>(() => {
  const v = props.content.size;
  return v === 's' || v === 'm' || v === 'l' || v === 'full' ? v : 'l';
});
const sizeOptions: Array<{ value: Size; label: string; hint: string }> = [
  { value: 's', label: 'S', hint: 'small (~320px)' },
  { value: 'm', label: 'M', hint: 'medium (~540px)' },
  { value: 'l', label: 'L', hint: 'large (~760px)' },
  { value: 'full', label: 'Full', hint: 'full width' },
];
function updateField(field: string, value: string): void { emit('update', { ...props.content, [field]: value }); }
function setSize(s: Size): void { emit('update', { ...props.content, size: s }); }
</script>
<template>
  <div class="cpub-video-block">
    <div class="cpub-video-header"><i class="fa-solid fa-film"></i> Video Embed</div>
    <input class="cpub-video-url" type="url" :value="url" placeholder="Paste YouTube or Vimeo URL..." @input="updateField('url', ($event.target as HTMLInputElement).value)" />
    <div v-if="url" class="cpub-video-size-row" role="group" aria-label="Video size">
      <span class="cpub-video-size-label">Size</span>
      <div class="cpub-video-size-options">
        <button
          v-for="opt in sizeOptions"
          :key="opt.value"
          type="button"
          class="cpub-video-size-btn"
          :class="{ 'cpub-video-size-btn-active': size === opt.value }"
          :title="opt.hint"
          :aria-pressed="size === opt.value"
          @click="setSize(opt.value)"
        >{{ opt.label }}</button>
      </div>
    </div>
    <div v-if="url" class="cpub-video-preview"><i class="fa-solid fa-play"></i> {{ url }}</div>
  </div>
</template>
<style scoped>
.cpub-video-block { border: var(--border-width-default) solid var(--border2); background: var(--surface); }
.cpub-video-header { padding: 8px 12px; font-size: 12px; font-weight: 600; background: var(--surface2); border-bottom: var(--border-width-default) solid var(--border2); display: flex; align-items: center; gap: 8px; }
.cpub-video-header i { color: var(--accent); }
.cpub-video-url { width: 100%; padding: 8px 12px; font-size: 12px; background: transparent; border: none; border-bottom: var(--border-width-default) solid var(--border2); color: var(--text); outline: none; }
.cpub-video-url:focus { border-bottom-color: var(--accent); }
.cpub-video-url::placeholder { color: var(--text-faint); }
.cpub-video-size-row { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-bottom: var(--border-width-default) solid var(--border2); }
.cpub-video-size-label { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-faint); }
.cpub-video-size-options { display: inline-flex; border: var(--border-width-default) solid var(--border2); }
.cpub-video-size-btn { padding: 4px 11px; background: transparent; border: none; border-right: var(--border-width-default) solid var(--border2); font-family: var(--font-mono); font-size: 11px; color: var(--text-dim); cursor: pointer; }
.cpub-video-size-btn:last-child { border-right: none; }
.cpub-video-size-btn:hover { background: var(--surface2); }
.cpub-video-size-btn-active { background: var(--accent-bg); color: var(--accent); }
.cpub-video-preview { padding: 32px; text-align: center; font-size: 12px; background: var(--text); color: var(--surface); display: flex; align-items: center; justify-content: center; gap: 8px; }
</style>
