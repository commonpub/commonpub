<script setup lang="ts">
const { attachments } = defineProps<{
  attachments: Array<{ type: string; url: string; name?: string }>;
}>();

function iconForType(type: string): string {
  if (type === 'Image') return 'fa-solid fa-image';
  if (type === 'Video') return 'fa-solid fa-film';
  if (type === 'Audio') return 'fa-solid fa-music';
  return 'fa-solid fa-file';
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function fileName(att: { url: string; name?: string }): string {
  if (att.name) return att.name;
  try {
    return new URL(att.url).pathname.split('/').pop() ?? 'attachment';
  } catch {
    return 'attachment';
  }
}

const safeAttachments = computed(() =>
  attachments.filter((att) => att.url && att.type && isSafeUrl(att.url)),
);
</script>

<template>
  <div v-if="safeAttachments.length > 0" class="cpub-attachments">
    <div class="cpub-attachments-label">Attachments</div>
    <div class="cpub-attachments-list">
      <a
        v-for="(att, i) in safeAttachments"
        :key="i"
        :href="att.url"
        target="_blank"
        rel="noopener noreferrer"
        class="cpub-attachment-item"
      >
        <img v-if="att.type === 'Image'" :src="att.url" :alt="att.name ?? ''" class="cpub-attachment-thumb" loading="lazy" />
        <div v-else class="cpub-attachment-icon"><i :class="iconForType(att.type)"></i></div>
        <span class="cpub-attachment-name">{{ fileName(att) }}</span>
      </a>
    </div>
  </div>
</template>

<style scoped>
.cpub-attachments {
  margin: 28px 0;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.cpub-attachments-label {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 10px;
}
.cpub-attachments-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cpub-attachment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  text-decoration: none;
  color: var(--text-dim);
  font-size: 12px;
  transition: background var(--transition-fast);
}
.cpub-attachment-item:hover {
  background: var(--surface2);
  color: var(--accent);
}
.cpub-attachment-thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border: 1px solid var(--border2);
}
.cpub-attachment-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--text-faint);
  font-size: 14px;
}
.cpub-attachment-name {
  font-family: var(--font-mono);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
