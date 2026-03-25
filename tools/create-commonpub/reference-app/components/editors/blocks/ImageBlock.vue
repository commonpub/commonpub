<script setup lang="ts">
/**
 * Image block — upload placeholder or image preview with alt text and caption.
 */
const props = defineProps<{
  content: Record<string, unknown>;
}>();

const emit = defineEmits<{
  update: [content: Record<string, unknown>];
}>();

const src = computed(() => (props.content.src as string) ?? '');
const alt = computed(() => (props.content.alt as string) ?? '');
const caption = computed(() => (props.content.caption as string) ?? '');
const hasImage = computed(() => !!src.value);

function updateField(field: string, value: string): void {
  emit('update', { ...props.content, [field]: value });
}

const uploading = ref(false);
const uploadError = ref('');

async function handleFileSelect(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  uploading.value = true;
  uploadError.value = '';

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', 'content');

    const result = await $fetch<{ url: string; width: number | null; height: number | null }>('/api/files/upload', {
      method: 'POST',
      body: formData,
    });

    emit('update', {
      src: result.url,
      alt: alt.value || file.name.replace(/\.[^.]+$/, ''),
      caption: caption.value,
    });
  } catch (err: unknown) {
    uploadError.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Upload failed';
  } finally {
    uploading.value = false;
  }
}
</script>

<template>
  <div class="cpub-image-block">
    <!-- No image — upload placeholder -->
    <template v-if="!hasImage">
      <label class="cpub-image-placeholder" :class="{ 'cpub-image-uploading': uploading }">
        <input type="file" accept="image/*" class="cpub-sr-only" :disabled="uploading" @change="handleFileSelect" />
        <template v-if="uploading">
          <i class="fa-solid fa-circle-notch fa-spin cpub-image-placeholder-icon"></i>
          <span class="cpub-image-placeholder-text">Uploading...</span>
        </template>
        <template v-else>
          <i class="fa-regular fa-image cpub-image-placeholder-icon"></i>
          <span class="cpub-image-placeholder-text">Click to upload image or drag and drop</span>
          <span class="cpub-image-placeholder-hint">JPG, PNG, WebP, GIF · 10 MB max</span>
        </template>
      </label>
      <div v-if="uploadError" class="cpub-image-error">{{ uploadError }}</div>
      <div class="cpub-image-url-row">
        <input
          class="cpub-image-url-input"
          type="url"
          placeholder="Or paste image URL..."
          :value="src"
          @input="updateField('src', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </template>

    <!-- Has image — show preview -->
    <template v-else>
      <div class="cpub-image-preview">
        <img :src="src" :alt="alt" class="cpub-image-preview-img" />
        <button class="cpub-image-remove" title="Remove image" @click="updateField('src', '')">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="cpub-image-fields">
        <input
          class="cpub-image-field"
          type="text"
          :value="alt"
          placeholder="Alt text (describes the image)..."
          aria-label="Image alt text"
          @input="updateField('alt', ($event.target as HTMLInputElement).value)"
        />
        <input
          class="cpub-image-field"
          type="text"
          :value="caption"
          placeholder="Caption (optional)..."
          aria-label="Image caption"
          @input="updateField('caption', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.cpub-image-block {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.cpub-image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 36px 24px;
  border: 2px dashed var(--border2);
  background: var(--surface2);
  cursor: pointer;
  transition: all 0.12s;
}

.cpub-image-placeholder:hover {
  border-color: var(--accent);
  background: var(--accent-bg);
}

.cpub-image-placeholder-icon {
  font-size: 28px;
  color: var(--text-faint);
}

.cpub-image-placeholder:hover .cpub-image-placeholder-icon {
  color: var(--accent);
}

.cpub-image-placeholder-text {
  font-size: 12px;
  color: var(--text-dim);
}

.cpub-image-placeholder-hint {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-faint);
}

.cpub-image-uploading {
  pointer-events: none;
  opacity: 0.7;
}

.cpub-image-error {
  padding: 6px 10px;
  font-size: 11px;
  color: var(--red);
  background: var(--red-bg);
  border: 1px solid var(--red-border);
}

.cpub-image-url-row {
  padding: 8px 0 0;
}

.cpub-image-url-input {
  width: 100%;
  padding: 6px 10px;
  font-size: 12px;
  background: var(--surface);
  border: 2px solid var(--border);
  color: var(--text);
  outline: none;
}

.cpub-image-url-input:focus {
  border-color: var(--accent);
}

.cpub-image-url-input::placeholder {
  color: var(--text-faint);
}

.cpub-image-preview {
  position: relative;
}

.cpub-image-preview-img {
  width: 100%;
  max-height: 500px;
  object-fit: contain;
  display: block;
  background: var(--surface2);
  border: 2px solid var(--border);
}

.cpub-image-remove {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  background: var(--text);
  border: none;
  color: var(--surface);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.12s;
}

.cpub-image-preview:hover .cpub-image-remove {
  opacity: 1;
}

.cpub-image-remove:hover {
  background: var(--red);
}

.cpub-image-fields {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 6px;
}

.cpub-image-field {
  width: 100%;
  padding: 5px 8px;
  font-size: 11px;
  background: var(--surface);
  border: 2px solid var(--border2);
  color: var(--text-dim);
  outline: none;
  font-style: italic;
}

.cpub-image-field:focus {
  border-color: var(--accent);
  color: var(--text);
  font-style: normal;
}

.cpub-image-field::placeholder {
  color: var(--text-faint);
  font-style: italic;
}

.cpub-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
