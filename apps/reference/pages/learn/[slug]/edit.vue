<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const route = useRoute();
const slug = computed(() => route.params.slug as string);
const toast = useToast();

import type { Serialized, LearningPathDetail } from '@commonpub/server';

type PathModule = NonNullable<Serialized<LearningPathDetail>['modules']>[number];

const { data: path, refresh } = await useFetch<Serialized<LearningPathDetail>>(() => `/api/learn/${slug.value}`);

useSeoMeta({ title: () => `Edit ${path.value?.title ?? 'Path'} — CommonPub` });

const saving = ref(false);
const publishing = ref(false);
const newModuleTitle = ref('');
const newLessonTitle = ref<Record<string, string>>({});
const newLessonType = ref<Record<string, string>>({});

const lessonTypes = ['article', 'video', 'quiz', 'project', 'explainer'] as const;

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
  <div v-if="path" class="cpub-path-edit">
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
        <button
          class="cpub-btn cpub-btn-primary"
          :disabled="publishing"
          @click="handlePublish"
        >
          <i class="fa-solid fa-rocket"></i> {{ publishing ? 'Publishing...' : 'Publish' }}
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
          <div v-for="lesson in (mod.lessons ?? [])" :key="lesson.id" class="cpub-lesson-row">
            <i class="fa-solid fa-grip-vertical cpub-lesson-grip"></i>
            <span class="cpub-lesson-type-badge">{{ lesson.type }}</span>
            <span class="cpub-lesson-title">{{ lesson.title }}</span>
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
            <button class="cpub-add-btn" :disabled="saving" @click="addLesson(mod.id)">
              <i class="fa-solid fa-plus"></i>
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
.cpub-status-draft { background: var(--surface3); color: var(--text-faint); border: 1px solid var(--border2); }
.cpub-status-published { background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border); }

.cpub-modules-list { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }

.cpub-module-card { background: var(--surface); border: 2px solid var(--border); box-shadow: 4px 4px 0 var(--border); }

.cpub-module-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 2px solid var(--border); background: var(--surface2); gap: 8px; }
.cpub-module-title-input { font-size: 14px; font-weight: 600; background: none; border: 2px solid transparent; padding: 4px 8px; color: var(--text); outline: none; flex: 1; }
.cpub-module-title-input:focus { border-color: var(--accent); background: var(--surface); }
.cpub-module-count { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); flex-shrink: 0; }

.cpub-delete-btn { background: none; border: none; color: var(--text-faint); cursor: pointer; padding: 4px 6px; font-size: 12px; flex-shrink: 0; }
.cpub-delete-btn:hover { color: var(--red); }
.cpub-delete-btn-sm { font-size: 10px; padding: 2px 4px; }

.cpub-lessons-list { padding: 8px 0; }
.cpub-lesson-row { display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-bottom: 1px solid var(--border2); }
.cpub-lesson-row:last-child { border-bottom: none; }
.cpub-lesson-grip { color: var(--text-faint); font-size: 10px; cursor: grab; }
.cpub-lesson-type-badge { font-size: 9px; font-family: var(--font-mono); text-transform: uppercase; padding: 1px 6px; border: 1px solid var(--border2); color: var(--text-faint); background: var(--surface2); }
.cpub-lesson-title { font-size: 13px; color: var(--text); flex: 1; }

.cpub-add-lesson { display: flex; gap: 0; padding: 8px 16px; }
.cpub-type-select { padding: 6px 8px; border: 2px solid var(--border); background: var(--surface); color: var(--text-dim); font-size: 11px; font-family: var(--font-mono); outline: none; min-width: 80px; }
.cpub-type-select:focus { border-color: var(--accent); }
.cpub-add-input { flex: 1; padding: 6px 10px; border: 2px solid var(--border); border-left: none; background: var(--surface); color: var(--text); font-size: 12px; outline: none; }
.cpub-add-input:focus { border-color: var(--accent); }
.cpub-add-input::placeholder { color: var(--text-faint); }
.cpub-add-btn { padding: 6px 10px; background: var(--accent); color: var(--color-text-inverse); border: 2px solid var(--accent); border-left: none; font-size: 11px; cursor: pointer; }
.cpub-add-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.cpub-empty-modules { text-align: center; padding: 32px; color: var(--text-faint); font-size: 13px; }

.cpub-add-module { display: flex; gap: 10px; align-items: center; }
.cpub-add-module-input { flex: 1; padding: 8px 12px; border: 2px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; outline: none; }
.cpub-add-module-input:focus { border-color: var(--accent); }
.cpub-add-module-input::placeholder { color: var(--text-faint); }

</style>
