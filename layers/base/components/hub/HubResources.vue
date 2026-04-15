<script setup lang="ts">
const props = defineProps<{
  resources: { items: Array<{ id: string; title: string; url: string; description: string | null; category: string; sortOrder: number; addedBy: { id: string; username: string; displayName: string | null; avatarUrl: string | null }; createdAt: string; updatedAt: string }>; total: number } | null;
  currentUserRole?: string | null;
  hubSlug?: string;
  isAuthenticated?: boolean;
  authUserId?: string | null;
}>();

const emit = defineEmits<{ 'resource-changed': [] }>();

const canManage = computed(() => ['owner', 'admin', 'moderator'].includes(props.currentUserRole ?? ''));
const isMember = computed(() => !!props.currentUserRole);

const showForm = ref(false);
const formTitle = ref('');
const formUrl = ref('');
const formDescription = ref('');
const formCategory = ref('other');
const creating = ref(false);

const categoryLabels: Record<string, string> = {
  documentation: 'Documentation',
  tools: 'Tools',
  tutorials: 'Tutorials',
  community: 'Community',
  hardware: 'Hardware',
  software: 'Software',
  other: 'Other',
};

type ResourceItem = NonNullable<typeof props.resources>['items'][number];

const groupedResources = computed(() => {
  const groups: Record<string, ResourceItem[]> = {};
  for (const item of props.resources?.items ?? []) {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category]!.push(item);
  }
  const order = ['documentation', 'tools', 'tutorials', 'community', 'hardware', 'software', 'other'];
  const sorted: Array<{ category: string; label: string; items: ResourceItem[] }> = [];
  for (const cat of order) {
    if (groups[cat]?.length) {
      sorted.push({ category: cat, label: categoryLabels[cat] ?? cat, items: groups[cat]! });
    }
  }
  return sorted;
});

async function handleCreate(): Promise<void> {
  if (!formTitle.value.trim() || !formUrl.value.trim() || !props.hubSlug) return;
  creating.value = true;
  try {
    await $fetch(`/api/hubs/${props.hubSlug}/resources`, {
      method: 'POST',
      body: {
        title: formTitle.value,
        url: formUrl.value,
        description: formDescription.value || undefined,
        category: formCategory.value,
      },
    });
    formTitle.value = '';
    formUrl.value = '';
    formDescription.value = '';
    formCategory.value = 'other';
    showForm.value = false;
    emit('resource-changed');
  } catch { /* toast error */ }
  finally { creating.value = false; }
}

async function handleDelete(id: string): Promise<void> {
  if (!props.hubSlug) return;
  try {
    await $fetch(`/api/hubs/${props.hubSlug}/resources/${id}`, { method: 'DELETE' });
    emit('resource-changed');
  } catch { /* toast error */ }
}
</script>

<template>
  <div class="cpub-resources">
    <div v-if="isMember && hubSlug" class="cpub-resources-header">
      <button class="cpub-btn cpub-btn-sm" @click="showForm = !showForm">
        <i :class="showForm ? 'fa-solid fa-times' : 'fa-solid fa-plus'"></i>
        {{ showForm ? 'Cancel' : 'Add Resource' }}
      </button>
    </div>

    <form v-if="showForm" class="cpub-resource-form" @submit.prevent="handleCreate">
      <input v-model="formTitle" type="text" placeholder="Resource title" class="cpub-input" required maxlength="255" />
      <input v-model="formUrl" type="url" placeholder="https://..." class="cpub-input" required />
      <input v-model="formDescription" type="text" placeholder="Short description (optional)" class="cpub-input" maxlength="2000" />
      <select v-model="formCategory" class="cpub-input" aria-label="Resource category">
        <option v-for="(label, key) in categoryLabels" :key="key" :value="key">{{ label }}</option>
      </select>
      <button type="submit" class="cpub-btn cpub-btn-primary cpub-btn-sm" :disabled="creating || !formTitle.trim() || !formUrl.trim()">
        {{ creating ? 'Adding...' : 'Add Resource' }}
      </button>
    </form>

    <template v-if="groupedResources.length">
      <div v-for="group in groupedResources" :key="group.category" class="cpub-resources-group">
        <h4 class="cpub-resources-category">
          <i class="fa-solid" :class="{
            'fa-book': group.category === 'documentation',
            'fa-wrench': group.category === 'tools',
            'fa-graduation-cap': group.category === 'tutorials',
            'fa-users': group.category === 'community',
            'fa-microchip': group.category === 'hardware',
            'fa-code': group.category === 'software',
            'fa-link': group.category === 'other',
          }"></i>
          {{ group.label }}
        </h4>
        <div class="cpub-resources-list">
          <a
            v-for="item in group.items"
            :key="item.id"
            :href="item.url"
            target="_blank"
            rel="noopener noreferrer"
            class="cpub-resource-item"
          >
            <div class="cpub-resource-item-main">
              <span class="cpub-resource-item-title">{{ item.title }}</span>
              <i class="fa-solid fa-arrow-up-right-from-square cpub-resource-item-ext"></i>
              <p v-if="item.description" class="cpub-resource-item-desc">{{ item.description }}</p>
            </div>
            <div class="cpub-resource-item-meta">
              <span>{{ item.addedBy.displayName || item.addedBy.username }}</span>
              <button
                v-if="canManage || authUserId === item.addedBy.id"
                class="cpub-resource-delete"
                aria-label="Delete resource"
                @click.prevent.stop="handleDelete(item.id)"
              >
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </a>
        </div>
      </div>
    </template>
    <div v-else class="cpub-empty-state">
      <div class="cpub-empty-state-icon"><i class="fa-solid fa-link"></i></div>
      <p class="cpub-empty-state-title">No resources added yet</p>
      <p class="cpub-empty-state-desc">Add links to documentation, tools, and tutorials for this community.</p>
    </div>
  </div>
</template>

<style scoped>
.cpub-resources-header {
  margin-bottom: 16px;
}

.cpub-resource-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  margin-bottom: 20px;
}

.cpub-resources-group {
  margin-bottom: 24px;
}

.cpub-resources-category {
  font-size: 11px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cpub-resources-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cpub-resource-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  text-decoration: none;
  color: inherit;
  transition: box-shadow var(--transition-fast);
}

.cpub-resource-item:hover {
  box-shadow: var(--shadow-sm);
}

.cpub-resource-item-main {
  flex: 1;
  min-width: 0;
}

.cpub-resource-item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.cpub-resource-item-ext {
  font-size: 9px;
  color: var(--text-faint);
  margin-left: 4px;
}

.cpub-resource-item-desc {
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cpub-resource-item-meta {
  font-size: 10px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.cpub-resource-delete {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-faint);
  padding: 4px;
  font-size: 11px;
}

.cpub-resource-delete:hover {
  color: var(--red);
}

@media (max-width: 640px) {
  .cpub-resource-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
}
</style>
