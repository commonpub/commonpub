<script setup lang="ts">
import type { Serialized, LearningPathDetail } from '@commonpub/server';

interface LessonResponse {
  lesson: {
    id: string;
    slug: string;
    title: string;
    type: string;
    content: unknown;
    duration: number | null;
    contentItemId: string | null;
  };
  module: { id: string; title: string };
  pathId: string;
  linkedContent?: { id: string; title: string; slug: string; type: string; content: unknown };
  renderedHtml: string;
}

const route = useRoute();
const slug = computed(() => route.params.slug as string);
const lessonSlug = computed(() => route.params.lessonSlug as string);

const { data: lessonData, pending: lessonPending, error: lessonError, refresh: refreshLesson } = useLazyFetch<LessonResponse>(() => `/api/learn/${slug.value}/${lessonSlug.value}`);
const { data: path } = useLazyFetch<Serialized<LearningPathDetail>>(() => `/api/learn/${slug.value}`);

const lesson = computed(() => lessonData.value?.lesson);
const lessonModule = computed(() => lessonData.value?.module);

useSeoMeta({
  title: () => lesson.value ? `${lesson.value.title} — ${useSiteName()}` : `Lesson — ${useSiteName()}`,
});

const { isAuthenticated, user } = useAuth();
const toast = useToast();
const completing = ref(false);
const completed = ref(false);

async function markComplete(): Promise<void> {
  completing.value = true;
  try {
    await $fetch(`/api/learn/${slug.value}/${lessonSlug.value}/complete`, { method: 'POST' });
    completed.value = true;
    toast.success('Lesson completed!');
  } catch {
    toast.error('Failed to mark as complete');
  } finally {
    completing.value = false;
  }
}

// Build flat lesson list for prev/next navigation
interface FlatLesson {
  slug: string;
  title: string;
  type: string;
  moduleTitle: string;
}

const flatLessons = computed<FlatLesson[]>(() => {
  if (!path.value?.modules) return [];
  const result: FlatLesson[] = [];
  for (const mod of path.value.modules) {
    for (const l of (mod.lessons ?? [])) {
      result.push({ slug: l.slug, title: l.title, type: l.type, moduleTitle: mod.title });
    }
  }
  return result;
});

const currentIndex = computed(() => flatLessons.value.findIndex(l => l.slug === lessonSlug.value));
const prevLesson = computed(() => currentIndex.value > 0 ? flatLessons.value[currentIndex.value - 1] : null);
const nextLesson = computed(() => currentIndex.value < flatLessons.value.length - 1 ? flatLessons.value[currentIndex.value + 1] : null);
const totalLessons = computed(() => flatLessons.value.length);
const progressPct = computed(() => totalLessons.value > 0 ? Math.round(((currentIndex.value + 1) / totalLessons.value) * 100) : 0);

// Use server-rendered HTML from the API response
const renderedHtml = computed(() => lessonData.value?.renderedHtml ?? '');

// Video URL
const videoUrl = computed(() => {
  const content = lesson.value?.content as Record<string, unknown> | null;
  if (!content) return '';
  const url = (content.videoUrl as string) ?? '';
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return url;
});

// Quiz data
interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const quizQuestions = computed<QuizQuestion[]>(() => {
  const content = lesson.value?.content as Record<string, unknown> | null;
  if (!content || !Array.isArray(content.questions)) return [];
  return content.questions as QuizQuestion[];
});

const quizAnswers = ref<Record<number, number>>({});
const quizSubmitted = ref<Record<number, boolean>>({});

function submitQuizAnswer(qIndex: number, optionIndex: number): void {
  if (quizSubmitted.value[qIndex]) return;
  quizAnswers.value[qIndex] = optionIndex;
  quizSubmitted.value[qIndex] = true;
}

function isQuizComplete(): boolean {
  return quizQuestions.value.length > 0 && quizQuestions.value.every((_, i) => quizSubmitted.value[i]);
}

const quizScore = computed(() => {
  if (!isQuizComplete()) return null;
  let correct = 0;
  for (let i = 0; i < quizQuestions.value.length; i++) {
    if (quizAnswers.value[i] === quizQuestions.value[i]!.correctIndex) correct++;
  }
  return { correct, total: quizQuestions.value.length };
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

// Sidebar collapsed on mobile
const sidebarOpen = ref(false);

// Is path owner
const isOwner = computed(() => user.value?.id === path.value?.author?.id);
</script>

<template>
  <div v-if="lessonPending" class="cpub-loading">Loading lesson...</div>
  <div v-else-if="lessonError" class="cpub-fetch-error">
    <div class="cpub-fetch-error-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
    <div class="cpub-fetch-error-msg">Failed to load lesson.</div>
    <button class="cpub-btn cpub-btn-sm" @click="refreshLesson()">Retry</button>
  </div>
  <div class="lesson-page" v-else-if="lesson">
    <!-- Progress bar at top -->
    <div class="lesson-progress-bar">
      <div class="lesson-progress-fill" :style="{ width: progressPct + '%' }"></div>
    </div>

    <div class="lesson-layout">
      <!-- SIDEBAR: Curriculum -->
      <aside class="lesson-sidebar" :class="{ open: sidebarOpen }">
        <div class="lesson-sidebar-header">
          <NuxtLink :to="`/learn/${slug}`" class="lesson-sidebar-title">
            <i class="fa-solid fa-graduation-cap"></i>
            {{ path?.title ?? 'Learning Path' }}
          </NuxtLink>
        </div>

        <div class="lesson-sidebar-progress">
          <span class="lesson-sidebar-progress-text">{{ currentIndex + 1 }} / {{ totalLessons }} lessons</span>
          <div class="lesson-sidebar-progress-bar">
            <div class="lesson-sidebar-progress-fill" :style="{ width: progressPct + '%' }"></div>
          </div>
        </div>

        <nav class="lesson-curriculum">
          <template v-for="mod in (path?.modules ?? [])" :key="mod.id">
            <div class="lesson-mod-title">{{ mod.title }}</div>
            <NuxtLink
              v-for="l in (mod.lessons ?? [])"
              :key="l.id"
              :to="`/learn/${slug}/${l.slug}`"
              class="lesson-nav-item"
              :class="{ active: l.slug === lessonSlug }"
              @click="sidebarOpen = false"
            >
              <span class="lesson-nav-icon">
                <i :class="getLessonTypeIcon(l.type)"></i>
              </span>
              <span class="lesson-nav-text">{{ l.title }}</span>
              <span v-if="l.duration" class="lesson-nav-duration">{{ l.duration }}m</span>
            </NuxtLink>
          </template>
        </nav>
      </aside>

      <!-- MAIN CONTENT -->
      <main class="lesson-main">
        <!-- Mobile sidebar toggle -->
        <button class="lesson-mobile-toggle" @click="sidebarOpen = !sidebarOpen">
          <i class="fa-solid fa-bars"></i> Curriculum
        </button>

        <!-- Lesson header -->
        <header class="lesson-header">
          <div class="lesson-meta-row">
            <span class="lesson-type-badge" :data-type="lesson.type">
              <i :class="getLessonTypeIcon(lesson.type)"></i> {{ lesson.type }}
            </span>
            <span v-if="lessonModule" class="lesson-module-name">{{ lessonModule.title }}</span>
            <span v-if="lesson.duration" class="lesson-duration"><i class="fa-regular fa-clock"></i> {{ lesson.duration }} min</span>
          </div>
          <h1 class="lesson-title">{{ lesson.title }}</h1>
          <NuxtLink v-if="isOwner" :to="`/learn/${slug}/${lessonSlug}/edit`" class="lesson-edit-link">
            <i class="fa-solid fa-pen"></i> Edit
          </NuxtLink>
        </header>

        <!-- VIDEO lesson -->
        <div v-if="lesson.type === 'video' && videoUrl" class="lesson-video">
          <iframe :src="videoUrl" frameborder="0" allowfullscreen class="lesson-video-iframe" />
        </div>

        <!-- ARTICLE / TEXT content -->
        <div v-if="renderedHtml" class="lesson-content cpub-prose" v-html="renderedHtml" />

        <!-- View original link for linked content -->
        <div v-if="lessonData?.linkedContent" class="lesson-linked-source">
          <NuxtLink :to="`/u/${(lessonData.linkedContent as any).author?.username ?? ''}/${lessonData.linkedContent.type}/${lessonData.linkedContent.slug}`" class="lesson-linked-source-link">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> View original {{ lessonData.linkedContent.type }}
          </NuxtLink>
        </div>

        <!-- QUIZ lesson -->
        <div v-if="lesson.type === 'quiz' && quizQuestions.length" class="lesson-quiz">
          <div v-for="(q, qi) in quizQuestions" :key="qi" class="quiz-card">
            <div class="quiz-header">
              <span class="quiz-badge">QUESTION {{ qi + 1 }}</span>
            </div>
            <div class="quiz-question">{{ q.question }}</div>
            <div class="quiz-options">
              <button
                v-for="(opt, oi) in q.options"
                :key="oi"
                class="quiz-option"
                :class="{
                  'selected-correct': quizSubmitted[qi] && oi === q.correctIndex,
                  'selected-wrong': quizSubmitted[qi] && quizAnswers[qi] === oi && oi !== q.correctIndex,
                  answered: quizSubmitted[qi],
                }"
                :disabled="!!quizSubmitted[qi]"
                @click="submitQuizAnswer(qi, oi)"
              >
                <span class="quiz-option-key">{{ String.fromCharCode(65 + oi) }}</span>
                <span class="quiz-option-text">{{ opt }}</span>
                <span v-if="quizSubmitted[qi] && oi === q.correctIndex" class="quiz-option-indicator"><i class="fa-solid fa-check"></i></span>
                <span v-if="quizSubmitted[qi] && quizAnswers[qi] === oi && oi !== q.correctIndex" class="quiz-option-indicator"><i class="fa-solid fa-xmark"></i></span>
              </button>
            </div>
            <div v-if="quizSubmitted[qi] && q.explanation" class="quiz-explanation">
              <i class="fa-solid fa-lightbulb"></i> {{ q.explanation }}
            </div>
          </div>

          <div v-if="quizScore" class="quiz-score">
            <div class="quiz-score-value">{{ quizScore.correct }} / {{ quizScore.total }}</div>
            <div class="quiz-score-label">correct answers</div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="!renderedHtml && !videoUrl && !quizQuestions.length" class="lesson-empty">
          <i class="fa-solid fa-book-open" style="font-size: 24px; color: var(--text-faint);"></i>
          <p>This lesson has no content yet.</p>
          <NuxtLink v-if="isOwner" :to="`/learn/${slug}/${lessonSlug}/edit`" class="cpub-btn cpub-btn-primary" style="margin-top: 8px;">
            Add Content
          </NuxtLink>
        </div>

        <!-- Footer: Mark Complete + Prev/Next -->
        <footer class="lesson-footer">
          <div v-if="isAuthenticated" class="lesson-complete-row">
            <button v-if="!completed" class="lesson-complete-btn" @click="markComplete" :disabled="completing">
              <i class="fa-solid fa-check-circle"></i> {{ completing ? 'Marking...' : 'Mark as Complete' }}
            </button>
            <div v-else class="lesson-completed-badge">
              <i class="fa-solid fa-check-circle"></i> Completed
            </div>
          </div>

          <div class="lesson-nav-footer">
            <NuxtLink v-if="prevLesson" :to="`/learn/${slug}/${prevLesson.slug}`" class="lesson-nav-btn lesson-nav-prev">
              <span class="lesson-nav-btn-label"><i class="fa-solid fa-arrow-left"></i> Previous</span>
              <span class="lesson-nav-btn-title">{{ prevLesson.title }}</span>
            </NuxtLink>
            <div v-else></div>

            <NuxtLink v-if="nextLesson" :to="`/learn/${slug}/${nextLesson.slug}`" class="lesson-nav-btn lesson-nav-next">
              <span class="lesson-nav-btn-label">Next <i class="fa-solid fa-arrow-right"></i></span>
              <span class="lesson-nav-btn-title">{{ nextLesson.title }}</span>
            </NuxtLink>
            <NuxtLink v-else :to="`/learn/${slug}`" class="lesson-nav-btn lesson-nav-next">
              <span class="lesson-nav-btn-label">Back to Path <i class="fa-solid fa-arrow-right"></i></span>
              <span class="lesson-nav-btn-title">{{ path?.title ?? 'Learning Path' }}</span>
            </NuxtLink>
          </div>
        </footer>
      </main>
    </div>
  </div>
  <div v-else class="lesson-not-found"><h1>Lesson not found</h1></div>
</template>

<style scoped>
/* Progress bar */
.lesson-progress-bar { position: fixed; top: 48px; left: 0; right: 0; height: 3px; background: var(--surface3); z-index: 100; }
.lesson-progress-fill { height: 100%; background: var(--accent); transition: width 0.3s ease; }

/* Layout */
.lesson-page { min-height: calc(100vh - 48px); }
.lesson-layout { display: grid; grid-template-columns: 260px 1fr; min-height: calc(100vh - 51px); }

/* Sidebar */
.lesson-sidebar {
  background: var(--surface);
  border-right: var(--border-width-default) solid var(--border);
  overflow-y: auto;
  height: calc(100vh - 51px);
  position: sticky;
  top: 51px;
}

.lesson-sidebar-header { padding: 14px 16px; border-bottom: var(--border-width-default) solid var(--border); }
.lesson-sidebar-title { font-size: 13px; font-weight: 600; color: var(--text); text-decoration: none; display: flex; align-items: center; gap: 8px; }
.lesson-sidebar-title:hover { color: var(--accent); }
.lesson-sidebar-title i { font-size: 12px; color: var(--accent); }

.lesson-sidebar-progress { padding: 12px 16px; border-bottom: var(--border-width-default) solid var(--border2); }
.lesson-sidebar-progress-text { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); display: block; margin-bottom: 6px; }
.lesson-sidebar-progress-bar { height: 4px; background: var(--surface3); border: var(--border-width-default) solid var(--border2); }
.lesson-sidebar-progress-fill { height: 100%; background: var(--accent); transition: width 0.3s; }

.lesson-curriculum { padding: 8px 0; }
.lesson-mod-title { font-size: 10px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-faint); padding: 10px 16px 4px; }
.lesson-nav-item { display: flex; align-items: center; gap: 8px; padding: 7px 16px; font-size: 12px; color: var(--text-dim); text-decoration: none; border-left: 3px solid transparent; }
.lesson-nav-item:hover { background: var(--surface2); color: var(--text); }
.lesson-nav-item.active { background: var(--accent-bg); border-left-color: var(--accent); color: var(--accent); font-weight: 500; }
.lesson-nav-icon { font-size: 10px; width: 16px; text-align: center; flex-shrink: 0; }
.lesson-nav-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lesson-nav-duration { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); flex-shrink: 0; }

/* Main */
.lesson-main { padding: 32px 48px 64px; max-width: 800px; }

.lesson-mobile-toggle { display: none; margin-bottom: 16px; padding: 6px 12px; font-size: 12px; border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text-dim); cursor: pointer; }

.lesson-header { margin-bottom: 24px; }
.lesson-meta-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
.lesson-type-badge { font-size: 10px; font-family: var(--font-mono); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border: var(--border-width-default) solid var(--accent-border); color: var(--accent); background: var(--accent-bg); display: inline-flex; align-items: center; gap: 4px; }
.lesson-module-name { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); }
.lesson-duration { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); display: flex; align-items: center; gap: 4px; }
.lesson-title { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; }
.lesson-edit-link { font-size: 11px; color: var(--text-faint); text-decoration: none; border: var(--border-width-default) solid var(--border2); padding: 2px 8px; display: inline-block; margin-top: 8px; }
.lesson-edit-link:hover { color: var(--accent); border-color: var(--accent); }

/* Video */
.lesson-video { margin-bottom: 24px; border: var(--border-width-default) solid var(--border); box-shadow: var(--shadow-md); }
.lesson-video-iframe { width: 100%; aspect-ratio: 16/9; display: block; }

/* Content */
.lesson-content { font-size: 15px; line-height: 1.75; margin-bottom: 24px; }
.lesson-content :deep(h2) { font-size: 20px; font-weight: 700; margin-top: 32px; margin-bottom: 12px; color: var(--text); }
.lesson-content :deep(h3) { font-size: 16px; font-weight: 700; margin-top: 24px; margin-bottom: 8px; color: var(--text); }
.lesson-content :deep(p) { margin-bottom: 14px; color: var(--text-dim); }
.lesson-content :deep(a) { color: var(--accent); }
.lesson-content :deep(code) { font-family: var(--font-mono); font-size: 13px; background: var(--surface2); padding: 2px 5px; border: var(--border-width-default) solid var(--border2); color: var(--accent); }
.lesson-content :deep(pre) { padding: 16px; background: var(--surface2); border: var(--border-width-default) solid var(--border); overflow-x: auto; margin: 16px 0; }
.lesson-content :deep(pre code) { background: none; border: none; padding: 0; }

/* Quiz */
.lesson-quiz { margin-bottom: 24px; }
.quiz-card { border: var(--border-width-default) solid var(--border); padding: 20px; margin-bottom: 16px; background: var(--surface); box-shadow: var(--shadow-md); }
.quiz-header { margin-bottom: 12px; }
.quiz-badge { font-size: 9px; font-family: var(--font-mono); letter-spacing: 0.08em; color: var(--yellow); background: var(--yellow-bg); border: var(--border-width-default) solid var(--yellow-border); padding: 3px 8px; }
.quiz-question { font-size: 16px; font-weight: 600; margin-bottom: 16px; line-height: 1.5; }
.quiz-options { display: flex; flex-direction: column; gap: 8px; }
.quiz-option { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; background: var(--surface); border: var(--border-width-default) solid var(--border); cursor: pointer; text-align: left; font-family: inherit; font-size: 13px; }
.quiz-option:hover:not(.answered) { background: var(--surface2); box-shadow: var(--shadow-sm); }
.quiz-option.selected-correct { background: var(--green-bg); border-color: var(--green); cursor: default; }
.quiz-option.selected-wrong { background: var(--red-bg); border-color: var(--red); cursor: default; }
.quiz-option.answered { cursor: default; }
.quiz-option-key { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--text-faint); width: 18px; flex-shrink: 0; }
.quiz-option.selected-correct .quiz-option-key { color: var(--green); }
.quiz-option.selected-wrong .quiz-option-key { color: var(--red); }
.quiz-option-text { flex: 1; color: var(--text-dim); line-height: 1.5; }
.quiz-option-indicator { font-size: 12px; flex-shrink: 0; }
.quiz-option.selected-correct .quiz-option-indicator { color: var(--green); }
.quiz-option.selected-wrong .quiz-option-indicator { color: var(--red); }
.quiz-explanation { margin-top: 12px; padding: 10px 14px; background: var(--accent-bg); border: var(--border-width-default) solid var(--accent-border); color: var(--accent); font-size: 13px; display: flex; align-items: flex-start; gap: 8px; line-height: 1.5; }
.quiz-score { text-align: center; padding: 20px; border: var(--border-width-default) solid var(--green); background: var(--green-bg); }
.quiz-score-value { font-size: 28px; font-weight: 700; font-family: var(--font-mono); color: var(--green); }
.quiz-score-label { font-size: 11px; font-family: var(--font-mono); color: var(--green); text-transform: uppercase; letter-spacing: 0.08em; }

/* Empty state */
.lesson-empty { color: var(--text-faint); font-size: 13px; text-align: center; padding: 48px 0; display: flex; flex-direction: column; align-items: center; gap: 8px; }

/* Footer */
.lesson-footer { margin-top: 40px; padding-top: 24px; border-top: var(--border-width-default) solid var(--border); }
.lesson-complete-row { margin-bottom: 20px; }
.lesson-complete-btn { padding: 10px 20px; background: var(--accent); color: var(--color-text-inverse); border: var(--border-width-default) solid var(--border); font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: var(--shadow-md); }
.lesson-complete-btn:hover { box-shadow: var(--shadow-sm); transform: translate(1px, 1px); }
.lesson-complete-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.lesson-completed-badge { display: inline-flex; align-items: center; gap: 6px; color: var(--green); font-size: 14px; font-weight: 600; }

.lesson-nav-footer { display: flex; justify-content: space-between; gap: 16px; }
.lesson-nav-btn { display: flex; flex-direction: column; gap: 4px; padding: 12px 16px; border: var(--border-width-default) solid var(--border); background: var(--surface); text-decoration: none; max-width: 48%; box-shadow: var(--shadow-md); transition: box-shadow 0.15s, transform 0.15s; }
.lesson-nav-btn:hover { box-shadow: var(--shadow-sm); transform: translate(1px, 1px); }
.lesson-nav-prev { align-items: flex-start; }
.lesson-nav-next { align-items: flex-end; margin-left: auto; }
.lesson-nav-btn-label { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-faint); display: flex; align-items: center; gap: 4px; }
.lesson-nav-btn-title { font-size: 13px; font-weight: 600; color: var(--accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.lesson-not-found { text-align: center; padding: 64px 0; color: var(--text-dim); }

/* Responsive */
@media (max-width: 768px) {
  .lesson-layout { grid-template-columns: 1fr; }
  .lesson-sidebar { position: fixed; left: -280px; top: 51px; width: 280px; height: calc(100vh - 51px); z-index: 90; transition: left 0.2s ease; }
  .lesson-sidebar.open { left: 0; box-shadow: var(--shadow-md); }
  .lesson-mobile-toggle { display: flex; align-items: center; gap: 6px; }
  .lesson-main { padding: 20px 16px 64px; }
}

.lesson-linked-source { margin-top: 24px; padding-top: 16px; border-top: var(--border-width-default) solid var(--border); }
.lesson-linked-source-link { font-size: 11px; font-family: var(--font-mono); color: var(--accent); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
.lesson-linked-source-link:hover { text-decoration: underline; }
</style>
