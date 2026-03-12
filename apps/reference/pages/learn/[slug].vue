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
</script>

<template>
  <div class="path-page" v-if="path">
    <header class="path-header">
      <h1 class="path-title">{{ path.title }}</h1>
      <p class="path-desc" v-if="path.description">{{ path.description }}</p>
      <div class="path-meta">
        <span v-if="path.difficulty" class="path-difficulty">{{ path.difficulty }}</span>
        <span v-if="path.estimatedHours">{{ path.estimatedHours }} hours</span>
        <span>{{ path.enrollmentCount }} enrolled</span>
        <span>{{ path.completionCount }} completed</span>
      </div>
      <div class="path-actions">
        <NuxtLink v-if="isOwner" :to="`/learn/${slug}/edit`" class="cpub-link">Edit</NuxtLink>
      </div>
    </header>

    <section class="path-curriculum">
      <h2 class="section-heading">Curriculum</h2>
      <template v-if="path.modules?.length">
        <div class="module-card" v-for="mod in path.modules" :key="mod.id">
          <h3 class="module-title">{{ mod.title }}</h3>
          <p class="module-desc" v-if="mod.description">{{ mod.description }}</p>
          <ul class="lesson-list" v-if="mod.lessons?.length">
            <li v-for="lesson in mod.lessons" :key="lesson.id" class="lesson-item">
              <NuxtLink :to="`/learn/${slug}/${lesson.slug}`" class="lesson-link">
                <span class="lesson-type">{{ lesson.type }}</span>
                {{ lesson.title }}
              </NuxtLink>
              <span v-if="lesson.duration" class="lesson-duration">{{ lesson.duration }}min</span>
            </li>
          </ul>
        </div>
      </template>
      <p class="curriculum-empty" v-else>No modules added yet.</p>
    </section>
  </div>
  <div v-else class="not-found"><h1>Learning path not found</h1></div>
</template>

<style scoped>
.path-page { max-width: var(--content-max-width); }
.path-header { margin-bottom: var(--space-6); padding-bottom: var(--space-4); border-bottom: 1px solid var(--border); }
.path-title { font-size: var(--text-2xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-2); }
.path-desc { font-size: var(--text-sm); color: var(--text-dim); line-height: var(--leading-relaxed); margin-bottom: var(--space-3); }
.path-meta { display: flex; gap: var(--space-4); font-size: var(--text-xs); color: var(--text-faint); margin-bottom: var(--space-3); }
.path-difficulty { text-transform: capitalize; color: var(--accent); }
.path-actions { display: flex; gap: var(--space-3); }
.cpub-link { color: var(--accent); text-decoration: none; font-size: var(--text-sm); }
.cpub-link:hover { text-decoration: underline; }
.section-heading { font-size: var(--text-lg); font-weight: var(--font-weight-semibold); margin-bottom: var(--space-4); }
.module-card { border: 1px solid var(--border); background: var(--surface); padding: var(--space-4); margin-bottom: var(--space-4); }
.module-title { font-size: var(--text-md); font-weight: var(--font-weight-semibold); margin-bottom: var(--space-2); }
.module-desc { font-size: var(--text-sm); color: var(--text-dim); margin-bottom: var(--space-3); }
.lesson-list { list-style: none; padding: 0; margin: 0; }
.lesson-item { display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) 0; border-top: 1px solid var(--border); }
.lesson-link { color: var(--text); text-decoration: none; font-size: var(--text-sm); }
.lesson-link:hover { color: var(--accent); }
.lesson-type { font-size: var(--text-xs); color: var(--accent); text-transform: capitalize; margin-right: var(--space-2); }
.lesson-duration { font-size: var(--text-xs); color: var(--text-faint); }
.curriculum-empty { color: var(--text-faint); text-align: center; padding: var(--space-6) 0; }
.not-found { text-align: center; padding: var(--space-10) 0; color: var(--text-dim); }
</style>
