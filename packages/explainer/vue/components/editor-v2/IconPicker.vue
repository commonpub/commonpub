<script setup lang="ts">
/**
 * IconPicker — curated Font Awesome icon grid with search.
 * Shows a button with the current icon, click to open a popover grid.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const open = ref(false);
const search = ref('');
const pickerRef = ref<HTMLElement | null>(null);

/** Curated icons organized by category */
const ICON_GROUPS: Array<{ name: string; icons: Array<{ id: string; label: string }> }> = [
  {
    name: 'Common',
    icons: [
      { id: 'lightbulb', label: 'Lightbulb' },
      { id: 'star', label: 'Star' },
      { id: 'heart', label: 'Heart' },
      { id: 'check', label: 'Check' },
      { id: 'xmark', label: 'X Mark' },
      { id: 'circle-info', label: 'Info' },
      { id: 'circle-question', label: 'Question' },
      { id: 'circle-exclamation', label: 'Warning' },
      { id: 'circle-check', label: 'Check Circle' },
      { id: 'triangle-exclamation', label: 'Alert' },
      { id: 'flag', label: 'Flag' },
      { id: 'bookmark', label: 'Bookmark' },
    ],
  },
  {
    name: 'Objects',
    icons: [
      { id: 'key', label: 'Key' },
      { id: 'lock', label: 'Lock' },
      { id: 'lock-open', label: 'Unlock' },
      { id: 'gear', label: 'Gear' },
      { id: 'wrench', label: 'Wrench' },
      { id: 'hammer', label: 'Hammer' },
      { id: 'screwdriver-wrench', label: 'Tools' },
      { id: 'flask', label: 'Flask' },
      { id: 'microscope', label: 'Microscope' },
      { id: 'magnet', label: 'Magnet' },
      { id: 'plug', label: 'Plug' },
      { id: 'battery-full', label: 'Battery' },
    ],
  },
  {
    name: 'Concepts',
    icons: [
      { id: 'brain', label: 'Brain' },
      { id: 'eye', label: 'Eye' },
      { id: 'hand', label: 'Hand' },
      { id: 'bolt', label: 'Lightning' },
      { id: 'fire', label: 'Fire' },
      { id: 'shield', label: 'Shield' },
      { id: 'scale-balanced', label: 'Balance' },
      { id: 'bullseye', label: 'Target' },
      { id: 'puzzle-piece', label: 'Puzzle' },
      { id: 'arrows-rotate', label: 'Cycle' },
      { id: 'chart-line', label: 'Chart' },
      { id: 'clock', label: 'Clock' },
    ],
  },
  {
    name: 'Arrows',
    icons: [
      { id: 'arrow-up', label: 'Up' },
      { id: 'arrow-down', label: 'Down' },
      { id: 'arrow-left', label: 'Left' },
      { id: 'arrow-right', label: 'Right' },
      { id: 'arrows-up-down', label: 'Up/Down' },
      { id: 'arrows-left-right', label: 'Left/Right' },
      { id: 'rotate', label: 'Rotate' },
      { id: 'shuffle', label: 'Shuffle' },
      { id: 'maximize', label: 'Expand' },
      { id: 'compress', label: 'Compress' },
      { id: 'up-right-from-square', label: 'External' },
      { id: 'repeat', label: 'Repeat' },
    ],
  },
  {
    name: 'Media',
    icons: [
      { id: 'image', label: 'Image' },
      { id: 'video', label: 'Video' },
      { id: 'music', label: 'Music' },
      { id: 'volume-high', label: 'Sound' },
      { id: 'microphone', label: 'Mic' },
      { id: 'camera', label: 'Camera' },
      { id: 'file', label: 'File' },
      { id: 'folder', label: 'Folder' },
      { id: 'code', label: 'Code' },
      { id: 'terminal', label: 'Terminal' },
      { id: 'database', label: 'Database' },
      { id: 'globe', label: 'Globe' },
    ],
  },
  {
    name: 'People',
    icons: [
      { id: 'user', label: 'User' },
      { id: 'users', label: 'Users' },
      { id: 'user-group', label: 'Group' },
      { id: 'handshake', label: 'Handshake' },
      { id: 'comments', label: 'Chat' },
      { id: 'envelope', label: 'Email' },
      { id: 'phone', label: 'Phone' },
      { id: 'share-nodes', label: 'Share' },
      { id: 'thumbs-up', label: 'Thumbs Up' },
      { id: 'thumbs-down', label: 'Thumbs Down' },
      { id: 'face-smile', label: 'Smile' },
      { id: 'graduation-cap', label: 'Education' },
    ],
  },
];

const allIcons = ICON_GROUPS.flatMap(g => g.icons);

const filteredGroups = computed(() => {
  const q = search.value.toLowerCase().trim();
  if (!q) return ICON_GROUPS;
  return ICON_GROUPS.map(g => ({
    ...g,
    icons: g.icons.filter(ic => ic.id.includes(q) || ic.label.toLowerCase().includes(q)),
  })).filter(g => g.icons.length > 0);
});

function selectIcon(id: string): void {
  emit('update:modelValue', id);
  open.value = false;
  search.value = '';
}

function clearIcon(): void {
  emit('update:modelValue', '');
  open.value = false;
}

function onClickOutside(e: MouseEvent): void {
  if (open.value && pickerRef.value && !pickerRef.value.contains(e.target as Node)) {
    open.value = false;
    search.value = '';
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside));
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside));
</script>

<template>
  <div ref="pickerRef" class="cpub-icon-picker">
    <button class="cpub-ip-trigger" @click="open = !open">
      <i v-if="modelValue" :class="`fa-solid fa-${modelValue}`" />
      <i v-else class="fa-solid fa-icons cpub-ip-placeholder-icon" />
      <span class="cpub-ip-label">{{ modelValue || placeholder || 'Pick icon...' }}</span>
      <i class="fa-solid fa-chevron-down cpub-ip-caret" />
    </button>

    <div v-if="open" class="cpub-ip-dropdown">
      <input
        v-model="search"
        class="cpub-ip-search"
        type="text"
        placeholder="Search icons..."
        autofocus
      />

      <div class="cpub-ip-grid-wrap">
        <template v-for="group in filteredGroups" :key="group.name">
          <div class="cpub-ip-group-label">{{ group.name }}</div>
          <div class="cpub-ip-grid">
            <button
              v-for="icon in group.icons"
              :key="icon.id"
              class="cpub-ip-icon-btn"
              :class="{ 'cpub-ip-icon-btn--active': modelValue === icon.id }"
              :title="icon.label"
              @click="selectIcon(icon.id)"
            >
              <i :class="`fa-solid fa-${icon.id}`" />
            </button>
          </div>
        </template>
        <div v-if="filteredGroups.length === 0" class="cpub-ip-empty">No icons match</div>
      </div>

      <button v-if="modelValue" class="cpub-ip-clear" @click="clearIcon">
        <i class="fa-solid fa-xmark" /> Clear
      </button>
    </div>
  </div>
</template>

<style scoped>
.cpub-icon-picker {
  position: relative;
}

.cpub-ip-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 5px 8px;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  color: var(--text);
  font-size: 12px;
  font-family: var(--font-mono);
  cursor: pointer;
  text-align: left;
}

.cpub-ip-trigger:hover {
  border-color: var(--accent);
}

.cpub-ip-trigger i:first-child {
  width: 16px;
  text-align: center;
  font-size: 12px;
}

.cpub-ip-placeholder-icon {
  color: var(--text-faint);
}

.cpub-ip-label {
  flex: 1;
  font-size: 11px;
}

.cpub-ip-caret {
  font-size: 8px;
  color: var(--text-faint);
}

.cpub-ip-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 2px;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-md);
  z-index: 50;
  min-width: 240px;
}

.cpub-ip-search {
  width: 100%;
  padding: 6px 8px;
  background: var(--surface2);
  border: none;
  border-bottom: var(--border-width-default) solid var(--border);
  color: var(--text);
  font-size: 11px;
  font-family: var(--font-mono);
  outline: none;
}

.cpub-ip-search::placeholder {
  color: var(--text-faint);
}

.cpub-ip-grid-wrap {
  max-height: 240px;
  overflow-y: auto;
  padding: 4px;
}

.cpub-ip-group-label {
  padding: 4px 6px 2px;
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-faint);
}

.cpub-ip-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 2px;
  padding: 2px 4px 6px;
}

.cpub-ip-icon-btn {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: var(--border-width-default) solid transparent;
  color: var(--text-dim);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.08s;
}

.cpub-ip-icon-btn:hover {
  background: var(--accent-bg);
  border-color: var(--accent);
  color: var(--accent);
}

.cpub-ip-icon-btn--active {
  background: var(--accent-bg);
  border-color: var(--accent);
  color: var(--accent);
}

.cpub-ip-empty {
  padding: 16px;
  text-align: center;
  font-size: 11px;
  color: var(--text-faint);
}

.cpub-ip-clear {
  width: 100%;
  padding: 5px;
  background: none;
  border: none;
  border-top: var(--border-width-default) solid var(--border);
  color: var(--text-faint);
  font-size: 10px;
  font-family: var(--font-mono);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.cpub-ip-clear:hover {
  color: var(--red);
}
</style>
