<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ update: [content: Record<string, unknown>] }>();
interface FileItem { name: string; url: string; size?: string; type?: string; }
const files = computed(() => (props.content.files as FileItem[]) ?? []);
function addFile(): void { emit('update', { files: [...files.value, { name: '', url: '' }] }); }
function removeFile(i: number): void { emit('update', { files: files.value.filter((_: FileItem, idx: number) => idx !== i) }); }
function updateFile(i: number, field: string, value: string): void {
  const updated = [...files.value];
  updated[i] = { ...updated[i]!, [field]: value };
  emit('update', { files: updated });
}
</script>
<template>
  <div class="cpub-downloads-block">
    <div class="cpub-dl-header"><i class="fa-solid fa-download"></i> Downloads <button class="cpub-dl-add" @click="addFile"><i class="fa-solid fa-plus"></i></button></div>
    <div v-for="(file, i) in files" :key="i" class="cpub-dl-item">
      <i class="fa-solid fa-file cpub-dl-file-icon"></i>
      <input class="cpub-dl-name" :value="file.name" placeholder="Filename..." @input="updateFile(i, 'name', ($event.target as HTMLInputElement).value)" />
      <input class="cpub-dl-url" :value="file.url" placeholder="URL..." @input="updateFile(i, 'url', ($event.target as HTMLInputElement).value)" />
      <button class="cpub-dl-remove" @click="removeFile(i)"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div v-if="files.length === 0" class="cpub-dl-empty" @click="addFile"><i class="fa-solid fa-plus"></i> Add downloadable file</div>
  </div>
</template>
<style scoped>
.cpub-downloads-block { border: 2px solid var(--border2); background: var(--surface); }
.cpub-dl-header { padding: 8px 12px; font-size: 12px; font-weight: 600; background: var(--surface2); border-bottom: 2px solid var(--border2); display: flex; align-items: center; gap: 8px; }
.cpub-dl-header i { color: var(--accent); }
.cpub-dl-add { margin-left: auto; background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 11px; }
.cpub-dl-add:hover { color: var(--accent); }
.cpub-dl-item { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--border2); }
.cpub-dl-file-icon { color: var(--text-faint); font-size: 12px; }
.cpub-dl-name { flex: 1; font-size: 12px; font-weight: 500; background: transparent; border: none; outline: none; color: var(--text); }
.cpub-dl-url { flex: 2; font-size: 11px; background: transparent; border: none; outline: none; color: var(--text-dim); font-family: var(--font-mono); }
.cpub-dl-name::placeholder, .cpub-dl-url::placeholder { color: var(--text-faint); }
.cpub-dl-remove { background: none; border: none; color: var(--text-faint); cursor: pointer; }
.cpub-dl-remove:hover { color: var(--red); }
.cpub-dl-empty { padding: 20px; text-align: center; font-size: 12px; color: var(--text-faint); cursor: pointer; }
.cpub-dl-empty:hover { color: var(--accent); }
</style>
