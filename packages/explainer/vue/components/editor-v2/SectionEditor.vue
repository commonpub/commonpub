<script setup lang="ts">
import { computed } from 'vue';
import type { ExplainerDocSection, ModuleConfig, SectionAside } from '@commonpub/explainer';
import { getModule, getModuleConfig } from '../../../modules/registry';
import type { ConfigField } from '../../../modules/types';

const props = defineProps<{
  section: ExplainerDocSection;
  index: number;
}>();

const emit = defineEmits<{
  'update:content': [field: string, value: unknown];
  'update:config': [config: Record<string, unknown>];
  delete: [];
  duplicate: [];
  'move-up': [];
  'move-down': [];
}>();

const mod = computed(() =>
  props.section.module ? getModule(props.section.module.type) : null,
);

const configFields = computed<ConfigField[]>(() =>
  props.section.module ? getModuleConfig(props.section.module.type) : [],
);

const moduleConfig = computed<Record<string, unknown>>(() =>
  props.section.module?.props ?? {},
);

// Group config fields
const configGroups = computed(() => {
  const groups = new Map<string, ConfigField[]>();
  for (const field of configFields.value) {
    const g = field.group ?? 'General';
    const list = groups.get(g) ?? [];
    list.push(field);
    groups.set(g, list);
  }
  return groups;
});

function updateContent(field: string, value: unknown): void {
  emit('update:content', field, value);
}

function updateConfigField(key: string, value: unknown): void {
  emit('update:config', { ...moduleConfig.value, [key]: value });
}

// Array field helpers
function addArrayItem(key: string): void {
  const arr = [...((moduleConfig.value[key] as unknown[]) ?? [])];
  // Detect item shape from existing items or default to empty string
  if (arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null) {
    // Clone shape with empty values
    const template: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(arr[0] as Record<string, unknown>)) {
      template[k] = typeof v === 'string' ? '' : typeof v === 'number' ? 0 : typeof v === 'boolean' ? false : '';
    }
    arr.push(template);
  } else {
    arr.push('');
  }
  emit('update:config', { ...moduleConfig.value, [key]: arr });
}

function removeArrayItem(key: string, idx: number): void {
  const arr = [...((moduleConfig.value[key] as unknown[]) ?? [])];
  arr.splice(idx, 1);
  emit('update:config', { ...moduleConfig.value, [key]: arr });
}

function updateArrayItem(key: string, idx: number, value: unknown): void {
  const arr = [...((moduleConfig.value[key] as unknown[]) ?? [])];
  arr[idx] = value;
  emit('update:config', { ...moduleConfig.value, [key]: arr });
}

function updateArrayObjectField(key: string, idx: number, field: string, value: unknown): void {
  const arr = [...((moduleConfig.value[key] as unknown[]) ?? [])];
  arr[idx] = { ...(arr[idx] as Record<string, unknown>), [field]: value };
  emit('update:config', { ...moduleConfig.value, [key]: arr });
}

function updateAside(field: string, value: string): void {
  const aside = props.section.aside ?? { icon: '', label: '', text: '' };
  emit('update:content', 'aside', { ...aside, [field]: value });
}
</script>

<template>
  <div class="cpub-section-editor">
    <!-- Section header -->
    <div class="cpub-se-header">
      <span class="cpub-se-section-num">Section {{ index + 1 }}</span>
      <span v-if="mod" class="cpub-se-module-badge" :style="{ color: mod.meta.color }">
        <span class="cpub-se-badge-dot" :style="{ background: mod.meta.color }" />
        {{ mod.meta.name }}
      </span>
      <div style="flex: 1" />
      <button class="cpub-se-action" @click="emit('move-up')" title="Move up">Up</button>
      <button class="cpub-se-action" @click="emit('move-down')" title="Move down">Dn</button>
      <button class="cpub-se-action" @click="emit('duplicate')" title="Duplicate">Dup</button>
      <button class="cpub-se-action cpub-se-action-danger" @click="emit('delete')" title="Delete">Del</button>
    </div>

    <!-- Content fields -->
    <div class="cpub-se-fields">
      <!-- Heading -->
      <div class="cpub-se-field">
        <label class="cpub-se-label">Heading</label>
        <input
          class="cpub-se-input cpub-se-input-large"
          :value="section.heading"
          placeholder="Section heading"
          @input="updateContent('heading', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <!-- Body (rich-text-lite) -->
      <div class="cpub-se-field">
        <label class="cpub-se-label">Body <span class="cpub-se-hint">before interactive</span></label>
        <textarea
          class="cpub-se-textarea"
          :value="section.body"
          placeholder="Set up the problem or concept. Use <strong>bold</strong>, <em>italic</em>, and <a>links</a>."
          rows="4"
          @input="updateContent('body', ($event.target as HTMLTextAreaElement).value)"
        />
      </div>

      <!-- Insight -->
      <div class="cpub-se-field">
        <label class="cpub-se-label">Insight <span class="cpub-se-hint">after interactive</span></label>
        <textarea
          class="cpub-se-textarea cpub-se-textarea-sm"
          :value="section.insight ?? ''"
          placeholder="Name the discovery. 'This is called...'"
          rows="2"
          @input="updateContent('insight', ($event.target as HTMLTextAreaElement).value)"
        />
      </div>

      <!-- Bridge -->
      <div class="cpub-se-field">
        <label class="cpub-se-label">Bridge to Next</label>
        <input
          class="cpub-se-input"
          :value="section.bridge ?? ''"
          placeholder="Simple enough. Now let's break it."
          @input="updateContent('bridge', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <!-- Aside -->
      <div class="cpub-se-aside-box">
        <label class="cpub-se-label">Aside / Callout</label>
        <div class="cpub-se-aside-fields">
          <div style="width: 80px;">
            <label class="cpub-se-label-sm">Icon</label>
            <input
              class="cpub-se-input cpub-se-input-mono"
              :value="section.aside?.icon ?? ''"
              placeholder="lightbulb"
              @input="updateAside('icon', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div style="width: 100px;">
            <label class="cpub-se-label-sm">Label</label>
            <input
              class="cpub-se-input cpub-se-input-mono"
              :value="section.aside?.label ?? ''"
              placeholder="Key idea"
              @input="updateAside('label', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div style="flex: 1;">
            <label class="cpub-se-label-sm">Text</label>
            <input
              class="cpub-se-input"
              :value="section.aside?.text ?? ''"
              placeholder="Supporting detail..."
              @input="updateAside('text', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Module config panel -->
    <div v-if="mod && configFields.length > 0" class="cpub-se-config">
      <div class="cpub-se-config-header">
        <span class="cpub-se-badge-dot" :style="{ background: mod.meta.color }" />
        <span>{{ mod.meta.name }} Configuration</span>
      </div>

      <div v-for="[groupName, fields] in configGroups" :key="groupName" class="cpub-se-config-group">
        <div class="cpub-se-config-group-label">{{ groupName }}</div>
        <div class="cpub-se-config-fields">
          <div
            v-for="field in fields"
            :key="field.key"
            class="cpub-se-config-field"
            :style="{ width: field.width === 'half' ? 'calc(50% - 5px)' : '100%' }"
          >
            <label class="cpub-se-label-sm">{{ field.title }}</label>

            <input
              v-if="field.type === 'text'"
              class="cpub-se-input cpub-se-input-mono"
              :value="moduleConfig[field.key] ?? field.default ?? ''"
              :placeholder="field.placeholder"
              @input="updateConfigField(field.key, ($event.target as HTMLInputElement).value)"
            />

            <input
              v-else-if="field.type === 'number'"
              class="cpub-se-input cpub-se-input-mono"
              type="number"
              :value="moduleConfig[field.key] ?? field.default"
              @input="updateConfigField(field.key, parseFloat(($event.target as HTMLInputElement).value))"
            />

            <textarea
              v-else-if="field.type === 'textarea'"
              class="cpub-se-textarea cpub-se-textarea-sm"
              :value="(moduleConfig[field.key] as string) ?? (field.default as string) ?? ''"
              :placeholder="field.placeholder"
              rows="3"
              @input="updateConfigField(field.key, ($event.target as HTMLTextAreaElement).value)"
            />

            <textarea
              v-else-if="field.type === 'code'"
              class="cpub-se-textarea cpub-se-textarea-code"
              :value="(moduleConfig[field.key] as string) ?? (field.default as string) ?? ''"
              rows="5"
              spellcheck="false"
              @input="updateConfigField(field.key, ($event.target as HTMLTextAreaElement).value)"
            />

            <select
              v-else-if="field.type === 'select'"
              class="cpub-se-select"
              :value="moduleConfig[field.key] ?? field.default"
              @change="updateConfigField(field.key, ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>

            <!-- Array field: repeater for lists of items -->
            <div v-else-if="field.type === 'array'" class="cpub-se-array">
              <div
                v-for="(item, arrIdx) in ((moduleConfig[field.key] as unknown[]) ?? [])"
                :key="arrIdx"
                class="cpub-se-array-item"
              >
                <!-- String items (compare do/don't) -->
                <template v-if="typeof item === 'string'">
                  <input
                    class="cpub-se-input cpub-se-input-mono"
                    :value="item"
                    @input="updateArrayItem(field.key, arrIdx, ($event.target as HTMLInputElement).value)"
                  />
                </template>
                <!-- Object items (quiz options, cards) -->
                <template v-else-if="typeof item === 'object' && item !== null">
                  <div class="cpub-se-array-obj">
                    <div v-for="(val, objKey) in (item as Record<string, unknown>)" :key="String(objKey)" class="cpub-se-array-obj-field">
                      <label class="cpub-se-label-sm">{{ String(objKey) }}</label>
                      <input
                        v-if="typeof val === 'string'"
                        class="cpub-se-input cpub-se-input-mono"
                        :value="val"
                        @input="updateArrayObjectField(field.key, arrIdx, String(objKey), ($event.target as HTMLInputElement).value)"
                      />
                      <input
                        v-else-if="typeof val === 'number'"
                        class="cpub-se-input cpub-se-input-mono"
                        type="number"
                        :value="val"
                        @input="updateArrayObjectField(field.key, arrIdx, String(objKey), parseFloat(($event.target as HTMLInputElement).value))"
                      />
                      <label v-else-if="typeof val === 'boolean'" class="cpub-se-array-check">
                        <input type="checkbox" :checked="val" @change="updateArrayObjectField(field.key, arrIdx, String(objKey), ($event.target as HTMLInputElement).checked)" />
                        {{ String(objKey) }}
                      </label>
                    </div>
                  </div>
                </template>
                <button class="cpub-se-array-remove" @click="removeArrayItem(field.key, arrIdx)" title="Remove">
                  <i class="fa-solid fa-xmark" />
                </button>
              </div>
              <button class="cpub-se-array-add" @click="addArrayItem(field.key)">
                <i class="fa-solid fa-plus" /> Add item
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-section-editor {
  max-width: 580px;
  margin: 0 auto;
  padding: 20px 24px;
}

/* Header */
.cpub-se-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.cpub-se-section-num {
  font-family: var(--font-ui, monospace);
  font-size: 10px;
  font-weight: 700;
  color: var(--text-faint, #666);
  text-transform: uppercase;
}

.cpub-se-module-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-ui, monospace);
  font-size: 10px;
  font-weight: 600;
}

.cpub-se-badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cpub-se-action {
  padding: 3px 8px;
  background: none;
  border: 1px solid var(--border, #333);
  color: var(--text-faint, #666);
  font-family: var(--font-ui, monospace);
  font-size: 9px;
  cursor: pointer;
}

.cpub-se-action:hover {
  color: var(--text, #ccc);
  border-color: var(--accent, #e04030);
}

.cpub-se-action-danger:hover {
  color: var(--error, #e04030);
  border-color: var(--error, #e04030);
}

/* Content fields */
.cpub-se-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.cpub-se-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cpub-se-label {
  font-family: var(--font-ui, monospace);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-faint, #666);
}

.cpub-se-label-sm {
  font-family: var(--font-ui, monospace);
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint, #666);
  margin-bottom: 2px;
  display: block;
}

.cpub-se-hint {
  font-weight: 400;
  opacity: 0.6;
  text-transform: none;
  letter-spacing: 0;
}

.cpub-se-input {
  padding: 7px 10px;
  background: var(--surface2, #1c1c24);
  border: 1px solid var(--border, #333);
  color: var(--text, #ccc);
  font-size: 13px;
  font-family: inherit;
  outline: none;
}

.cpub-se-input:focus {
  border-color: var(--accent, #e04030);
}

.cpub-se-input-large {
  font-size: 16px;
  font-weight: 600;
  padding: 10px 12px;
}

.cpub-se-input-mono {
  font-family: var(--font-ui, monospace);
  font-size: 12px;
}

.cpub-se-textarea {
  padding: 7px 10px;
  background: var(--surface2, #1c1c24);
  border: 1px solid var(--border, #333);
  color: var(--text, #ccc);
  font-size: 13px;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;
  outline: none;
}

.cpub-se-textarea:focus {
  border-color: var(--accent, #e04030);
}

.cpub-se-textarea-sm {
  font-size: 12px;
}

.cpub-se-textarea-code {
  font-family: var(--font-ui, monospace);
  font-size: 12px;
  line-height: 1.5;
  background: #0a0a0d;
  color: #a5d6a7;
  tab-size: 2;
}

.cpub-se-select {
  padding: 7px 10px;
  background: var(--surface2, #1c1c24);
  border: 1px solid var(--border, #333);
  color: var(--text, #ccc);
  font-family: var(--font-ui, monospace);
  font-size: 12px;
  outline: none;
}

.cpub-se-select:focus {
  border-color: var(--accent, #e04030);
}

/* Array repeater */
.cpub-se-array { display: flex; flex-direction: column; gap: 4px; width: 100%; }
.cpub-se-array-item { display: flex; gap: 4px; align-items: flex-start; }
.cpub-se-array-obj { flex: 1; display: flex; flex-wrap: wrap; gap: 4px; padding: 6px; background: rgba(255,255,255,0.02); border: 1px solid var(--border, #333); }
.cpub-se-array-obj-field { display: flex; flex-direction: column; gap: 2px; min-width: 80px; flex: 1; }
.cpub-se-array-remove { width: 24px; height: 24px; flex-shrink: 0; background: none; border: 1px solid var(--border, #333); color: var(--text-faint, #666); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px; margin-top: 2px; }
.cpub-se-array-remove:hover { color: var(--error, #e04030); border-color: var(--error, #e04030); }
.cpub-se-array-add { padding: 4px 10px; background: none; border: 1px dashed var(--border, #333); color: var(--text-faint, #666); font-family: var(--font-ui, monospace); font-size: 9px; cursor: pointer; display: flex; align-items: center; gap: 5px; text-transform: uppercase; letter-spacing: 0.06em; }
.cpub-se-array-add:hover { border-color: var(--accent, #e04030); color: var(--accent, #e04030); }
.cpub-se-array-check { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-dim, #999); cursor: pointer; }
.cpub-se-array-check input { accent-color: var(--accent, #e04030); }

/* Aside box */
.cpub-se-aside-box {
  background: var(--surface2, #1c1c24);
  border: 1px solid var(--border, #333);
  padding: 12px;
}

.cpub-se-aside-fields {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

/* Module config */
.cpub-se-config {
  background: var(--surface, #16161c);
  border: 1px solid var(--border, #333);
  overflow: hidden;
}

.cpub-se-config-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border, #333);
  background: rgba(255, 255, 255, 0.015);
  font-family: var(--font-ui, monospace);
  font-size: 10px;
  font-weight: 600;
  color: var(--text, #ccc);
}

.cpub-se-config-group-label {
  padding: 8px 14px;
  font-family: var(--font-ui, monospace);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint, #666);
  background: rgba(255, 255, 255, 0.02);
}

.cpub-se-config-fields {
  padding: 10px 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.cpub-se-config-field {
  display: flex;
  flex-direction: column;
}
</style>
