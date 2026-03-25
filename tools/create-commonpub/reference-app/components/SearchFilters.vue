<script setup lang="ts">
const props = defineProps<{
  diffFilters: string[];
  activeTags: string[];
  dateFrom: string;
  dateTo: string;
  authorFilter: string;
  communityFilter: string;
}>();

const emit = defineEmits<{
  'update:diffFilters': [val: string[]];
  'update:activeTags': [val: string[]];
  'update:dateFrom': [val: string];
  'update:dateTo': [val: string];
  'update:authorFilter': [val: string];
  'update:communityFilter': [val: string];
  apply: [];
  clear: [];
}>();

const tagInput = ref('');

function toggleDiff(val: string): void {
  const current = [...props.diffFilters];
  const idx = current.indexOf(val);
  if (idx >= 0) current.splice(idx, 1);
  else current.push(val);
  emit('update:diffFilters', current);
}

function addTag(): void {
  const t = tagInput.value.trim();
  if (t && !props.activeTags.includes(t)) {
    emit('update:activeTags', [...props.activeTags, t]);
  }
  tagInput.value = '';
}

function removeTag(tag: string): void {
  emit('update:activeTags', props.activeTags.filter(t => t !== tag));
}
</script>

<template>
  <div class="cpub-adv-panel">
    <div class="cpub-adv-grid">
      <!-- Difficulty -->
      <div class="cpub-adv-section">
        <label class="cpub-adv-label">Difficulty</label>
        <div class="cpub-checkbox-group">
          <label v-for="d in ['Beginner', 'Intermediate', 'Advanced']" :key="d" class="cpub-check-item">
            <input
              type="checkbox"
              :checked="diffFilters.includes(d.toLowerCase())"
              @change="toggleDiff(d.toLowerCase())"
            />
            <span>{{ d }}</span>
          </label>
        </div>
      </div>

      <!-- Tags -->
      <div class="cpub-adv-section">
        <label class="cpub-adv-label">Tags</label>
        <input
          v-model="tagInput"
          class="cpub-adv-input"
          type="text"
          placeholder="Add tag&hellip;"
          @keyup.enter="addTag"
        />
        <div class="cpub-tag-chips">
          <span
            v-for="tag in activeTags"
            :key="tag"
            class="cpub-tag-chip active"
          >
            {{ tag }} <span class="cpub-rm" @click="removeTag(tag)">&times;</span>
          </span>
        </div>
      </div>

      <!-- Date Range -->
      <div class="cpub-adv-section">
        <label class="cpub-adv-label">Date Range</label>
        <input :value="dateFrom" class="cpub-adv-input" type="text" placeholder="From: yyyy-mm-dd" @input="emit('update:dateFrom', ($event.target as HTMLInputElement).value)" />
        <input :value="dateTo" class="cpub-adv-input" type="text" placeholder="To: yyyy-mm-dd" @input="emit('update:dateTo', ($event.target as HTMLInputElement).value)" />
      </div>

      <!-- Author / Community -->
      <div class="cpub-adv-section">
        <label class="cpub-adv-label">Author</label>
        <input :value="authorFilter" class="cpub-adv-input" type="text" placeholder="Username or name&hellip;" @input="emit('update:authorFilter', ($event.target as HTMLInputElement).value)" />
        <label class="cpub-adv-label" style="margin-top: 10px">Community</label>
        <input :value="communityFilter" class="cpub-adv-input" type="text" placeholder="Community name&hellip;" @input="emit('update:communityFilter', ($event.target as HTMLInputElement).value)" />
      </div>

      <!-- Actions -->
      <div class="cpub-adv-actions">
        <button class="cpub-btn cpub-btn-primary cpub-btn-sm" @click="emit('apply')">
          <i class="fa-solid fa-check"></i> Apply Filters
        </button>
        <button class="cpub-btn cpub-btn-ghost cpub-btn-sm" @click="emit('clear')">
          Clear All
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-adv-panel {
  background: var(--surface);
  border: 2px solid var(--border);
  border-top: none;
  padding: 24px 32px 28px;
  margin-bottom: 24px;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-adv-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr) auto;
  gap: 20px;
  align-items: start;
}

.cpub-adv-label {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  display: block;
  margin-bottom: 10px;
}

.cpub-checkbox-group { display: flex; flex-direction: column; gap: 7px; }

.cpub-check-item {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
}

.cpub-check-item input[type="checkbox"] {
  width: 13px; height: 13px; accent-color: var(--accent); cursor: pointer; flex-shrink: 0;
}

.cpub-check-item span { font-size: 12px; color: var(--text-dim); user-select: none; }
.cpub-check-item input:checked + span { color: var(--text); }

.cpub-adv-input {
  width: 100%;
  background: var(--surface2);
  border: 2px solid var(--border);
  padding: 7px 10px;
  font-size: 12px;
  color: var(--text);
  font-family: system-ui, -apple-system, sans-serif;
  outline: none;
  margin-bottom: 6px;
  transition: border-color 0.15s;
}

.cpub-adv-input:focus { border-color: var(--accent); }
.cpub-adv-input::placeholder { color: var(--text-faint); }

.cpub-tag-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }

.cpub-tag-chip {
  font-size: 10px; font-family: var(--font-mono); padding: 3px 8px;
  border: 2px solid var(--border2); background: var(--surface2); color: var(--text-dim);
  display: flex; align-items: center; gap: 5px; cursor: default;
}

.cpub-tag-chip.active {
  background: var(--accent-bg); border-color: var(--accent-border); color: var(--accent);
}

.cpub-rm { font-size: 11px; cursor: pointer; line-height: 1; }

.cpub-adv-actions {
  display: flex; flex-direction: column; gap: 8px; justify-content: flex-end; padding-top: 20px;
}

@media (max-width: 1024px) { .cpub-adv-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) { .cpub-adv-grid { grid-template-columns: 1fr; } }
</style>
