<script setup lang="ts">
const props = defineProps<{
  contentType: string;
  metadata: Record<string, unknown>;
  selectedBlock: { type: string; attrs: Record<string, unknown> } | null;
}>();

const emit = defineEmits<{
  'update:metadata': [metadata: Record<string, unknown>];
  'slug-edited': [];
}>();

function updateField(key: string, value: unknown): void {
  emit('update:metadata', { ...props.metadata, [key]: value });
}

const visibilityOptions = ['public', 'members', 'private'];

// Fetch user's hubs for the hub assignment dropdown
const { isAuthenticated } = useAuth();
const { data: userHubs } = useLazyFetch<{ items: Array<{ id: string; name: string; slug: string; role: string }> }>('/api/user/hubs', {
  immediate: isAuthenticated.value,
  default: () => ({ items: [] }),
});
const difficultyOptions = [
  { value: 1, label: 'Beginner' },
  { value: 2, label: 'Intermediate' },
  { value: 3, label: 'Advanced' },
];
</script>

<template>
  <aside class="cpub-properties" aria-label="Document properties">
    <div class="cpub-properties-header">
      <i class="fa-solid fa-sliders"></i>
      <span class="cpub-properties-title">Properties</span>
    </div>

    <div class="cpub-properties-body">
      <!-- Document properties -->
      <section class="cpub-prop-section">
        <span class="cpub-prop-section-label"><i class="fa-solid fa-file-lines"></i> Document</span>

        <div class="cpub-prop-field">
          <label for="prop-slug" class="cpub-prop-label">Slug</label>
          <input
            id="prop-slug"
            type="text"
            class="cpub-prop-input"
            :value="metadata.slug"
            placeholder="auto-generated from title"
            @input="updateField('slug', ($event.target as HTMLInputElement).value); emit('slug-edited')"
          />
        </div>

        <div class="cpub-prop-field">
          <label for="prop-description" class="cpub-prop-label">Description</label>
          <textarea
            id="prop-description"
            class="cpub-prop-textarea"
            rows="3"
            :value="metadata.description as string"
            placeholder="Brief description..."
            @input="updateField('description', ($event.target as HTMLTextAreaElement).value)"
          />
        </div>

        <div class="cpub-prop-field">
          <label for="prop-tags" class="cpub-prop-label">Tags</label>
          <input
            id="prop-tags"
            type="text"
            class="cpub-prop-input"
            :value="(metadata.tags as string[] || []).join(', ')"
            placeholder="tag1, tag2, tag3"
            @input="updateField('tags', ($event.target as HTMLInputElement).value.split(',').map(t => t.trim()).filter(Boolean))"
          />
        </div>

        <div class="cpub-prop-field">
          <label for="prop-visibility" class="cpub-prop-label">Visibility</label>
          <select
            id="prop-visibility"
            class="cpub-prop-select"
            :value="metadata.visibility || 'public'"
            @change="updateField('visibility', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="opt in visibilityOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
        </div>

        <div v-if="userHubs?.items?.length" class="cpub-prop-field">
          <label for="prop-hub" class="cpub-prop-label">Community</label>
          <select
            id="prop-hub"
            class="cpub-prop-select"
            :value="metadata.hubSlug || ''"
            @change="updateField('hubSlug', ($event.target as HTMLSelectElement).value || undefined)"
          >
            <option value="">None</option>
            <option v-for="hub in userHubs.items" :key="hub.id" :value="hub.slug">{{ hub.name }}</option>
          </select>
          <span class="cpub-prop-hint">Link to a community's project gallery. Content visibility is controlled separately above.</span>
        </div>

        <div class="cpub-prop-field">
          <label for="prop-cover" class="cpub-prop-label">Cover Image</label>
          <input
            id="prop-cover"
            type="text"
            class="cpub-prop-input"
            :value="metadata.coverImage"
            placeholder="URL or upload..."
            @input="updateField('coverImage', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </section>

      <!-- Type-specific metadata -->
      <section v-if="contentType === 'article' || contentType === 'blog'" class="cpub-prop-section">
        <span class="cpub-prop-section-label"><i :class="contentType === 'article' ? 'fa-solid fa-newspaper' : 'fa-solid fa-pen-nib'"></i> {{ contentType === 'article' ? 'Article' : 'Blog' }}</span>

        <div class="cpub-prop-field">
          <label for="prop-category" class="cpub-prop-label">Category</label>
          <input
            id="prop-category"
            type="text"
            class="cpub-prop-input"
            :value="metadata.category"
            placeholder="Category..."
            @input="updateField('category', ($event.target as HTMLInputElement).value)"
          />
        </div>

        <div v-if="contentType === 'blog'" class="cpub-prop-field">
          <label for="prop-series" class="cpub-prop-label">Series</label>
          <input
            id="prop-series"
            type="text"
            class="cpub-prop-input"
            :value="metadata.series"
            placeholder="Series name..."
            @input="updateField('series', ($event.target as HTMLInputElement).value)"
          />
        </div>

        <div class="cpub-prop-field">
          <label for="prop-seo" class="cpub-prop-label">SEO Description</label>
          <textarea
            id="prop-seo"
            class="cpub-prop-textarea"
            rows="2"
            :value="metadata.seoDescription as string"
            placeholder="SEO description..."
            @input="updateField('seoDescription', ($event.target as HTMLTextAreaElement).value)"
          />
        </div>
      </section>

      <section v-if="contentType === 'project'" class="cpub-prop-section">
        <span class="cpub-prop-section-label"><i class="fa-solid fa-microchip"></i> Project</span>

        <div class="cpub-prop-field">
          <label for="prop-difficulty" class="cpub-prop-label">Difficulty</label>
          <select
            id="prop-difficulty"
            class="cpub-prop-select"
            :value="metadata.difficulty || 1"
            @change="updateField('difficulty', Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="opt in difficultyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>

        <div class="cpub-prop-field">
          <label for="prop-buildtime" class="cpub-prop-label">Build Time</label>
          <input
            id="prop-buildtime"
            type="text"
            class="cpub-prop-input"
            :value="metadata.buildTime"
            placeholder="e.g., 2 hours"
            @input="updateField('buildTime', ($event.target as HTMLInputElement).value)"
          />
        </div>

        <div class="cpub-prop-field">
          <label for="prop-cost" class="cpub-prop-label">Estimated Cost</label>
          <input
            id="prop-cost"
            type="text"
            class="cpub-prop-input"
            :value="metadata.estimatedCost"
            placeholder="e.g., $50"
            @input="updateField('estimatedCost', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </section>

      <section v-if="contentType === 'explainer'" class="cpub-prop-section">
        <span class="cpub-prop-section-label"><i class="fa-solid fa-lightbulb"></i> Explainer</span>

        <div class="cpub-prop-field">
          <label for="prop-exp-difficulty" class="cpub-prop-label">Difficulty</label>
          <select
            id="prop-exp-difficulty"
            class="cpub-prop-select"
            :value="metadata.difficulty || 1"
            @change="updateField('difficulty', Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="opt in difficultyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>

        <div class="cpub-prop-field">
          <label for="prop-minutes" class="cpub-prop-label">Est. Minutes</label>
          <input
            id="prop-minutes"
            type="number"
            class="cpub-prop-input"
            :value="metadata.estimatedMinutes"
            placeholder="10"
            @input="updateField('estimatedMinutes', Number(($event.target as HTMLInputElement).value))"
          />
        </div>

        <div class="cpub-prop-field">
          <label for="prop-objectives" class="cpub-prop-label">Learning Objectives</label>
          <textarea
            id="prop-objectives"
            class="cpub-prop-textarea"
            rows="3"
            :value="metadata.learningObjectives as string"
            placeholder="One per line..."
            @input="updateField('learningObjectives', ($event.target as HTMLTextAreaElement).value)"
          />
        </div>
      </section>

      <!-- Selected block properties -->
      <section v-if="selectedBlock" class="cpub-prop-section">
        <span class="cpub-prop-section-label"><i class="fa-solid fa-cube"></i> Block: {{ selectedBlock.type }}</span>

        <template v-if="selectedBlock.type === 'image'">
          <div class="cpub-prop-field">
            <label class="cpub-prop-label">Alt Text</label>
            <input type="text" class="cpub-prop-input" :value="selectedBlock.attrs.alt" readonly />
          </div>
          <div class="cpub-prop-field">
            <label class="cpub-prop-label">Caption</label>
            <input type="text" class="cpub-prop-input" :value="selectedBlock.attrs.caption" readonly />
          </div>
        </template>

        <template v-if="selectedBlock.type === 'code_block'">
          <div class="cpub-prop-field">
            <label class="cpub-prop-label">Language</label>
            <input type="text" class="cpub-prop-input" :value="selectedBlock.attrs.language" readonly />
          </div>
          <div class="cpub-prop-field">
            <label class="cpub-prop-label">Filename</label>
            <input type="text" class="cpub-prop-input" :value="selectedBlock.attrs.filename" readonly />
          </div>
        </template>

        <template v-if="selectedBlock.type === 'callout'">
          <div class="cpub-prop-field">
            <label class="cpub-prop-label">Variant</label>
            <span class="cpub-prop-value">{{ selectedBlock.attrs.variant }}</span>
          </div>
        </template>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.cpub-properties {
  width: 280px;
  border-left: var(--border-width-default) solid var(--border);
  background: var(--surface);
  overflow-y: auto;
  flex-shrink: 0;
}

.cpub-properties-header {
  padding: var(--space-3) var(--space-4);
  border-bottom: 2px solid var(--border2);
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-dim);
}

.cpub-properties-header i {
  font-size: 14px;
}

.cpub-properties-title {
  font-family: var(--font-mono);
  font-size: var(--text-label);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-widest);
  color: var(--text-dim);
}

.cpub-properties-body {
  padding: var(--space-3);
}

.cpub-prop-section {
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 2px solid var(--border2);
}

.cpub-prop-section:last-child {
  border-bottom: none;
}

.cpub-prop-section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-widest);
  color: var(--text-faint);
  margin-bottom: var(--space-3);
}

.cpub-prop-section-label i {
  font-size: 12px;
  color: var(--accent);
}

.cpub-prop-field {
  margin-bottom: var(--space-3);
}

.cpub-prop-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  color: var(--text-dim);
  margin-bottom: var(--space-1);
}

.cpub-prop-input,
.cpub-prop-select,
.cpub-prop-textarea {
  width: 100%;
  padding: var(--space-1) var(--space-2);
  background: var(--surface2);
  border: 2px solid var(--border2);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
}

.cpub-prop-input:focus,
.cpub-prop-select:focus,
.cpub-prop-textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.cpub-prop-textarea {
  resize: vertical;
}

.cpub-prop-select {
  appearance: none;
  cursor: pointer;
}

.cpub-prop-hint {
  display: block;
  font-size: 0.6875rem;
  color: var(--text-faint);
  margin-top: 4px;
  line-height: 1.4;
}

.cpub-prop-value {
  font-size: var(--text-sm);
  color: var(--text);
  text-transform: capitalize;
}
</style>
