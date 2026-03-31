<script setup lang="ts">
const props = defineProps<{
  open: boolean;
  types?: string[];
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  select: [item: { id: string; title: string; slug: string; type: string }];
}>();

const { user } = useAuth();
const search = ref('');

const query = computed(() => ({
  status: 'published',
  authorId: user.value?.id,
  search: search.value || undefined,
  type: props.types?.length === 1 ? props.types[0] : undefined,
  limit: 50,
}));

const { data, pending, refresh: refreshContent } = useLazyFetch('/api/content', {
  query,
  watch: [query],
  immediate: false,
});

const items = computed(() => {
  const all = data.value?.items ?? [];
  if (props.types && props.types.length > 1) {
    return all.filter((i: { type: string }) => props.types!.includes(i.type));
  }
  return all;
});

function pick(item: { id: string; title: string; slug: string; type: string }): void {
  emit('select', item);
  emit('update:open', false);
}

function close(): void {
  emit('update:open', false);
}

const searchRef = ref<HTMLInputElement>();

// Fetch data and focus search when picker opens
watch(() => props.open, (v) => {
  if (v) {
    if (user.value?.id) refreshContent();
    nextTick(() => searchRef.value?.focus());
    search.value = '';
  }
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="cpub-picker-overlay" @click.self="close">
      <div class="cpub-picker-dialog" role="dialog" aria-label="Select content" @keydown.escape="close">
        <div class="cpub-picker-header">
          <h2 class="cpub-picker-title"><i class="fa-solid fa-link"></i> Link Existing Content</h2>
          <button class="cpub-picker-close" aria-label="Close" @click="close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="cpub-picker-search">
          <input
            ref="searchRef"
            v-model="search"
            class="cpub-picker-input"
            type="text"
            placeholder="Search your published content..."
            aria-label="Search content"
          />
        </div>
        <div class="cpub-picker-body">
          <div v-if="pending" class="cpub-picker-loading">Loading...</div>
          <div v-else-if="!items.length" class="cpub-picker-empty">
            <p>No published content found.</p>
          </div>
          <button
            v-for="item in items"
            :key="item.id"
            class="cpub-picker-item"
            @click="pick(item)"
          >
            <span class="cpub-picker-type-badge">{{ item.type }}</span>
            <span class="cpub-picker-item-title">{{ item.title }}</span>
            <span v-if="item.publishedAt" class="cpub-picker-item-date">
              {{ new Date(item.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cpub-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: var(--color-surface-overlay-light);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cpub-picker-dialog {
  background: var(--surface);
  border: 2px solid var(--border);
  box-shadow: var(--shadow-xl);
  width: 520px;
  max-width: 90vw;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.cpub-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 2px solid var(--border);
}

.cpub-picker-title {
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.cpub-picker-title i {
  color: var(--accent);
  font-size: 12px;
}

.cpub-picker-close {
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
}

.cpub-picker-close:hover {
  color: var(--text);
}

.cpub-picker-search {
  padding: 12px 16px;
  border-bottom: 2px solid var(--border);
}

.cpub-picker-input {
  width: 100%;
  padding: 8px 10px;
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  font-family: var(--font-mono);
}

.cpub-picker-input:focus {
  border-color: var(--accent);
  outline: none;
}

.cpub-picker-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.cpub-picker-loading,
.cpub-picker-empty {
  padding: 32px 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text-faint);
}

.cpub-picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 16px;
  background: none;
  border: none;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  font-size: 13px;
}

.cpub-picker-item:hover {
  background: var(--surface2);
}

.cpub-picker-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.cpub-picker-type-badge {
  font-size: 9px;
  font-family: var(--font-mono);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 7px;
  border: 2px solid var(--accent-border);
  background: var(--accent-bg);
  color: var(--accent);
  flex-shrink: 0;
}

.cpub-picker-item-title {
  flex: 1;
  font-weight: 500;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cpub-picker-item-date {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  flex-shrink: 0;
}
</style>
