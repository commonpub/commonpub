<script setup lang="ts">
/**
 * Gallery block — multi-image grid with upload and reorder.
 * Each image has src, alt, caption.
 */
const props = defineProps<{
  content: Record<string, unknown>;
}>();

const emit = defineEmits<{
  update: [content: Record<string, unknown>];
}>();

interface GalleryImage {
  src: string;
  alt: string;
  caption: string;
}

const images = computed<GalleryImage[]>(() => {
  const raw = props.content.images;
  if (!Array.isArray(raw)) return [];
  return raw as GalleryImage[];
});

function updateImages(newImages: GalleryImage[]): void {
  emit('update', { images: newImages });
}

const uploading = ref(false);

async function handleFileSelect(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;

  uploading.value = true;
  const newImages = [...images.value];

  for (const file of Array.from(input.files)) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('purpose', 'content');
      const result = await $fetch<{ url: string }>('/api/files/upload', {
        method: 'POST',
        body: formData,
      });
      newImages.push({
        src: result.url,
        alt: file.name.replace(/\.[^.]+$/, ''),
        caption: '',
      });
    } catch {
      // Skip failed uploads
    }
  }

  updateImages(newImages);
  uploading.value = false;
  input.value = '';
}

function removeImage(index: number): void {
  const newImages = images.value.filter((_, i) => i !== index);
  updateImages(newImages);
}

function updateImageField(index: number, field: keyof GalleryImage, value: string): void {
  const newImages = images.value.map((img, i) =>
    i === index ? { ...img, [field]: value } : img,
  );
  updateImages(newImages);
}
</script>

<template>
  <div class="cpub-gallery-block">
    <!-- Image grid -->
    <div v-if="images.length > 0" class="cpub-gallery-grid">
      <div v-for="(img, idx) in images" :key="idx" class="cpub-gallery-item">
        <div class="cpub-gallery-img-wrap">
          <img :src="img.src" :alt="img.alt" class="cpub-gallery-img" />
          <button class="cpub-gallery-remove" title="Remove" @click="removeImage(idx)">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <input
          class="cpub-gallery-field"
          type="text"
          :value="img.alt"
          placeholder="Alt text..."
          @input="updateImageField(idx, 'alt', ($event.target as HTMLInputElement).value)"
        />
        <input
          class="cpub-gallery-field"
          type="text"
          :value="img.caption"
          placeholder="Caption..."
          @input="updateImageField(idx, 'caption', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <!-- Add images -->
    <label class="cpub-gallery-add" :class="{ 'cpub-gallery-uploading': uploading }">
      <input type="file" accept="image/*" multiple class="cpub-sr-only" :disabled="uploading" @change="handleFileSelect" />
      <template v-if="uploading">
        <i class="fa-solid fa-circle-notch fa-spin"></i>
        <span>Uploading...</span>
      </template>
      <template v-else>
        <i class="fa-solid fa-images"></i>
        <span>{{ images.length > 0 ? 'Add more images' : 'Upload images for gallery' }}</span>
      </template>
    </label>
  </div>
</template>

<style scoped>
.cpub-gallery-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cpub-gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}

.cpub-gallery-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cpub-gallery-img-wrap {
  position: relative;
  aspect-ratio: 4/3;
  overflow: hidden;
  border: 2px solid var(--border);
  background: var(--surface2);
}

.cpub-gallery-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cpub-gallery-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  background: var(--text);
  border: none;
  color: var(--surface);
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.12s;
}

.cpub-gallery-img-wrap:hover .cpub-gallery-remove {
  opacity: 1;
}

.cpub-gallery-remove:hover {
  background: var(--red);
}

.cpub-gallery-field {
  width: 100%;
  padding: 4px 6px;
  font-size: 10px;
  background: var(--surface);
  border: 1px solid var(--border2);
  color: var(--text-dim);
  outline: none;
  font-style: italic;
}

.cpub-gallery-field:focus {
  border-color: var(--accent);
  font-style: normal;
}

.cpub-gallery-field::placeholder {
  color: var(--text-faint);
}

.cpub-gallery-add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  border: 2px dashed var(--border2);
  cursor: pointer;
  font-size: 12px;
  color: var(--text-dim);
  transition: all 0.12s;
}

.cpub-gallery-add:hover {
  border-color: var(--accent);
  background: var(--accent-bg);
  color: var(--accent);
}

.cpub-gallery-add i {
  font-size: 16px;
}

.cpub-gallery-uploading {
  pointer-events: none;
  opacity: 0.7;
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
