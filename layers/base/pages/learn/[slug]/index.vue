<script setup lang="ts">
const route = useRoute();
const slug = computed(() => route.params.slug as string);

import type { Serialized, LearningPathDetail } from '@commonpub/server';

const { data: path, pending: pathPending, error: pathError, refresh } = useLazyFetch<Serialized<LearningPathDetail>>(() => `/api/learn/${slug.value}`);

useSeoMeta({
  title: () => path.value ? `${path.value.title} — Learn — ${useSiteName()}` : `Learn — ${useSiteName()}`,
  description: () => path.value?.description || '',
  ogImage: '/og-default.png',
});

const { isAuthenticated, user } = useAuth();
const toast = useToast();
const isOwner = computed(() => user.value?.id === path.value?.author?.id);

// Enrollment
const enrolling = ref(false);
const unenrolling = ref(false);

async function handleEnroll(): Promise<void> {
  enrolling.value = true;
  try {
    await $fetch(`/api/learn/${slug.value}/enroll`, { method: 'POST' });
    toast.success('Enrolled!');
    await refresh();
  } catch {
    toast.error('Failed to enroll');
  } finally {
    enrolling.value = false;
  }
}

async function handleUnenroll(): Promise<void> {
  if (!confirm('Are you sure you want to unenroll?')) return;
  unenrolling.value = true;
  try {
    await $fetch(`/api/learn/${slug.value}/unenroll`, { method: 'POST' });
    toast.success('Unenrolled');
    await refresh();
  } catch {
    toast.error('Failed to unenroll');
  } finally {
    unenrolling.value = false;
  }
}

// Module expansion
const expandedModules = ref<Set<string>>(new Set());
function toggleModule(id: string): void {
  if (expandedModules.value.has(id)) expandedModules.value.delete(id);
  else expandedModules.value.add(id);
}

// Auto-expand all modules
watch(path, (p) => {
  if (p?.modules) {
    for (const mod of p.modules) {
      expandedModules.value.add(mod.id);
    }
  }
}, { immediate: true });

// Flatten lessons for "Continue" button
const flatLessons = computed(() => {
  if (!path.value?.modules) return [];
  const result: Array<{ slug: string; title: string; isCompleted?: boolean }> = [];
  for (const mod of path.value.modules) {
    for (const l of (mod.lessons ?? [])) {
      result.push({ slug: l.slug, title: l.title, isCompleted: (l as Record<string, unknown>).isCompleted as boolean | undefined });
    }
  }
  return result;
});

// Find next incomplete lesson, or fall back to first lesson
const nextLessonSlug = computed(() => {
  const incomplete = flatLessons.value.find(l => !l.isCompleted);
  return incomplete?.slug ?? flatLessons.value[0]?.slug ?? null;
});

// Total lesson count
const totalLessons = computed(() => {
  if (!path.value?.modules) return 0;
  return path.value.modules.reduce((sum: number, m: { lessons?: unknown[] }) => sum + (m.lessons?.length ?? 0), 0);
});

// Lesson type icon
function getLessonTypeIcon(type: string): string {
  switch (type) {
    case 'video': return 'fa-solid fa-play';
    case 'quiz': return 'fa-solid fa-circle-question';
    case 'project': return 'fa-solid fa-microchip';
    case 'explainer': return 'fa-solid fa-lightbulb';
    default: return 'fa-solid fa-file-lines';
  }
}

// Difficulty styling
function getDifficultyClass(d: string | null): string {
  switch (d) {
    case 'beginner': return 'diff-beginner';
    case 'intermediate': return 'diff-intermediate';
    case 'advanced': return 'diff-advanced';
    default: return '';
  }
}
</script>

<template>
  <div v-if="pathPending" class="cpub-loading">Loading learning path...</div>
  <div v-else-if="pathError" class="cpub-fetch-error">
    <div class="cpub-fetch-error-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
    <div class="cpub-fetch-error-msg">Failed to load learning path.</div>
    <button class="cpub-btn cpub-btn-sm" @click="refresh()">Retry</button>
  </div>
  <div class="cpub-path" v-else-if="path">
    <div class="cpub-path-layout">
      <!-- MAIN -->
      <main class="cpub-path-main">
        <!-- Header -->
        <header class="cpub-path-header">
          <NuxtLink to="/learn" class="cpub-back-link"><i class="fa-solid fa-arrow-left"></i> Learning Paths</NuxtLink>
          <div class="cpub-path-header-row">
            <div class="cpub-path-header-info">
              <span v-if="path.difficulty" class="cpub-path-difficulty" :class="getDifficultyClass(path.difficulty)">{{ path.difficulty }}</span>
              <span v-if="path.status === 'draft'" class="cpub-path-draft">Draft</span>
              <h1 class="cpub-path-title">{{ path.title }}</h1>
              <p class="cpub-path-desc" v-if="path.description">{{ path.description }}</p>
              <AuthorRow v-if="path.author" :author="path.author" :date="path.createdAt" />
            </div>
          </div>

          <!-- Actions -->
          <div class="cpub-path-actions">
            <template v-if="isAuthenticated && !path.isEnrolled">
              <button class="cpub-enroll-btn" :disabled="enrolling" @click="handleEnroll">
                <i class="fa-solid fa-graduation-cap"></i> {{ enrolling ? 'Enrolling...' : 'Enroll Now' }}
              </button>
            </template>
            <template v-if="path.isEnrolled">
              <NuxtLink v-if="nextLessonSlug" :to="`/learn/${slug}/${nextLessonSlug}`" class="cpub-continue-btn">
                <i class="fa-solid fa-play"></i> Continue Learning
              </NuxtLink>
              <button class="cpub-unenroll-btn" :disabled="unenrolling" @click="handleUnenroll">
                {{ unenrolling ? 'Unenrolling...' : 'Unenroll' }}
              </button>
            </template>
            <NuxtLink v-if="isOwner" :to="`/learn/${slug}/edit`" class="cpub-edit-link">
              <i class="fa-solid fa-pen"></i> Edit Path
            </NuxtLink>
          </div>

          <!-- Enrollment Progress -->
          <div v-if="path.isEnrolled && path.enrollment?.progress != null" class="cpub-enrollment-progress">
            <div class="cpub-enrollment-progress-header">
              <span class="cpub-enrollment-progress-label">Your Progress</span>
              <span class="cpub-enrollment-progress-pct">{{ Math.round(parseFloat(path.enrollment.progress)) }}%</span>
            </div>
            <div class="cpub-enrollment-progress-bar">
              <div class="cpub-enrollment-progress-fill" :style="{ width: path.enrollment.progress + '%' }"></div>
            </div>
          </div>
        </header>

        <!-- Curriculum -->
        <section class="cpub-curriculum">
          <div class="cpub-curriculum-header">
            <h2 class="cpub-curriculum-title">Curriculum</h2>
            <span class="cpub-curriculum-count">{{ path.modules?.length ?? 0 }} modules &middot; {{ totalLessons }} lessons</span>
          </div>

          <template v-if="path.modules?.length">
            <div v-for="(mod, mi) in path.modules" :key="mod.id" class="cpub-module">
              <button class="cpub-module-header" @click="toggleModule(mod.id)" :aria-expanded="expandedModules.has(mod.id)">
                <span class="cpub-module-number">{{ mi + 1 }}</span>
                <div class="cpub-module-info">
                  <span class="cpub-module-title">{{ mod.title }}</span>
                  <span v-if="mod.description" class="cpub-module-desc">{{ mod.description }}</span>
                  <span class="cpub-module-meta">{{ mod.lessons?.length ?? 0 }} lessons</span>
                </div>
                <span class="cpub-module-chevron"><i :class="expandedModules.has(mod.id) ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right'"></i></span>
              </button>
              <div v-if="expandedModules.has(mod.id)" class="cpub-module-body">
                <ul class="cpub-lesson-list" v-if="mod.lessons?.length">
                  <li v-for="lesson in mod.lessons" :key="lesson.id" class="cpub-lesson-item">
                    <span class="cpub-lesson-type-icon" :data-lesson-type="lesson.type">
                      <i :class="getLessonTypeIcon(lesson.type)"></i>
                    </span>
                    <NuxtLink :to="`/learn/${slug}/${lesson.slug}`" class="cpub-lesson-link">
                      {{ lesson.title }}
                    </NuxtLink>
                    <span v-if="lesson.duration" class="cpub-lesson-duration">{{ lesson.duration }} min</span>
                  </li>
                </ul>
                <p v-else class="cpub-module-empty">No lessons in this module yet.</p>
              </div>
            </div>
          </template>
          <p class="cpub-empty" v-else>No modules added yet.</p>
        </section>
      </main>

      <!-- SIDEBAR -->
      <aside class="cpub-path-sidebar">
        <!-- Overview Card -->
        <div class="cpub-sidebar-card">
          <h3 class="cpub-sidebar-label">Overview</h3>
          <div class="cpub-sidebar-stat" v-if="path.estimatedHours">
            <span class="cpub-sidebar-stat-label">Duration</span>
            <span>{{ path.estimatedHours }} hours</span>
          </div>
          <div class="cpub-sidebar-stat">
            <span class="cpub-sidebar-stat-label">Modules</span>
            <span>{{ path.moduleCount || path.modules?.length || 0 }}</span>
          </div>
          <div class="cpub-sidebar-stat">
            <span class="cpub-sidebar-stat-label">Lessons</span>
            <span>{{ totalLessons }}</span>
          </div>
          <div class="cpub-sidebar-stat">
            <span class="cpub-sidebar-stat-label">Enrolled</span>
            <span>{{ path.enrollmentCount ?? 0 }}</span>
          </div>
          <div class="cpub-sidebar-stat">
            <span class="cpub-sidebar-stat-label">Completed</span>
            <span>{{ path.completionCount ?? 0 }}</span>
          </div>
          <div class="cpub-sidebar-stat" v-if="path.difficulty">
            <span class="cpub-sidebar-stat-label">Difficulty</span>
            <span class="cpub-sidebar-stat-difficulty" :class="getDifficultyClass(path.difficulty)">{{ path.difficulty }}</span>
          </div>
        </div>

        <!-- Author Card -->
        <div v-if="path.author" class="cpub-sidebar-card">
          <h3 class="cpub-sidebar-label">Author</h3>
          <NuxtLink :to="`/u/${path.author.username}`" class="cpub-author-link">
            <div class="cpub-author-avatar">{{ (path.author.displayName || path.author.username || 'A').charAt(0).toUpperCase() }}</div>
            <div>
              <div class="cpub-author-name">{{ path.author.displayName || path.author.username }}</div>
              <div class="cpub-author-handle">@{{ path.author.username }}</div>
            </div>
          </NuxtLink>
        </div>
      </aside>
    </div>
  </div>
  <div v-else class="cpub-not-found"><h1>Learning path not found</h1></div>
</template>

<style scoped>
.cpub-path { max-width: 100%; }
.cpub-path-layout { display: grid; grid-template-columns: 1fr 280px; gap: 32px; max-width: 1080px; margin: 0 auto; padding: 32px; }

/* Header */
.cpub-path-header { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid var(--border); }
.cpub-back-link { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px; }
.cpub-back-link:hover { color: var(--accent); }
.cpub-path-header-row { display: flex; gap: 16px; }
.cpub-path-header-info { flex: 1; }
.cpub-path-difficulty { font-family: var(--font-mono); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; padding: 2px 8px; border: 2px solid; display: inline-block; margin-bottom: 8px; }
.diff-beginner { color: var(--green); border-color: var(--green-border); background: var(--green-bg); }
.diff-intermediate { color: var(--yellow); border-color: var(--yellow-border); background: var(--yellow-bg); }
.diff-advanced { color: var(--red); border-color: var(--red-border); background: var(--red-bg); }
.cpub-path-draft { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; padding: 2px 8px; background: var(--surface3); color: var(--text-faint); border: 2px solid var(--border2); display: inline-block; margin-left: 8px; margin-bottom: 8px; }
.cpub-path-title { font-size: 26px; font-weight: 700; margin-bottom: 8px; line-height: 1.2; letter-spacing: -0.02em; }
.cpub-path-desc { font-size: 14px; color: var(--text-dim); line-height: 1.6; margin-bottom: 12px; }

/* Actions */
.cpub-path-actions { display: flex; gap: 10px; margin-top: 16px; align-items: center; flex-wrap: wrap; }
.cpub-enroll-btn { padding: 10px 22px; background: var(--accent); color: var(--color-text-inverse); border: 2px solid var(--border); font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: var(--shadow-md); display: inline-flex; align-items: center; gap: 6px; }
.cpub-enroll-btn:hover { box-shadow: var(--shadow-sm); transform: translate(1px, 1px); }
.cpub-enroll-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cpub-continue-btn { padding: 10px 22px; background: var(--green); color: var(--color-text-inverse); border: 2px solid var(--border); font-size: 13px; font-weight: 600; text-decoration: none; box-shadow: var(--shadow-md); display: inline-flex; align-items: center; gap: 6px; }
.cpub-continue-btn:hover { box-shadow: var(--shadow-sm); transform: translate(1px, 1px); }
.cpub-unenroll-btn { padding: 6px 14px; background: var(--surface); border: 2px solid var(--border); color: var(--text-dim); font-size: 12px; cursor: pointer; }
.cpub-unenroll-btn:hover { color: var(--red); border-color: var(--red); }
.cpub-edit-link { padding: 6px 14px; border: 2px solid var(--border2); font-size: 12px; color: var(--text-dim); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
.cpub-edit-link:hover { color: var(--accent); border-color: var(--accent); }

/* Enrollment Progress */
.cpub-enrollment-progress { margin-top: 16px; padding: 12px 16px; border: 2px solid var(--accent-border); background: var(--accent-bg); }
.cpub-enrollment-progress-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
.cpub-enrollment-progress-label { font-size: 11px; font-family: var(--font-mono); color: var(--accent); text-transform: uppercase; letter-spacing: 0.06em; }
.cpub-enrollment-progress-pct { font-size: 13px; font-weight: 700; font-family: var(--font-mono); color: var(--accent); }
.cpub-enrollment-progress-bar { height: 6px; background: var(--surface); border: 2px solid var(--accent-border); }
.cpub-enrollment-progress-fill { height: 100%; background: var(--accent); transition: width 0.3s; }

/* Curriculum */
.cpub-curriculum { }
.cpub-curriculum-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.cpub-curriculum-title { font-size: 18px; font-weight: 700; }
.cpub-curriculum-count { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); }
.cpub-module { border: 2px solid var(--border); margin-bottom: 12px; background: var(--surface); box-shadow: var(--shadow-md); }
.cpub-module-header { display: flex; align-items: flex-start; gap: 12px; width: 100%; padding: 14px 16px; border: none; background: none; cursor: pointer; text-align: left; font-family: inherit; }
.cpub-module-header:hover { background: var(--surface2); }
.cpub-module-number { font-family: var(--font-mono); font-size: 12px; color: var(--accent); font-weight: 700; min-width: 20px; padding-top: 2px; }
.cpub-module-info { flex: 1; }
.cpub-module-title { font-weight: 600; font-size: 14px; display: block; margin-bottom: 2px; }
.cpub-module-desc { font-size: 12px; color: var(--text-dim); display: block; margin-bottom: 4px; }
.cpub-module-meta { font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-module-chevron { color: var(--text-dim); font-size: 12px; padding-top: 3px; }
.cpub-module-body { border-top: 2px solid var(--border); }
.cpub-module-empty { font-size: 12px; color: var(--text-faint); padding: 12px 16px; }
.cpub-lesson-list { list-style: none; padding: 0; margin: 0; }
.cpub-lesson-item { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-top: 2px solid var(--border2); }
.cpub-lesson-item:first-child { border-top: none; }
.cpub-lesson-type-icon { font-size: 11px; width: 20px; text-align: center; color: var(--text-faint); }
.cpub-lesson-link { flex: 1; color: var(--text); text-decoration: none; font-size: 13px; }
.cpub-lesson-link:hover { color: var(--accent); }
.cpub-lesson-duration { font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); }

/* Sidebar */
.cpub-path-sidebar { display: flex; flex-direction: column; gap: 16px; }
.cpub-sidebar-card { padding: 16px; border: 2px solid var(--border); background: var(--surface); box-shadow: var(--shadow-md); }
.cpub-sidebar-label { font-family: var(--font-mono); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--text-faint); margin-bottom: 12px; display: block; }
.cpub-sidebar-stat { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 2px solid var(--border2); font-size: 13px; }
.cpub-sidebar-stat:last-child { border-bottom: none; }
.cpub-sidebar-stat-label { color: var(--text-dim); }
.cpub-sidebar-stat-difficulty { font-family: var(--font-mono); font-size: 11px; text-transform: capitalize; }

.cpub-author-link { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--text); }
.cpub-author-link:hover .cpub-author-name { color: var(--accent); }
.cpub-author-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--surface3); border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: var(--accent); font-family: var(--font-mono); }
.cpub-author-name { font-size: 13px; font-weight: 600; }
.cpub-author-handle { font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); }

.cpub-empty { color: var(--text-faint); text-align: center; padding: 32px 0; font-size: 13px; }
.cpub-not-found { text-align: center; padding: 64px 0; color: var(--text-dim); }

@media (max-width: 768px) {
  .cpub-path-layout { grid-template-columns: 1fr; padding: 16px; }
}
</style>
