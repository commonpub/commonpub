<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const route = useRoute();
const slug = computed(() => route.params.slug as string);
const toast = useToast();

import type { Serialized, LearningPathDetail } from '@commonpub/server';

type PathLesson = NonNullable<Serialized<LearningPathDetail>['modules']>[number]['lessons'][number] & {
  contentItemId?: string | null;
  content?: unknown;
};
type PathModule = Omit<NonNullable<Serialized<LearningPathDetail>['modules']>[number], 'lessons'> & {
  lessons: PathLesson[];
};

const { data: path, pending: pathPending, error: pathError, refresh } = useLazyFetch<Serialized<LearningPathDetail>>(() => `/api/learn/${slug.value}`);

useSeoMeta({ title: () => `Edit ${path.value?.title ?? 'Path'} — ${useSiteName()}` });

const saving = ref(false);
const publishing = ref(false);
const savingMeta = ref(false);
const newModuleTitle = ref('');
const newLessonTitle = ref<Record<string, string>>({});
const newLessonType = ref<Record<string, string>>({});

// Path metadata editing
const editTitle = ref('');
const editDescription = ref('');
const editDifficulty = ref('beginner');
const editEstimatedHours = ref(0);

watch(() => path.value, (p) => {
  if (!p) return;
  editTitle.value = p.title ?? '';
  editDescription.value = p.description ?? '';
  editDifficulty.value = p.difficulty ?? 'beginner';
  editEstimatedHours.value = Number(p.estimatedHours) || 0;
}, { immediate: true });

async function saveMetadata(): Promise<void> {
  savingMeta.value = true;
  try {
    await ($fetch as Function)(`/api/learn/${slug.value}`, {
      method: 'PUT',
      body: {
        title: editTitle.value,
        description: editDescription.value,
        difficulty: editDifficulty.value,
        estimatedHours: editEstimatedHours.value || undefined,
      },
    });
    toast.success('Path details updated');
    await refresh();
  } catch {
    toast.error('Failed to update path details');
  } finally {
    savingMeta.value = false;
  }
}

const lessonTypes = ['article', 'video', 'quiz', 'project', 'explainer'] as const;

// Content linking
const showContentPicker = ref(false);
const linkingModuleId = ref<string | null>(null);

function openPicker(moduleId: string): void {
  linkingModuleId.value = moduleId;
  showContentPicker.value = true;
}

async function linkContent(item: { id: string; title: string; slug: string; type: string }): Promise<void> {
  if (!linkingModuleId.value) return;
  saving.value = true;
  try {
    await $fetch(`/api/learn/${slug.value}/lessons`, {
      method: 'POST',
      body: {
        moduleId: linkingModuleId.value,
        title: item.title,
        type: item.type,
        contentItemId: item.id,
      },
    });
    toast.success('Content linked as lesson');
    await refresh();
  } catch {
    toast.error('Failed to link content');
  } finally {
    saving.value = false;
    linkingModuleId.value = null;
  }
}

async function addModule(): Promise<void> {
  if (!newModuleTitle.value.trim()) return;
  saving.value = true;
  try {
    await $fetch(`/api/learn/${slug.value}/modules`, {
      method: 'POST',
      body: { title: newModuleTitle.value.trim() },
    });
    newModuleTitle.value = '';
    toast.success('Module added');
    await refresh();
  } catch {
    toast.error('Failed to add module');
  } finally {
    saving.value = false;
  }
}

async function addLesson(moduleId: string): Promise<void> {
  const title = newLessonTitle.value[moduleId]?.trim();
  if (!title) return;
  saving.value = true;
  try {
    await $fetch(`/api/learn/${slug.value}/lessons`, {
      method: 'POST',
      body: { moduleId, title, type: newLessonType.value[moduleId] || 'article' },
    });
    newLessonTitle.value[moduleId] = '';
    newLessonType.value[moduleId] = '';
    toast.success('Lesson added');
    await refresh();
  } catch {
    toast.error('Failed to add lesson');
  } finally {
    saving.value = false;
  }
}

async function updateModuleTitle(mod: PathModule, newTitle: string): Promise<void> {
  if (!newTitle.trim() || newTitle === mod.title) return;
  try {
    await $fetch(`/api/learn/${slug.value}/modules/${mod.id}`, {
      method: 'PUT',
      body: { title: newTitle.trim() },
    });
    toast.success('Module updated');
    await refresh();
  } catch {
    toast.error('Failed to update module');
  }
}

async function removeModule(moduleId: string): Promise<void> {
  if (!confirm('Delete this module and all its lessons?')) return;
  try {
    await $fetch(`/api/learn/${slug.value}/modules/${moduleId}`, { method: 'DELETE' });
    toast.success('Module deleted');
    await refresh();
  } catch {
    toast.error('Failed to delete module');
  }
}

async function deletePath(): Promise<void> {
  if (!confirm('Delete this entire learning path? All modules, lessons, and enrollments will be permanently deleted.')) return;
  try {
    await ($fetch as Function)(`/api/learn/${slug.value}`, { method: 'DELETE' });
    toast.success('Learning path deleted');
    await navigateTo('/learn');
  } catch {
    toast.error('Failed to delete path');
  }
}

async function removeLesson(lessonId: string): Promise<void> {
  if (!confirm('Delete this lesson?')) return;
  try {
    await $fetch(`/api/learn/${slug.value}/lessons/${lessonId}`, { method: 'DELETE' });
    toast.success('Lesson deleted');
    await refresh();
  } catch {
    toast.error('Failed to delete lesson');
  }
}

async function handlePublish(): Promise<void> {
  publishing.value = true;
  try {
    await $fetch(`/api/learn/${slug.value}/publish`, { method: 'POST' });
    toast.success('Path published!');
    await refresh();
  } catch {
    toast.error('Failed to publish path');
  } finally {
    publishing.value = false;
  }
}
</script>

<template>
  <div v-if="pathPending" class="cpub-loading">Loading path editor...</div>
  <div v-else-if="pathError" class="cpub-fetch-error">
    <div class="cpub-fetch-error-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
    <div class="cpub-fetch-error-msg">{{ pathError.statusMessage || 'Failed to load learning path.' }}</div>
    <button class="cpub-btn cpub-btn-sm" @click="refresh()">Retry</button>
  </div>
  <div v-else-if="path" class="cpub-path-edit">
    <div class="cpub-edit-header">
      <NuxtLink :to="`/learn/${slug}`" class="cpub-back-link">
        <i class="fa-solid fa-arrow-left"></i> Back to path
      </NuxtLink>
      <div class="cpub-edit-header-row">
        <div>
          <h1 class="cpub-edit-title">Edit: {{ path.title }}</h1>
          <p class="cpub-edit-subtitle">
            Manage modules and lessons
            <span class="cpub-status-badge" :class="path.status === 'published' ? 'cpub-status-published' : 'cpub-status-draft'">
              {{ path.status }}
            </span>
          </p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button
            class="cpub-btn cpub-btn-primary"
            :disabled="publishing"
            @click="handlePublish"
          >
            <i class="fa-solid fa-rocket"></i> {{ publishing ? 'Publishing...' : 'Publish' }}
          </button>
          <button class="cpub-btn" style="color: var(--red); border-color: var(--red-border);" @click="deletePath">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Path Metadata -->
    <div class="cpub-meta-section">
      <h2 class="cpub-meta-section-title">Path Details</h2>
      <div class="cpub-meta-form">
        <div class="cpub-meta-field">
          <label class="cpub-meta-label">Title</label>
          <input v-model="editTitle" type="text" class="cpub-meta-input" />
        </div>
        <div class="cpub-meta-field">
          <label class="cpub-meta-label">Description</label>
          <textarea v-model="editDescription" class="cpub-meta-textarea" rows="3" placeholder="What will learners gain?" />
        </div>
        <div class="cpub-meta-row">
          <div class="cpub-meta-field">
            <label class="cpub-meta-label">Difficulty</label>
            <select v-model="editDifficulty" class="cpub-meta-select">
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div class="cpub-meta-field">
            <label class="cpub-meta-label">Est. Hours</label>
            <input v-model.number="editEstimatedHours" type="number" min="0" class="cpub-meta-input" />
          </div>
        </div>
        <button class="cpub-btn cpub-btn-sm" :disabled="savingMeta" @click="saveMetadata">
          {{ savingMeta ? 'Saving...' : 'Save Details' }}
        </button>
      </div>
    </div>

    <!-- Modules -->
    <div class="cpub-modules-list">
      <div v-for="mod in (path.modules ?? [])" :key="mod.id" class="cpub-module-card">
        <div class="cpub-module-header">
          <input
            :value="mod.title"
            class="cpub-module-title-input"
            @blur="updateModuleTitle(mod, ($event.target as HTMLInputElement).value)"
            @keyup.enter="($event.target as HTMLInputElement).blur()"
          />
          <span class="cpub-module-count">{{ mod.lessons?.length ?? 0 }} lessons</span>
          <button class="cpub-delete-btn" aria-label="Delete module" @click="removeModule(mod.id)">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Lessons in this module -->
        <div class="cpub-lessons-list">
          <div v-for="lesson in ((mod.lessons ?? []) as PathLesson[])" :key="lesson.id" class="cpub-lesson-row">
            <i class="fa-solid fa-grip-vertical cpub-lesson-grip"></i>
            <span class="cpub-lesson-type-badge">{{ lesson.type }}</span>
            <span v-if="lesson.contentItemId" class="cpub-lesson-linked-badge" title="Linked to content"><i class="fa-solid fa-link"></i></span>
            <span class="cpub-lesson-title">{{ lesson.title }}</span>
            <span v-if="!lesson.content && !lesson.contentItemId" class="cpub-lesson-empty-badge">empty</span>
            <NuxtLink :to="`/learn/${slug}/${lesson.slug}/edit`" class="cpub-lesson-edit-btn" aria-label="Edit lesson content">
              <i class="fa-solid fa-pen"></i>
            </NuxtLink>
            <button class="cpub-delete-btn cpub-delete-btn-sm" aria-label="Delete lesson" @click="removeLesson(lesson.id)">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <!-- Add lesson -->
          <div class="cpub-add-lesson">
            <select v-model="newLessonType[mod.id]" class="cpub-type-select" aria-label="Lesson type">
              <option value="">Type</option>
              <option v-for="lt in lessonTypes" :key="lt" :value="lt">{{ lt }}</option>
            </select>
            <input
              v-model="newLessonTitle[mod.id]"
              type="text"
              class="cpub-add-input"
              placeholder="New lesson title..."
              @keyup.enter="addLesson(mod.id)"
            />
            <button class="cpub-add-btn" :disabled="saving" @click="addLesson(mod.id)" aria-label="Add inline lesson">
              <i class="fa-solid fa-plus"></i>
            </button>
            <button class="cpub-link-btn" :disabled="saving" @click="openPicker(mod.id)" aria-label="Link existing content">
              <i class="fa-solid fa-link"></i> Link Content
            </button>
          </div>
        </div>
      </div>

      <div v-if="!path.modules?.length" class="cpub-empty-modules">
        <p>No modules yet. Add one to get started.</p>
      </div>
    </div>

    <!-- Add module -->
    <div class="cpub-add-module">
      <input
        v-model="newModuleTitle"
        type="text"
        class="cpub-add-module-input"
        placeholder="New module title..."
        @keyup.enter="addModule"
      />
      <button class="cpub-btn cpub-btn-primary" :disabled="saving || !newModuleTitle.trim()" @click="addModule">
        <i class="fa-solid fa-plus"></i> Add Module
      </button>
    </div>
  </div>
  <div v-else class="cpub-empty-state" style="padding: 64px 24px; text-align: center;">
    <p>Learning path not found</p>
  </div>

  <ContentPicker
    :open="showContentPicker"
    :types="['article', 'project', 'explainer', 'blog']"
    @update:open="showContentPicker = $event"
    @select="linkContent"
  />
</template>

<style scoped>
.cpub-path-edit { max-width: 700px; margin: 0 auto; padding: 32px; }
.cpub-edit-header { margin-bottom: 32px; }
.cpub-edit-header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.cpub-back-link { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px; }
.cpub-back-link:hover { color: var(--accent); }
.cpub-edit-title { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
.cpub-edit-subtitle { font-size: 13px; color: var(--text-dim); display: flex; align-items: center; gap: 8px; }

.cpub-status-badge { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; padding: 2px 8px; letter-spacing: 0.06em; }
.cpub-status-draft { background: var(--surface3); color: var(--text-faint); border: 2px solid var(--border2); }
.cpub-status-published { background: var(--green-bg); color: var(--green); border: 2px solid var(--green-border); }

.cpub-meta-section { background: var(--surface); border: 2px solid var(--border); padding: 16px 20px; margin-bottom: 24px; box-shadow: var(--shadow-md); }
.cpub-meta-section-title { font-size: 13px; font-weight: 700; margin-bottom: 12px; }
.cpub-meta-form { display: flex; flex-direction: column; gap: 10px; }
.cpub-meta-field { display: flex; flex-direction: column; gap: 3px; }
.cpub-meta-label { font-size: 10px; font-weight: 600; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint); }
.cpub-meta-input, .cpub-meta-textarea, .cpub-meta-select { padding: 6px 10px; border: 2px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; }
.cpub-meta-input:focus, .cpub-meta-textarea:focus, .cpub-meta-select:focus { border-color: var(--accent); outline: none; }
.cpub-meta-textarea { resize: vertical; font-family: inherit; }
.cpub-meta-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

.cpub-modules-list { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }

.cpub-module-card { background: var(--surface); border: 2px solid var(--border); box-shadow: var(--shadow-md); }

.cpub-module-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 2px solid var(--border); background: var(--surface2); gap: 8px; }
.cpub-module-title-input { font-size: 14px; font-weight: 600; background: none; border: 2px solid transparent; padding: 4px 8px; color: var(--text); outline: none; flex: 1; }
.cpub-module-title-input:focus { border-color: var(--accent); background: var(--surface); }
.cpub-module-count { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); flex-shrink: 0; }

.cpub-lessons-list { padding: 8px 0; }
.cpub-lesson-row { display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-bottom: 2px solid var(--border2); }
.cpub-lesson-row:last-child { border-bottom: none; }
.cpub-lesson-grip { color: var(--text-faint); font-size: 10px; cursor: grab; }
.cpub-lesson-type-badge { font-size: 9px; font-family: var(--font-mono); text-transform: uppercase; padding: 1px 6px; border: 2px solid var(--border2); color: var(--text-faint); background: var(--surface2); }
.cpub-lesson-title { font-size: 13px; color: var(--text); flex: 1; }
.cpub-lesson-empty-badge { font-size: 9px; font-family: var(--font-mono); color: var(--yellow); background: var(--yellow-bg); border: 2px solid var(--yellow-border); padding: 1px 6px; text-transform: uppercase; }
.cpub-lesson-edit-btn { font-size: 10px; color: var(--text-faint); padding: 3px 6px; border: 2px solid var(--border2); text-decoration: none; }
.cpub-lesson-edit-btn:hover { color: var(--accent); border-color: var(--accent); }

.cpub-add-lesson { display: flex; gap: 0; padding: 8px 16px; }
.cpub-type-select { padding: 6px 8px; border: 2px solid var(--border); background: var(--surface); color: var(--text-dim); font-size: 11px; font-family: var(--font-mono); outline: none; min-width: 80px; }
.cpub-type-select:focus { border-color: var(--accent); }
.cpub-add-input { flex: 1; padding: 6px 10px; border: 2px solid var(--border); border-left: none; background: var(--surface); color: var(--text); font-size: 12px; outline: none; }
.cpub-add-input:focus { border-color: var(--accent); }
.cpub-add-input::placeholder { color: var(--text-faint); }
.cpub-add-btn { padding: 6px 10px; background: var(--accent); color: var(--color-text-inverse); border: 2px solid var(--accent); border-left: none; font-size: 11px; cursor: pointer; }
.cpub-add-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cpub-link-btn { padding: 6px 10px; background: var(--surface2); color: var(--text-dim); border: 2px solid var(--border); font-size: 10px; font-family: var(--font-mono); cursor: pointer; display: flex; align-items: center; gap: 5px; margin-left: 4px; }
.cpub-link-btn:hover { border-color: var(--accent); color: var(--accent); }
.cpub-link-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cpub-lesson-linked-badge { font-size: 9px; color: var(--teal); display: flex; align-items: center; flex-shrink: 0; }

.cpub-empty-modules { text-align: center; padding: 32px; color: var(--text-faint); font-size: 13px; }

.cpub-add-module { display: flex; gap: 10px; align-items: center; }
.cpub-add-module-input { flex: 1; padding: 8px 12px; border: 2px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; outline: none; }
.cpub-add-module-input:focus { border-color: var(--accent); }
.cpub-add-module-input::placeholder { color: var(--text-faint); }

</style>
