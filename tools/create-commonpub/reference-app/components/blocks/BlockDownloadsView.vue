<script setup lang="ts">
interface FileItem {
  name: string;
  url: string;
  size?: string;
  type?: string;
}

const props = defineProps<{ content: Record<string, unknown> }>();

const files = computed<FileItem[]>(() => {
  const raw = props.content.files;
  if (!Array.isArray(raw)) return [];
  return raw as FileItem[];
});
</script>

<template>
  <div v-if="files.length > 0" class="cpub-block-downloads">
    <div class="cpub-dl-header">
      <i class="fa-solid fa-download cpub-dl-icon"></i>
      <span class="cpub-dl-title">Downloads</span>
      <span class="cpub-dl-count">{{ files.length }} file{{ files.length !== 1 ? 's' : '' }}</span>
    </div>
    <div class="cpub-dl-list">
      <div v-for="(file, i) in files" :key="i" class="cpub-dl-item">
        <div class="cpub-dl-file-icon"><i class="fa-solid fa-file-arrow-down"></i></div>
        <div class="cpub-dl-info">
          <a :href="file.url" class="cpub-dl-name" download>{{ file.name }}</a>
          <span v-if="file.size" class="cpub-dl-size">{{ file.size }}</span>
        </div>
        <a :href="file.url" class="cpub-dl-btn" download aria-label="Download">
          <i class="fa-solid fa-download"></i>
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-block-downloads {
  border: 2px solid var(--border);
  margin: 20px 0;
  overflow: hidden;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-dl-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--surface2);
  border-bottom: 2px solid var(--border);
}

.cpub-dl-icon { font-size: 12px; color: var(--accent); }
.cpub-dl-title { font-size: 12px; font-weight: 600; color: var(--text); flex: 1; }
.cpub-dl-count { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); }

.cpub-dl-list { display: flex; flex-direction: column; }

.cpub-dl-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border2);
}

.cpub-dl-item:last-child { border-bottom: none; }

.cpub-dl-file-icon {
  width: 32px;
  height: 32px;
  background: var(--surface2);
  border: 2px solid var(--border2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-faint);
  flex-shrink: 0;
}

.cpub-dl-info { flex: 1; min-width: 0; }

.cpub-dl-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--accent);
  text-decoration: none;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cpub-dl-name:hover { text-decoration: underline; }

.cpub-dl-size {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-faint);
}

.cpub-dl-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-bg);
  border: 2px solid var(--accent-border);
  color: var(--accent);
  font-size: 12px;
  text-decoration: none;
  flex-shrink: 0;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.cpub-dl-btn:hover {
  background: var(--accent);
  color: var(--color-text-inverse);
}
</style>
