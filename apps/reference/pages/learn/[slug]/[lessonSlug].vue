<script setup lang="ts">
const route = useRoute();
const slug = computed(() => route.params.slug as string);
const lessonSlug = computed(() => route.params.lessonSlug as string);

const { data: lesson } = await useFetch(() => `/api/learn/${slug.value}/${lessonSlug.value}`);

useSeoMeta({
  title: () => lesson.value ? `${lesson.value.title} — CommonPub` : 'Lesson — CommonPub',
});

const { isAuthenticated } = useAuth();
const completing = ref(false);

async function markComplete(): Promise<void> {
  completing.value = true;
  try {
    await $fetch(`/api/learn/${slug.value}/${lessonSlug.value}/complete`, { method: 'POST' });
  } catch {
    // silent
  } finally {
    completing.value = false;
  }
}
</script>

<template>
  <div class="lesson-page" v-if="lesson">
    <NuxtLink :to="`/learn/${slug}`" class="cpub-back-link">Back to path</NuxtLink>

    <header class="lesson-header">
      <span class="lesson-type">{{ lesson.type }}</span>
      <h1 class="lesson-title">{{ lesson.title }}</h1>
      <span v-if="lesson.duration" class="lesson-duration">{{ lesson.duration }} min</span>
    </header>

    <div class="lesson-content">
      <p class="lesson-placeholder">Lesson content rendering coming soon.</p>
    </div>

    <footer class="lesson-footer" v-if="isAuthenticated">
      <button class="cpub-btn-primary" @click="markComplete" :disabled="completing">
        {{ completing ? 'Marking...' : 'Mark as Complete' }}
      </button>
    </footer>
  </div>
  <div v-else class="not-found"><h1>Lesson not found</h1></div>
</template>

<style scoped>
.lesson-page { max-width: var(--content-max-width); }
.cpub-back-link { color: var(--accent); text-decoration: none; font-size: var(--text-sm); display: inline-block; margin-bottom: var(--space-4); }
.cpub-back-link:hover { text-decoration: underline; }
.lesson-header { margin-bottom: var(--space-6); }
.lesson-type { font-size: var(--text-xs); color: var(--accent); text-transform: capitalize; font-weight: var(--font-weight-medium); }
.lesson-title { font-size: var(--text-2xl); font-weight: var(--font-weight-bold); margin: var(--space-2) 0; }
.lesson-duration { font-size: var(--text-sm); color: var(--text-faint); }
.lesson-content { min-height: 200px; }
.lesson-placeholder { color: var(--text-faint); font-size: var(--text-sm); text-align: center; padding: var(--space-10) 0; }
.lesson-footer { margin-top: var(--space-6); padding-top: var(--space-4); border-top: 1px solid var(--border); }
.cpub-btn-primary { padding: var(--space-2) var(--space-4); background: var(--accent); color: var(--color-on-primary); border: 1px solid var(--border); font-size: var(--text-sm); font-weight: var(--font-weight-medium); font-family: var(--font-sans); cursor: pointer; }
.cpub-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.cpub-btn-primary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.not-found { text-align: center; padding: var(--space-10) 0; color: var(--text-dim); }
</style>
