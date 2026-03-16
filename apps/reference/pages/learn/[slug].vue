<script setup lang="ts">
const route = useRoute();
const slug = computed(() => route.params.slug as string);

const { data: path } = await useFetch(() => `/api/learn/${slug.value}`);

useSeoMeta({
  title: () => path.value ? `${path.value.title} — Learn — CommonPub` : 'Learn — CommonPub',
  description: () => path.value?.description || '',
});

const { isAuthenticated, user } = useAuth();
const isOwner = computed(() => user.value?.id === path.value?.author?.id);
const enrolling = ref(false);

async function handleEnroll(): Promise<void> {
  enrolling.value = true;
  try {
    await $fetch(`/api/learn/${slug.value}/enroll`, { method: 'POST' });
    refreshNuxtData();
  } catch { /* silent */ } finally {
    enrolling.value = false;
  }
}

const expandedModules = ref<Set<string>>(new Set());
function toggleModule(id: string): void {
  if (expandedModules.value.has(id)) {
    expandedModules.value.delete(id);
  } else {
    expandedModules.value.add(id);
  }
}
</script>

<template>
  <div class="cpub-course" v-if="path">
    <div class="cpub-course-layout">
      <main class="cpub-course-main">
        <!-- Header -->
        <header class="cpub-course-header">
          <span v-if="path.difficulty" class="cpub-course-difficulty" :data-difficulty="path.difficulty">{{ path.difficulty }}</span>
          <h1 class="cpub-course-title">{{ path.title }}</h1>
          <p class="cpub-course-desc" v-if="path.description">{{ path.description }}</p>
          <AuthorRow
            v-if="path.author"
            :author="path.author"
            :date="path.createdAt"
          />
          <div class="cpub-course-actions">
            <button
              v-if="isAuthenticated && !path.isEnrolled"
              class="cpub-enroll-btn"
              :disabled="enrolling"
              @click="handleEnroll"
            >{{ enrolling ? 'Enrolling...' : 'Enroll' }}</button>
            <span v-if="path.isEnrolled" class="cpub-enrolled-badge">Enrolled</span>
            <NuxtLink v-if="isOwner" :to="`/learn/${slug}/edit`" class="cpub-edit-link">Edit</NuxtLink>
          </div>
        </header>

        <!-- Curriculum -->
        <section class="cpub-curriculum">
          <h2 class="cpub-curriculum-title">Curriculum</h2>
          <template v-if="path.modules?.length">
            <div v-for="(mod, mi) in path.modules" :key="mod.id" class="cpub-module">
              <button class="cpub-module-header" @click="toggleModule(mod.id)" :aria-expanded="expandedModules.has(mod.id)">
                <span class="cpub-module-number">{{ mi + 1 }}</span>
                <div class="cpub-module-info">
                  <span class="cpub-module-title">{{ mod.title }}</span>
                  <span class="cpub-module-meta" v-if="mod.lessons?.length">{{ mod.lessons.length }} lessons</span>
                </div>
                <span class="cpub-module-chevron"><i :class="expandedModules.has(mod.id) ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right'"></i></span>
              </button>
              <div v-if="expandedModules.has(mod.id)" class="cpub-module-body">
                <p v-if="mod.description" class="cpub-module-desc">{{ mod.description }}</p>
                <ul class="cpub-lesson-list" v-if="mod.lessons?.length">
                  <li v-for="lesson in mod.lessons" :key="lesson.id" class="cpub-lesson-item">
                    <span class="cpub-lesson-type-icon" :data-lesson-type="lesson.type">
                      <i :class="lesson.type === 'video' ? 'fa-solid fa-play' : lesson.type === 'quiz' ? 'fa-solid fa-circle-question' : lesson.type === 'project' ? 'fa-solid fa-microchip' : 'fa-solid fa-file-lines'"></i>
                    </span>
                    <NuxtLink :to="`/learn/${slug}/${lesson.slug}`" class="cpub-lesson-link">
                      {{ lesson.title }}
                    </NuxtLink>
                    <span v-if="lesson.duration" class="cpub-lesson-duration">{{ lesson.duration }}min</span>
                  </li>
                </ul>
              </div>
            </div>
          </template>
          <p class="cpub-empty" v-else>No modules added yet.</p>
        </section>
      </main>

      <!-- Sidebar -->
      <aside class="cpub-course-sidebar">
        <div class="cpub-sidebar-card">
          <h3 class="cpub-sidebar-label">Overview</h3>
          <div class="cpub-sidebar-stat" v-if="path.estimatedHours">
            <span class="cpub-sidebar-stat-label">Duration</span>
            <span>{{ path.estimatedHours }} hours</span>
          </div>
          <div class="cpub-sidebar-stat" v-if="path.moduleCount || path.modules?.length">
            <span class="cpub-sidebar-stat-label">Modules</span>
            <span>{{ path.moduleCount || path.modules?.length || 0 }}</span>
          </div>
          <div class="cpub-sidebar-stat">
            <span class="cpub-sidebar-stat-label">Enrolled</span>
            <span>{{ path.enrollmentCount ?? 0 }}</span>
          </div>
          <div class="cpub-sidebar-stat">
            <span class="cpub-sidebar-stat-label">Completed</span>
            <span>{{ path.completionCount ?? 0 }}</span>
          </div>
        </div>
      </aside>
    </div>
  </div>
  <div v-else class="cpub-not-found"><h1>Learning path not found</h1></div>
</template>

<style scoped>
.cpub-course { max-width: 100%; }
.cpub-course-layout { display: grid; grid-template-columns: 1fr 280px; gap: var(--space-6); max-width: var(--content-max-width); margin: 0 auto; padding: var(--space-6); }
.cpub-course-header { margin-bottom: var(--space-6); padding-bottom: var(--space-6); border-bottom: var(--border-width-default) solid var(--border2); }
.cpub-course-difficulty { font-family: var(--font-mono); font-size: 10px; font-weight: var(--font-weight-semibold); text-transform: uppercase; letter-spacing: var(--tracking-wide); padding: 2px 8px; border: 1px solid var(--accent-border); color: var(--accent); background: var(--accent-bg); }
[data-difficulty="beginner"] { color: var(--green); border-color: var(--green-border); background: var(--green-bg); }
[data-difficulty="intermediate"] { color: var(--yellow); border-color: var(--yellow-border); background: var(--yellow-bg); }
[data-difficulty="advanced"] { color: var(--red); border-color: var(--red-border); background: var(--red-bg); }
.cpub-course-title { font-size: var(--text-2xl); font-weight: var(--font-weight-bold); margin: var(--space-3) 0 var(--space-2); line-height: var(--leading-tight); }
.cpub-course-desc { font-size: var(--text-sm); color: var(--text-dim); line-height: var(--leading-relaxed); margin-bottom: var(--space-4); }
.cpub-course-actions { display: flex; gap: var(--space-3); margin-top: var(--space-4); align-items: center; }
.cpub-enroll-btn { padding: var(--space-2) var(--space-5); background: var(--accent); color: var(--color-text-inverse); border: var(--border-width-default) solid var(--border); font-size: var(--text-sm); cursor: pointer; font-family: var(--font-sans); box-shadow: var(--shadow-md); }
.cpub-enroll-btn:hover { background: var(--color-primary-hover); }
.cpub-enroll-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cpub-enrolled-badge { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; color: var(--green); background: var(--green-bg); padding: var(--space-1) var(--space-3); border: 1px solid var(--green-border); }
.cpub-edit-link { font-size: var(--text-sm); color: var(--text-dim); text-decoration: none; border: 1px solid var(--border2); padding: var(--space-1) var(--space-3); }
.cpub-curriculum-title { font-size: var(--text-lg); font-weight: var(--font-weight-bold); margin-bottom: var(--space-4); }
.cpub-module { border: var(--border-width-default) solid var(--border); margin-bottom: var(--space-3); background: var(--surface); }
.cpub-module-header { display: flex; align-items: center; gap: var(--space-3); width: 100%; padding: var(--space-3) var(--space-4); border: none; background: none; cursor: pointer; text-align: left; font-family: var(--font-sans); }
.cpub-module-header:hover { background: var(--surface2); }
.cpub-module-number { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--accent); font-weight: var(--font-weight-bold); min-width: 20px; }
.cpub-module-info { flex: 1; }
.cpub-module-title { font-weight: var(--font-weight-semibold); font-size: var(--text-sm); display: block; }
.cpub-module-meta { font-size: var(--text-xs); color: var(--text-faint); }
.cpub-module-chevron { color: var(--text-dim); font-size: var(--text-md); }
.cpub-module-body { padding: 0 var(--space-4) var(--space-4); border-top: 1px solid var(--border2); }
.cpub-module-desc { font-size: var(--text-sm); color: var(--text-dim); padding: var(--space-3) 0; }
.cpub-lesson-list { list-style: none; padding: 0; margin: 0; }
.cpub-lesson-item { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) 0; border-top: 1px solid var(--border2); }
.cpub-lesson-type-icon { font-size: var(--text-xs); width: 20px; text-align: center; }
.cpub-lesson-link { flex: 1; color: var(--text); text-decoration: none; font-size: var(--text-sm); }
.cpub-lesson-link:hover { color: var(--accent); }
.cpub-lesson-duration { font-size: var(--text-xs); color: var(--text-faint); font-family: var(--font-mono); }
.cpub-course-sidebar {}
.cpub-sidebar-card { padding: var(--space-4); border: var(--border-width-default) solid var(--border); background: var(--surface); }
.cpub-sidebar-label { font-family: var(--font-mono); font-size: var(--text-label); font-weight: var(--font-weight-semibold); text-transform: uppercase; letter-spacing: var(--tracking-widest); color: var(--text-faint); margin-bottom: var(--space-3); display: block; }
.cpub-sidebar-stat { display: flex; justify-content: space-between; padding: var(--space-2) 0; border-bottom: 1px solid var(--border2); font-size: var(--text-sm); }
.cpub-sidebar-stat:last-child { border-bottom: none; }
.cpub-sidebar-stat-label { color: var(--text-dim); }
.cpub-empty { color: var(--text-faint); text-align: center; padding: var(--space-8) 0; font-size: var(--text-sm); }
.cpub-not-found { text-align: center; padding: var(--space-10) 0; color: var(--text-dim); }
</style>
