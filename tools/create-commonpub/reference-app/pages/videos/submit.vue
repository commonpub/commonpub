<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: 'Submit Video — CommonPub' });

const toast = useToast();
const { extract: extractError } = useApiError();
const saving = ref(false);

const title = ref('');
const description = ref('');
const url = ref('');
const categoryId = ref('');

const { data: categories } = await useFetch('/api/videos/categories');

// Video embed preview
const embedUrl = computed(() => {
  const v = url.value.trim();
  if (!v) return '';
  const ytMatch = v.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = v.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return '';
});

async function handleSubmit(): Promise<void> {
  if (!title.value.trim() || !url.value.trim()) return;
  saving.value = true;
  try {
    const result = await $fetch<{ id: string }>('/api/videos', {
      method: 'POST',
      body: {
        title: title.value,
        description: description.value || undefined,
        url: url.value,
        categoryId: categoryId.value || undefined,
      },
    });
    toast.success('Video submitted!');
    await navigateTo(`/videos/${result.id}`);
  } catch (err: unknown) {
    toast.error(extractError(err));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="video-submit">
    <NuxtLink to="/videos" class="cpub-back-link"><i class="fa-solid fa-arrow-left"></i> Video Hub</NuxtLink>
    <h1 class="page-title">Submit Video</h1>
    <p class="page-subtitle">Share a YouTube or Vimeo video with the community.</p>

    <form class="submit-form" @submit.prevent="handleSubmit" aria-label="Submit video">
      <div class="form-section">
        <div class="form-field">
          <label for="video-title" class="form-label">Title</label>
          <input id="video-title" v-model="title" type="text" class="form-input" required placeholder="Video title" />
        </div>

        <div class="form-field">
          <label for="video-url" class="form-label">Video URL</label>
          <input id="video-url" v-model="url" type="url" class="form-input" required placeholder="https://youtube.com/watch?v=..." />
        </div>

        <!-- Preview -->
        <div v-if="embedUrl" class="video-preview">
          <iframe :src="embedUrl" frameborder="0" allowfullscreen class="video-iframe" />
        </div>

        <div class="form-field">
          <label for="video-desc" class="form-label">Description</label>
          <textarea id="video-desc" v-model="description" class="form-textarea" rows="3" placeholder="What is this video about?" />
        </div>

        <div class="form-field">
          <label for="video-cat" class="form-label">Category</label>
          <select id="video-cat" v-model="categoryId" class="form-select">
            <option value="">— None —</option>
            <option v-for="cat in (categories ?? [])" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
          </select>
        </div>
      </div>

      <button type="submit" class="cpub-btn cpub-btn-primary" :disabled="saving || !title.trim() || !url.trim()">
        <i class="fa-solid fa-upload"></i> {{ saving ? 'Submitting...' : 'Submit Video' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.video-submit { max-width: 640px; margin: 0 auto; padding: 32px; }
.cpub-back-link { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px; }
.cpub-back-link:hover { color: var(--accent); }
.page-title { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
.page-subtitle { font-size: 13px; color: var(--text-dim); margin-bottom: 24px; }

.submit-form { display: flex; flex-direction: column; gap: 20px; }
.form-section { border: 2px solid var(--border); background: var(--surface); padding: 20px; box-shadow: 4px 4px 0 var(--border); display: flex; flex-direction: column; gap: 12px; }
.form-field { display: flex; flex-direction: column; gap: 4px; }
.form-label { font-size: 10px; font-weight: 600; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint); }
.form-input, .form-textarea, .form-select { padding: 8px 10px; border: 2px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; font-family: inherit; }
.form-input:focus, .form-textarea:focus, .form-select:focus { border-color: var(--accent); outline: none; }
.form-textarea { resize: vertical; }

.video-preview { border: 2px solid var(--border); box-shadow: 4px 4px 0 var(--border); }
.video-iframe { width: 100%; aspect-ratio: 16/9; display: block; }

</style>
