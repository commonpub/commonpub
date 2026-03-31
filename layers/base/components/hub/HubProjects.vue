<script setup lang="ts">
import type { Serialized, ContentListItem, PaginatedResponse } from '@commonpub/server';

const props = defineProps<{
  slug: string;
  gallery: PaginatedResponse<Serialized<ContentListItem>> | null;
  isAuthenticated: boolean;
  currentUserRole: string | null;
  isProductHub: boolean;
  authUserId?: string;
}>();

const emit = defineEmits<{
  refreshGallery: [];
}>();

const showProjectPicker = ref(false);
const sharingProject = ref(false);
const toast = useToast();

const { data: myProjects, refresh: refreshMyProjects } = useLazyFetch<{ items: Array<{ id: string; title: string; coverImageUrl?: string | null }> }>(() => `/api/content?authorId=${props.authUserId ?? ''}&type=project&status=published&limit=50`, {
  immediate: false,
});

async function openProjectPicker(): Promise<void> {
  showProjectPicker.value = true;
  await refreshMyProjects();
}

async function shareProjectToHub(contentId: string): Promise<void> {
  sharingProject.value = true;
  try {
    await $fetch(`/api/hubs/${props.slug}/share`, {
      method: 'POST',
      body: { contentId },
    });
    toast.success('Project shared to hub');
    showProjectPicker.value = false;
    emit('refreshGallery');
  } catch {
    toast.error('Failed to share project');
  } finally {
    sharingProject.value = false;
  }
}
</script>

<template>
  <div v-if="isAuthenticated && currentUserRole && !isProductHub" class="cpub-projects-actions" style="margin-bottom: 16px; display: flex; gap: 8px;">
    <NuxtLink :to="`/create?hub=${slug}`" class="cpub-btn cpub-btn-primary cpub-btn-sm">
      <i class="fa-solid fa-plus"></i> New Project
    </NuxtLink>
    <button class="cpub-btn cpub-btn-sm" @click="openProjectPicker">
      <i class="fa-solid fa-link"></i> Add Existing Project
    </button>
  </div>
  <div v-if="gallery?.items?.length" class="cpub-gallery-grid">
    <ContentCard
      v-for="item in gallery.items"
      :key="item.id"
      :item="item"
    />
  </div>
  <div v-else class="cpub-empty-state">
    <div class="cpub-empty-state-icon"><i class="fa-solid fa-folder-open"></i></div>
    <p class="cpub-empty-state-title">No projects yet</p>
    <p v-if="isProductHub" class="cpub-empty-state-desc">Projects that use this product in their BOM will appear here automatically.</p>
    <p v-else-if="currentUserRole" class="cpub-empty-state-desc">Share your projects to this hub using the buttons above.</p>
    <p v-else class="cpub-empty-state-desc">Join this hub to share your projects here.</p>
  </div>

  <!-- Project Picker Modal -->
  <Teleport to="body">
    <div v-if="showProjectPicker" class="cpub-modal-backdrop" @click.self="showProjectPicker = false">
      <div class="cpub-modal-content">
        <div class="cpub-modal-header">
          <h3 class="cpub-modal-title">Add Project to Hub</h3>
          <button class="cpub-modal-close" @click="showProjectPicker = false"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <p class="cpub-modal-desc">Select one of your published projects to share to this hub.</p>
        <div v-if="!myProjects?.items?.length" class="cpub-modal-empty">
          <p>You don't have any published projects yet.</p>
          <NuxtLink to="/create" class="cpub-btn cpub-btn-sm cpub-btn-primary" @click="showProjectPicker = false">Create One</NuxtLink>
        </div>
        <div v-else class="cpub-hub-picker">
          <button
            v-for="project in myProjects.items"
            :key="project.id"
            class="cpub-hub-pick-item"
            :disabled="sharingProject"
            @click="shareProjectToHub(project.id)"
          >
            <div class="cpub-hub-pick-icon">
              <img v-if="project.coverImageUrl" :src="project.coverImageUrl" :alt="project.title" />
              <i v-else class="fa-solid fa-folder-open"></i>
            </div>
            <span class="cpub-hub-pick-name">{{ project.title }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cpub-gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

/* Modal */
.cpub-modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--color-surface-scrim, rgba(0,0,0,0.5));
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cpub-modal-content {
  background: var(--surface);
  border: 2px solid var(--border);
  box-shadow: var(--shadow-lg);
  padding: 24px;
  max-width: 420px;
  width: 90vw;
}

.cpub-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.cpub-modal-title { font-size: 16px; font-weight: 700; }

.cpub-modal-close {
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
}
.cpub-modal-close:hover { color: var(--text); }

.cpub-modal-desc { font-size: 13px; color: var(--text-dim); margin-bottom: 16px; }

.cpub-modal-empty {
  text-align: center;
  padding: 20px 0;
  color: var(--text-faint);
  font-size: 13px;
}
.cpub-modal-empty p { margin-bottom: 12px; }

.cpub-hub-picker {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.cpub-hub-pick-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: none;
  border: 2px solid var(--border);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.1s;
}
.cpub-hub-pick-item:hover { border-color: var(--accent); background: var(--accent-bg); }
.cpub-hub-pick-item:disabled { opacity: 0.5; cursor: wait; }

.cpub-hub-pick-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface2);
  border: 2px solid var(--border);
  font-size: 12px;
  color: var(--text-faint);
  overflow: hidden;
  flex-shrink: 0;
}
.cpub-hub-pick-icon img { width: 100%; height: 100%; object-fit: cover; }

.cpub-hub-pick-name { font-size: 13px; font-weight: 500; flex: 1; }

@media (max-width: 1024px) {
  .cpub-gallery-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 640px) {
  .cpub-gallery-grid { grid-template-columns: 1fr; }
}
</style>
