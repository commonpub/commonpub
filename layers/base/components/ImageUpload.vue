<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
  purpose: 'avatar' | 'banner' | 'cover';
  label?: string;
  hint?: string;
  aspectClass?: string;
  /** Override the crop aspect ratio (width/height). Defaults by purpose. */
  aspectRatio?: number;
}>();

const emit = defineEmits<{
  'update:modelValue': [url: string];
}>();

const uploading = ref(false);
const error = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

// The image is cropped to the target element's aspect ratio before upload, so it
// displays WYSIWYG instead of being arbitrarily cover-cropped on the page.
const cropConfig = computed(() => {
  switch (props.purpose) {
    case 'avatar': return { ratio: props.aspectRatio ?? 1, round: true, output: 512, title: 'Crop avatar' };
    case 'banner': return { ratio: props.aspectRatio ?? 4, round: false, output: 1600, title: 'Crop banner' };
    case 'cover': return { ratio: props.aspectRatio ?? 16 / 9, round: false, output: 1600, title: 'Crop cover image' };
    default: return { ratio: props.aspectRatio ?? 1, round: false, output: 1200, title: 'Crop image' };
  }
});

const cropSrc = ref('');

function triggerPicker(): void {
  fileInput.value?.click();
}

function handleFileChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    error.value = 'Please select an image file.';
  } else if (file.size > 10 * 1024 * 1024) {
    error.value = 'Image must be under 10MB.';
  } else {
    error.value = '';
    const reader = new FileReader();
    reader.onload = () => { cropSrc.value = reader.result as string; };
    reader.onerror = () => { error.value = 'Could not read the image.'; };
    reader.readAsDataURL(file);
  }
  target.value = '';
}

async function onCropped(blob: Blob): Promise<void> {
  cropSrc.value = '';
  uploading.value = true;
  error.value = '';
  try {
    const ext = blob.type === 'image/png' ? 'png' : 'jpg';
    const formData = new FormData();
    formData.append('file', new File([blob], `${props.purpose}.${ext}`, { type: blob.type || 'image/jpeg' }));
    formData.append('purpose', props.purpose);

    const result = await $fetch<{ url: string }>('/api/files/upload', {
      method: 'POST',
      body: formData,
    });

    emit('update:modelValue', result.url);
  } catch (err: unknown) {
    error.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Upload failed.';
  } finally {
    uploading.value = false;
  }
}

function clearImage(): void {
  emit('update:modelValue', '');
}
</script>

<template>
  <div class="cpub-img-upload">
    <label v-if="label" class="cpub-img-upload-label">{{ label }}</label>

    <div
      class="cpub-img-upload-zone"
      :class="[aspectClass || (purpose === 'banner' ? 'cpub-img-banner' : purpose === 'cover' ? 'cpub-img-cover' : 'cpub-img-square'), { 'cpub-img-has-preview': modelValue }]"
      @click="triggerPicker"
    >
      <img v-if="modelValue" :src="modelValue" alt="Preview" class="cpub-img-preview" />
      <div v-else class="cpub-img-placeholder">
        <span v-if="uploading">Uploading...</span>
        <span v-else>Click to upload</span>
      </div>
      <div v-if="modelValue && !uploading" class="cpub-img-overlay">
        <span>Change</span>
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="cpub-img-file-input"
      @change="handleFileChange"
    />

    <div v-if="modelValue" class="cpub-img-actions">
      <button type="button" class="cpub-img-remove" @click.stop="clearImage">Remove</button>
    </div>

    <span v-if="hint && !error" class="cpub-img-hint">{{ hint }}</span>
    <span v-if="error" class="cpub-img-error">{{ error }}</span>

    <ClientOnly>
      <ImageCropperModal
        v-if="cropSrc"
        :src="cropSrc"
        :aspect-ratio="cropConfig.ratio"
        :round="cropConfig.round"
        :output-width="cropConfig.output"
        :title="cropConfig.title"
        @crop="onCropped"
        @cancel="cropSrc = ''"
      />
    </ClientOnly>
  </div>
</template>

<style scoped>
.cpub-img-upload {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cpub-img-upload-label {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
}

.cpub-img-upload-zone {
  position: relative;
  border: 2px dashed var(--border);
  border-radius: 0;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  background: var(--color-surface);
}

.cpub-img-upload-zone:hover {
  border-color: var(--accent);
  background: var(--accent-bg);
}

.cpub-img-upload-zone.cpub-img-has-preview {
  border-style: solid;
}

.cpub-img-square {
  width: 120px;
  height: 120px;
}

.cpub-img-cover {
  width: 100%;
  aspect-ratio: 16 / 9;
  min-height: 120px;
}

.cpub-img-banner {
  width: 100%;
  aspect-ratio: 4 / 1;
  min-height: 100px;
}

.cpub-img-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cpub-img-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-faint);
  font-size: 0.75rem;
}

.cpub-img-overlay {
  position: absolute;
  inset: 0;
  background: var(--color-surface-scrim);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-inverse);
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0;
  transition: opacity 0.15s;
}

.cpub-img-upload-zone:hover .cpub-img-overlay {
  opacity: 1;
}

.cpub-img-file-input {
  display: none;
}

.cpub-img-actions {
  display: flex;
  gap: 8px;
}

.cpub-img-remove {
  font-size: 0.6875rem;
  color: var(--red);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
.cpub-img-remove:hover { text-decoration: underline; }

.cpub-img-hint {
  font-size: 0.6875rem;
  color: var(--text-faint);
}

.cpub-img-error {
  font-size: 0.6875rem;
  color: var(--red);
}
</style>
