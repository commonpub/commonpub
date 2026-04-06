<script setup lang="ts">
import { ref } from 'vue';
import type { ExplainerDocument, ExplainerConclusion } from '@commonpub/explainer';

const props = defineProps<{
  document: ExplainerDocument;
}>();

const emit = defineEmits<{
  'update:hero': [field: string, value: string];
  'update:meta': [field: string, value: unknown];
  'update:conclusion': [conclusion: ExplainerConclusion | undefined];
  'update:settings': [field: string, value: unknown];
}>();

const openSections = ref<Set<string>>(new Set(['hero', 'meta']));
function toggleSection(id: string): void {
  const s = new Set(openSections.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  openSections.value = s;
}

// Conclusion toggle
function toggleConclusion(enabled: boolean): void {
  if (enabled) {
    emit('update:conclusion', { heading: 'Conclusion', body: '' });
  } else {
    emit('update:conclusion', undefined);
  }
}

function updateConclusion(field: string, value: string): void {
  const c = props.document.conclusion ?? { heading: '', body: '' };
  emit('update:conclusion', { ...c, [field]: value });
}

function updateCta(field: string, value: string): void {
  const c = props.document.conclusion ?? { heading: '', body: '' };
  const cta = c.callToAction ?? { label: '', url: '' };
  emit('update:conclusion', { ...c, callToAction: { ...cta, [field]: value } });
}

// Tags
const tagInput = ref('');
function addTag(): void {
  const tag = tagInput.value.trim();
  if (!tag) return;
  const current = props.document.meta.tags ?? [];
  if (!current.includes(tag)) {
    emit('update:meta', 'tags', [...current, tag]);
  }
  tagInput.value = '';
}
function removeTag(tag: string): void {
  emit('update:meta', 'tags', (props.document.meta.tags ?? []).filter(t => t !== tag));
}
</script>

<template>
  <div class="cpub-doc-panel">
    <!-- HERO -->
    <div class="cpub-dp-section">
      <button class="cpub-dp-header" @click="toggleSection('hero')">
        <i class="fa-solid" :class="openSections.has('hero') ? 'fa-chevron-down' : 'fa-chevron-right'" />
        <span>Hero</span>
      </button>
      <div v-if="openSections.has('hero')" class="cpub-dp-body">
        <div class="cpub-dp-field">
          <label class="cpub-dp-label">Cover Image URL</label>
          <input class="cpub-dp-input" :value="document.hero.coverImageUrl ?? ''" placeholder="https://..." @input="emit('update:hero', 'coverImageUrl', ($event.target as HTMLInputElement).value)" />
        </div>
        <div class="cpub-dp-field">
          <label class="cpub-dp-label">Highlight Phrase</label>
          <input class="cpub-dp-input" :value="document.hero.highlight ?? ''" placeholder="The accent-underlined text" @input="emit('update:hero', 'highlight', ($event.target as HTMLInputElement).value)" />
        </div>
        <div class="cpub-dp-field">
          <label class="cpub-dp-label">Scroll Hint</label>
          <input class="cpub-dp-input" :value="document.hero.scrollHint ?? ''" placeholder="Scroll to begin" @input="emit('update:hero', 'scrollHint', ($event.target as HTMLInputElement).value)" />
        </div>
      </div>
    </div>

    <!-- META -->
    <div class="cpub-dp-section">
      <button class="cpub-dp-header" @click="toggleSection('meta')">
        <i class="fa-solid" :class="openSections.has('meta') ? 'fa-chevron-down' : 'fa-chevron-right'" />
        <span>Meta</span>
      </button>
      <div v-if="openSections.has('meta')" class="cpub-dp-body">
        <div class="cpub-dp-field">
          <label class="cpub-dp-label">Description</label>
          <textarea class="cpub-dp-textarea" :value="document.meta.description ?? ''" placeholder="How this explainer appears in search and listings" rows="3" @input="emit('update:meta', 'description', ($event.target as HTMLTextAreaElement).value)" />
        </div>
        <div class="cpub-dp-field">
          <label class="cpub-dp-label">Difficulty</label>
          <select class="cpub-dp-select" :value="document.meta.difficulty" @change="emit('update:meta', 'difficulty', ($event.target as HTMLSelectElement).value)">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div class="cpub-dp-field">
          <label class="cpub-dp-label">Estimated Minutes</label>
          <input class="cpub-dp-input" type="number" :value="document.meta.estimatedMinutes" min="1" @input="emit('update:meta', 'estimatedMinutes', parseInt(($event.target as HTMLInputElement).value) || 5)" />
        </div>
        <div class="cpub-dp-field">
          <label class="cpub-dp-label">Tags</label>
          <div class="cpub-dp-tags">
            <span v-for="tag in (document.meta.tags ?? [])" :key="tag" class="cpub-dp-tag">
              {{ tag }}
              <button class="cpub-dp-tag-remove" @click="removeTag(tag)">&times;</button>
            </span>
            <input class="cpub-dp-tag-input" v-model="tagInput" placeholder="Add tag..." @keydown.enter.prevent="addTag" />
          </div>
        </div>
      </div>
    </div>

    <!-- CONCLUSION -->
    <div class="cpub-dp-section">
      <button class="cpub-dp-header" @click="toggleSection('conclusion')">
        <i class="fa-solid" :class="openSections.has('conclusion') ? 'fa-chevron-down' : 'fa-chevron-right'" />
        <span>Conclusion</span>
        <label class="cpub-dp-toggle" @click.stop>
          <input type="checkbox" :checked="!!document.conclusion" @change="toggleConclusion(($event.target as HTMLInputElement).checked)" />
        </label>
      </button>
      <div v-if="openSections.has('conclusion') && document.conclusion" class="cpub-dp-body">
        <div class="cpub-dp-field">
          <label class="cpub-dp-label">Heading</label>
          <input class="cpub-dp-input" :value="document.conclusion.heading" @input="updateConclusion('heading', ($event.target as HTMLInputElement).value)" />
        </div>
        <div class="cpub-dp-field">
          <label class="cpub-dp-label">Body</label>
          <textarea class="cpub-dp-textarea" :value="document.conclusion.body" rows="3" @input="updateConclusion('body', ($event.target as HTMLTextAreaElement).value)" />
        </div>
        <div class="cpub-dp-field">
          <label class="cpub-dp-label">Call to Action</label>
          <div style="display: flex; gap: 6px;">
            <input class="cpub-dp-input" style="flex: 1;" :value="document.conclusion.callToAction?.label ?? ''" placeholder="Button label" @input="updateCta('label', ($event.target as HTMLInputElement).value)" />
            <input class="cpub-dp-input" style="flex: 2;" :value="document.conclusion.callToAction?.url ?? ''" placeholder="https://..." @input="updateCta('url', ($event.target as HTMLInputElement).value)" />
          </div>
        </div>
      </div>
    </div>

    <!-- SETTINGS -->
    <div class="cpub-dp-section">
      <button class="cpub-dp-header" @click="toggleSection('settings')">
        <i class="fa-solid" :class="openSections.has('settings') ? 'fa-chevron-down' : 'fa-chevron-right'" />
        <span>Settings</span>
      </button>
      <div v-if="openSections.has('settings')" class="cpub-dp-body">
        <label class="cpub-dp-check"><input type="checkbox" :checked="document.settings?.showProgressBar !== false" @change="emit('update:settings', 'showProgressBar', ($event.target as HTMLInputElement).checked)" /> Show progress bar</label>
        <label class="cpub-dp-check"><input type="checkbox" :checked="document.settings?.showNavDots !== false" @change="emit('update:settings', 'showNavDots', ($event.target as HTMLInputElement).checked)" /> Show nav dots</label>
        <label class="cpub-dp-check"><input type="checkbox" :checked="document.settings?.showFooter !== false" @change="emit('update:settings', 'showFooter', ($event.target as HTMLInputElement).checked)" /> Show footer</label>
        <div class="cpub-dp-field" style="margin-top: 6px;">
          <label class="cpub-dp-label">Footer Text</label>
          <input class="cpub-dp-input" :value="document.settings?.footerText ?? 'An explorable explanation'" @input="emit('update:settings', 'footerText', ($event.target as HTMLInputElement).value)" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-doc-panel { padding: 4px 0; overflow-y: auto; }
.cpub-dp-section { border-bottom: 1px solid var(--border, #333); }
.cpub-dp-header { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 12px; background: none; border: none; color: var(--text, #ccc); cursor: pointer; font-family: var(--font-ui, monospace); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; text-align: left; }
.cpub-dp-header i { font-size: 8px; color: var(--text-faint, #666); width: 10px; }
.cpub-dp-header:hover { background: rgba(255,255,255,0.03); }
.cpub-dp-body { padding: 4px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
.cpub-dp-field { display: flex; flex-direction: column; gap: 3px; }
.cpub-dp-label { font-family: var(--font-ui, monospace); font-size: 8px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint, #666); }
.cpub-dp-input { padding: 5px 8px; background: var(--surface2, #1c1c24); border: 1px solid var(--border, #333); color: var(--text, #ccc); font-size: 12px; font-family: inherit; outline: none; }
.cpub-dp-input:focus { border-color: var(--accent, #e04030); }
.cpub-dp-textarea { padding: 5px 8px; background: var(--surface2, #1c1c24); border: 1px solid var(--border, #333); color: var(--text, #ccc); font-size: 12px; font-family: inherit; resize: vertical; outline: none; line-height: 1.5; }
.cpub-dp-textarea:focus { border-color: var(--accent, #e04030); }
.cpub-dp-select { padding: 5px 8px; background: var(--surface2, #1c1c24); border: 1px solid var(--border, #333); color: var(--text, #ccc); font-size: 12px; font-family: var(--font-ui, monospace); outline: none; }
.cpub-dp-select:focus { border-color: var(--accent, #e04030); }
.cpub-dp-tags { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.cpub-dp-tag { display: flex; align-items: center; gap: 3px; padding: 2px 6px; background: var(--accent-light, rgba(224,64,48,0.08)); border: 1px solid var(--accent-border, rgba(224,64,48,0.25)); color: var(--accent, #e04030); font-size: 10px; font-family: var(--font-ui, monospace); }
.cpub-dp-tag-remove { background: none; border: none; color: inherit; cursor: pointer; font-size: 12px; padding: 0 2px; }
.cpub-dp-tag-input { flex: 1; min-width: 60px; padding: 3px 6px; background: none; border: 1px solid transparent; color: var(--text, #ccc); font-size: 11px; outline: none; }
.cpub-dp-tag-input:focus { border-color: var(--accent, #e04030); }
.cpub-dp-check { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-dim, #999); cursor: pointer; padding: 3px 0; }
.cpub-dp-check input { accent-color: var(--accent, #e04030); }
.cpub-dp-toggle { margin-left: auto; }
.cpub-dp-toggle input { accent-color: var(--accent, #e04030); }
</style>
