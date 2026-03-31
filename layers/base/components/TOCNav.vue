<script setup lang="ts">
defineProps<{
  headings: Array<{ id: string; text: string; level: number }>;
  activeId?: string;
}>();
</script>

<template>
  <nav class="cpub-toc" aria-label="Table of contents">
    <h3 class="cpub-toc-title">Contents</h3>
    <ul class="cpub-toc-list">
      <li
        v-for="h in headings"
        :key="h.id"
        :class="['cpub-toc-item', { active: activeId === h.id }]"
        :style="{ paddingLeft: (h.level - 2) * 12 + 'px' }"
      >
        <a :href="`#${h.id}`" class="cpub-toc-link">{{ h.text }}</a>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.cpub-toc {
  position: sticky;
  top: 80px;
}

.cpub-toc-title {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  margin-bottom: 12px;
}

.cpub-toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.cpub-toc-item {
  margin-bottom: 2px;
}

.cpub-toc-link {
  font-size: 12px;
  color: var(--text-dim);
  text-decoration: none;
  display: block;
  padding: 4px 8px;
  border-left: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}

.cpub-toc-link:hover {
  color: var(--text);
}

.cpub-toc-item.active .cpub-toc-link {
  color: var(--accent);
  border-left-color: var(--accent);
  font-weight: 500;
}
</style>
