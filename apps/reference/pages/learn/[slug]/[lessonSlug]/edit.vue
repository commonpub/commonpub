<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const route = useRoute();
const slug = computed(() => route.params.slug as string);
const lessonSlug = computed(() => route.params.lessonSlug as string);
const toast = useToast();

// Fetch lesson data
interface LessonResponse {
  lesson: { id: string; title: string; slug: string; type: string; content: unknown; duration: number | null; moduleId: string };
  module: { id: string; title: string };
  pathId: string;
}

const { data: lessonData, refresh } = await useFetch<LessonResponse>(
  () => `/api/learn/${slug.value}/${lessonSlug.value}`,
);

useSeoMeta({
  title: () => lessonData.value ? `Edit: ${lessonData.value.lesson.title} — CommonPub` : 'Edit Lesson — CommonPub',
});

const lesson = computed(() => lessonData.value?.lesson);
const saving = ref(false);

// Editable fields
const editTitle = ref('');
const editType = ref('article');
const editDuration = ref(0);
const editContent = ref<unknown>(null);

// Article/text content as markdown string
const editMarkdown = ref('');

// Video URL
const editVideoUrl = ref('');

// Quiz data
interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}
const editQuiz = ref<QuizQuestion[]>([]);

const lessonTypes = ['article', 'video', 'quiz', 'project', 'explainer'] as const;

// Initialize form from lesson data
watch(lesson, (l) => {
  if (!l) return;
  editTitle.value = l.title;
  editType.value = l.type;
  editDuration.value = l.duration ?? 0;

  const content = l.content as Record<string, unknown> | null;
  if (!content) {
    editMarkdown.value = '';
    editVideoUrl.value = '';
    editQuiz.value = [];
    return;
  }

  if (l.type === 'article' || l.type === 'explainer' || l.type === 'project') {
    editMarkdown.value = (content.markdown as string) ?? '';
  } else if (l.type === 'video') {
    editVideoUrl.value = (content.videoUrl as string) ?? '';
    editMarkdown.value = (content.notes as string) ?? '';
  } else if (l.type === 'quiz') {
    editQuiz.value = Array.isArray(content.questions)
      ? (content.questions as QuizQuestion[]).map(q => ({ ...q }))
      : [];
  }
}, { immediate: true });

// Build content payload based on type
function buildContent(): unknown {
  switch (editType.value) {
    case 'article':
    case 'explainer':
    case 'project':
      return { markdown: editMarkdown.value };
    case 'video':
      return { videoUrl: editVideoUrl.value, notes: editMarkdown.value };
    case 'quiz':
      return { questions: editQuiz.value };
    default:
      return { markdown: editMarkdown.value };
  }
}

async function handleSave(): Promise<void> {
  if (!lesson.value) return;
  saving.value = true;
  try {
    await $fetch(`/api/learn/${slug.value}/lessons/${lesson.value.id}`, {
      method: 'PUT',
      body: {
        title: editTitle.value,
        type: editType.value,
        content: buildContent(),
        durationMinutes: editDuration.value || undefined,
      },
    });
    toast.success('Lesson saved!');
    await refresh();
  } catch {
    toast.error('Failed to save lesson');
  } finally {
    saving.value = false;
  }
}

// Quiz helpers
function addQuestion(): void {
  editQuiz.value.push({
    question: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: '',
  });
}

function removeQuestion(index: number): void {
  editQuiz.value.splice(index, 1);
}

function addOption(qIndex: number): void {
  editQuiz.value[qIndex]!.options.push('');
}

function removeOption(qIndex: number, oIndex: number): void {
  const q = editQuiz.value[qIndex]!;
  q.options.splice(oIndex, 1);
  if (q.correctIndex >= q.options.length) {
    q.correctIndex = Math.max(0, q.options.length - 1);
  }
}

// Video embed preview
const videoEmbedUrl = computed(() => {
  const url = editVideoUrl.value.trim();
  if (!url) return '';
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return url;
});
</script>

<template>
  <div v-if="lesson" class="lesson-edit">
    <!-- Header -->
    <div class="lesson-edit-header">
      <NuxtLink :to="`/learn/${slug}/edit`" class="cpub-back-link">
        <i class="fa-solid fa-arrow-left"></i> Back to path editor
      </NuxtLink>
      <div class="lesson-edit-header-row">
        <div>
          <h1 class="lesson-edit-title">Edit Lesson</h1>
          <p class="lesson-edit-subtitle">{{ lesson.title }}</p>
        </div>
        <button class="cpub-btn cpub-btn-primary" :disabled="saving || !editTitle.trim()" @click="handleSave">
          <i class="fa-solid fa-floppy-disk"></i> {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>

    <!-- Metadata -->
    <section class="lesson-section">
      <h2 class="lesson-section-title">Lesson Details</h2>
      <div class="lesson-form-grid">
        <div class="form-field">
          <label for="lesson-title" class="form-label">Title</label>
          <input id="lesson-title" v-model="editTitle" type="text" class="form-input" />
        </div>
        <div class="form-field">
          <label for="lesson-type" class="form-label">Type</label>
          <select id="lesson-type" v-model="editType" class="form-select">
            <option v-for="t in lessonTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="form-field">
          <label for="lesson-duration" class="form-label">Duration (minutes)</label>
          <input id="lesson-duration" v-model.number="editDuration" type="number" min="0" class="form-input" />
        </div>
      </div>
    </section>

    <!-- Content Editor — varies by type -->

    <!-- ARTICLE / EXPLAINER / PROJECT: Markdown editor -->
    <section v-if="editType === 'article' || editType === 'explainer' || editType === 'project'" class="lesson-section">
      <h2 class="lesson-section-title">Content</h2>
      <p class="lesson-section-hint">Write your lesson content in Markdown.</p>
      <textarea
        v-model="editMarkdown"
        class="lesson-editor"
        rows="20"
        placeholder="# Lesson Title&#10;&#10;Write your content here using Markdown..."
      />
    </section>

    <!-- VIDEO: URL + Notes -->
    <section v-else-if="editType === 'video'" class="lesson-section">
      <h2 class="lesson-section-title">Video</h2>
      <div class="form-field">
        <label for="video-url" class="form-label">Video URL</label>
        <input id="video-url" v-model="editVideoUrl" type="url" class="form-input" placeholder="https://youtube.com/watch?v=..." />
      </div>
      <div v-if="videoEmbedUrl" class="video-preview">
        <iframe :src="videoEmbedUrl" frameborder="0" allowfullscreen class="video-iframe" />
      </div>
      <div class="form-field" style="margin-top: 16px;">
        <label for="video-notes" class="form-label">Notes (optional)</label>
        <textarea v-model="editMarkdown" id="video-notes" class="lesson-editor" rows="8" placeholder="Additional notes in Markdown..." />
      </div>
    </section>

    <!-- QUIZ: Question builder -->
    <section v-else-if="editType === 'quiz'" class="lesson-section">
      <h2 class="lesson-section-title">Quiz Questions</h2>

      <div v-for="(q, qi) in editQuiz" :key="qi" class="quiz-question-card">
        <div class="quiz-q-header">
          <span class="quiz-q-number">Q{{ qi + 1 }}</span>
          <button class="cpub-delete-btn" @click="removeQuestion(qi)" aria-label="Remove question">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="form-field">
          <label class="form-label">Question</label>
          <textarea v-model="q.question" class="form-textarea" rows="2" placeholder="What is...?" />
        </div>

        <div class="quiz-options">
          <div v-for="(opt, oi) in q.options" :key="oi" class="quiz-option-row">
            <label class="quiz-radio-label">
              <input type="radio" :name="`q${qi}-correct`" :value="oi" v-model="q.correctIndex" />
            </label>
            <input v-model="q.options[oi]" type="text" class="form-input quiz-option-input" :placeholder="`Option ${oi + 1}`" />
            <button v-if="q.options.length > 2" class="cpub-delete-btn cpub-delete-btn-sm" @click="removeOption(qi, oi)" aria-label="Remove option">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <button v-if="q.options.length < 6" class="cpub-btn cpub-btn-sm" @click="addOption(qi)">
            <i class="fa-solid fa-plus"></i> Add Option
          </button>
        </div>

        <div class="form-field" style="margin-top: 8px;">
          <label class="form-label">Explanation (shown after answering)</label>
          <textarea v-model="q.explanation" class="form-textarea" rows="2" placeholder="This is correct because..." />
        </div>
      </div>

      <button class="cpub-btn" @click="addQuestion">
        <i class="fa-solid fa-plus"></i> Add Question
      </button>

      <div v-if="!editQuiz.length" class="quiz-empty">
        <p>No questions yet. Add your first question above.</p>
      </div>
    </section>
  </div>
  <div v-else class="lesson-not-found">
    <p>Lesson not found</p>
  </div>
</template>

<style scoped>
.lesson-edit { max-width: 760px; margin: 0 auto; padding: 32px; }

.lesson-edit-header { margin-bottom: 32px; }
.lesson-edit-header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.cpub-back-link { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px; }
.cpub-back-link:hover { color: var(--accent); }
.lesson-edit-title { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
.lesson-edit-subtitle { font-size: 13px; color: var(--text-dim); }

.lesson-section {
  background: var(--surface);
  border: 2px solid var(--border);
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 4px 4px 0 var(--border);
}

.lesson-section-title { font-size: 14px; font-weight: 700; margin-bottom: 12px; }
.lesson-section-hint { font-size: 12px; color: var(--text-faint); margin-bottom: 12px; }

.lesson-form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }

.form-field { display: flex; flex-direction: column; gap: 4px; }
.form-label { font-size: 11px; font-weight: 600; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint); }
.form-input, .form-select, .form-textarea {
  padding: 8px 10px;
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  font-family: inherit;
}
.form-input:focus, .form-select:focus, .form-textarea:focus { border-color: var(--accent); outline: none; }
.form-textarea { resize: vertical; }

/* Markdown editor */
.lesson-editor {
  width: 100%;
  padding: 12px 14px;
  border: 2px solid var(--border);
  background: var(--surface2);
  color: var(--text);
  font-size: 13px;
  font-family: var(--font-mono);
  line-height: 1.6;
  resize: vertical;
  min-height: 200px;
}

.lesson-editor:focus { border-color: var(--accent); outline: none; }
.lesson-editor::placeholder { color: var(--text-faint); }

/* Video preview */
.video-preview {
  margin-top: 12px;
  border: 2px solid var(--border);
  background: var(--surface2);
  box-shadow: 4px 4px 0 var(--border);
}

.video-iframe { width: 100%; aspect-ratio: 16 / 9; display: block; }

/* Quiz builder */
.quiz-question-card {
  border: 2px solid var(--border);
  padding: 16px;
  margin-bottom: 12px;
  background: var(--surface2);
}

.quiz-q-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.quiz-q-number { font-size: 12px; font-family: var(--font-mono); font-weight: 700; color: var(--accent); background: var(--accent-bg); padding: 2px 8px; border: 1px solid var(--accent-border); }

.quiz-options { display: flex; flex-direction: column; gap: 6px; margin: 8px 0; }

.quiz-option-row { display: flex; align-items: center; gap: 8px; }
.quiz-radio-label { flex-shrink: 0; }
.quiz-radio-label input[type="radio"] { accent-color: var(--accent); }
.quiz-option-input { flex: 1; }

.quiz-empty { text-align: center; padding: 24px; color: var(--text-faint); font-size: 13px; }

.lesson-not-found { text-align: center; padding: 64px; color: var(--text-dim); }

@media (max-width: 640px) {
  .lesson-form-grid { grid-template-columns: 1fr; }
  .lesson-edit { padding: 16px; }
}
</style>
