<script setup lang="ts">
useSeoMeta({ title: 'Tags — CommonPub', description: 'Browse content by tags.' });

const { data: trending } = await useFetch<any>('/api/search/trending');

// Extract unique tags from trending content
const tags = computed(() => {
  if (!trending.value) return [];
  const items = Array.isArray(trending.value) ? trending.value : (trending.value as { items?: Array<{ tags?: Array<{ name: string }> }> }).items ?? [];
  const tagMap = new Map<string, number>();
  for (const item of items) {
    if (item.tags) {
      for (const tag of item.tags) {
        const name = typeof tag === 'string' ? tag : tag.name;
        if (name) tagMap.set(name, (tagMap.get(name) ?? 0) + 1);
      }
    }
  }
  return Array.from(tagMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
});
</script>

<template>
  <div class="tags-page">
    <h1 class="tags-title">Tags</h1>
    <p class="tags-subtitle">Browse content by topic.</p>

    <div v-if="tags.length" class="tags-cloud">
      <NuxtLink
        v-for="tag in tags"
        :key="tag.name"
        :to="`/tags/${tag.name}`"
        class="tag-chip"
      >
        <span class="tag-hash">#</span>{{ tag.name }}
        <span class="tag-count">{{ tag.count }}</span>
      </NuxtLink>
    </div>
    <div v-else class="tags-empty">
      <div class="tags-empty-icon"><i class="fa-solid fa-tags"></i></div>
      <p>No tags yet. Tags will appear as content is published.</p>
    </div>
  </div>
</template>

<style scoped>
.tags-page { max-width: 800px; margin: 0 auto; padding: 32px; }
.tags-title { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
.tags-subtitle { font-size: 13px; color: var(--text-dim); margin-bottom: 24px; }

.tags-cloud { display: flex; flex-wrap: wrap; gap: 8px; }

.tag-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 8px 14px;
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--text);
  text-decoration: none;
  font-size: 13px;
  box-shadow: 4px 4px 0 var(--border);
  transition: box-shadow 0.15s, transform 0.15s, border-color 0.15s;
}

.tag-chip:hover { box-shadow: 2px 2px 0 var(--border); transform: translate(1px, 1px); border-color: var(--accent); color: var(--accent); }
.tag-hash { color: var(--accent); font-weight: 700; }
.tag-count { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); background: var(--surface2); padding: 1px 6px; margin-left: 4px; }

.tags-empty { text-align: center; padding: 48px 0; color: var(--text-faint); }
.tags-empty-icon { font-size: 32px; margin-bottom: 12px; }
</style>
