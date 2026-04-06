<script setup lang="ts">
export interface PageTreeItem {
  id: string;
  title: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
}

export interface PageTreeNode extends PageTreeItem {
  children: PageTreeNode[];
  depth: number;
}

const props = defineProps<{
  pages: PageTreeItem[];
  selectedPageId: string | null;
}>();

const emit = defineEmits<{
  select: [pageId: string];
  create: [parentId: string | null, title: string];
  rename: [pageId: string, title: string];
  delete: [pageId: string];
  reorder: [pageIds: string[]];
  reparent: [pageId: string, newParentId: string | null];
}>();

// Build nested tree from flat pages
const tree = computed<PageTreeNode[]>(() => {
  return buildTree(props.pages, null, 0);
});

function buildTree(pages: PageTreeItem[], parentId: string | null, depth: number): PageTreeNode[] {
  return pages
    .filter(p => p.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(p => ({
      ...p,
      depth,
      children: buildTree(pages, p.id, depth + 1),
    }));
}

// Expand/collapse state
const expandedIds = ref<Set<string>>(new Set());

// Auto-expand parents of selected page
watch(() => props.selectedPageId, (selectedId) => {
  if (!selectedId) return;
  const ancestors = getAncestors(selectedId);
  for (const id of ancestors) {
    expandedIds.value.add(id);
  }
}, { immediate: true });

function getAncestors(pageId: string): string[] {
  const result: string[] = [];
  let current = props.pages.find(p => p.id === pageId);
  while (current?.parentId) {
    result.push(current.parentId);
    current = props.pages.find(p => p.id === current!.parentId);
  }
  return result;
}

function toggleExpanded(id: string): void {
  const s = new Set(expandedIds.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  expandedIds.value = s;
}

function isExpanded(id: string): boolean {
  return expandedIds.value.has(id);
}

// Inline add page
const addingUnder = ref<string | null | 'root'>(null);
const newPageTitle = ref('');

function startAdd(parentId: string | null): void {
  addingUnder.value = parentId ?? 'root';
  newPageTitle.value = '';
  nextTick(() => {
    const input = document.querySelector('.cpub-tree-add-input') as HTMLInputElement | null;
    input?.focus();
  });
}

function confirmAdd(): void {
  if (!newPageTitle.value.trim()) {
    addingUnder.value = null;
    return;
  }
  const parentId = addingUnder.value === 'root' ? null : addingUnder.value;
  emit('create', parentId, newPageTitle.value.trim());
  addingUnder.value = null;
  newPageTitle.value = '';
}

function cancelAdd(): void {
  addingUnder.value = null;
  newPageTitle.value = '';
}

// Compute depth for the inline add row (child depth = parent depth + 1)
const addingDepth = computed(() => {
  if (addingUnder.value === null || addingUnder.value === 'root') return 0;
  // Find the parent node's depth in the flat list
  const parentNode = flatNodes.value.find(n => n.id === addingUnder.value);
  return parentNode ? parentNode.depth + 1 : 1;
});

// Context menu
const contextMenu = ref<{ pageId: string; x: number; y: number } | null>(null);

function showContext(pageId: string, event: MouseEvent): void {
  event.preventDefault();
  contextMenu.value = { pageId, x: event.clientX, y: event.clientY };
}

function closeContext(): void {
  contextMenu.value = null;
}

function contextRename(): void {
  if (!contextMenu.value) return;
  const page = props.pages.find(p => p.id === contextMenu.value!.pageId);
  if (!page) return;
  const newTitle = prompt('Rename page:', page.title);
  if (newTitle && newTitle.trim()) {
    emit('rename', page.id, newTitle.trim());
  }
  closeContext();
}

function contextDelete(): void {
  if (!contextMenu.value) return;
  const page = props.pages.find(p => p.id === contextMenu.value!.pageId);
  if (!page) return;
  if (confirm(`Delete "${page.title}"? This cannot be undone.`)) {
    emit('delete', page.id);
  }
  closeContext();
}

function contextAddChild(): void {
  if (!contextMenu.value) return;
  const parentId = contextMenu.value.pageId;
  expandedIds.value.add(parentId);
  closeContext();
  startAdd(parentId);
}

// Drag and drop
const draggedId = ref<string | null>(null);
const dropTargetId = ref<string | null>(null);
const dropPosition = ref<'before' | 'inside' | 'after' | null>(null);

function onDragStart(pageId: string, event: DragEvent): void {
  draggedId.value = pageId;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', pageId);
  }
}

function onDragOver(targetId: string, event: DragEvent): void {
  if (draggedId.value === targetId) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const y = event.clientY - rect.top;
  const h = rect.height;

  dropTargetId.value = targetId;
  if (y < h * 0.25) dropPosition.value = 'before';
  else if (y > h * 0.75) dropPosition.value = 'after';
  else dropPosition.value = 'inside';
}

function onDragLeave(): void {
  dropTargetId.value = null;
  dropPosition.value = null;
}

function onDrop(targetId: string): void {
  if (!draggedId.value || draggedId.value === targetId) return;

  const target = props.pages.find(p => p.id === targetId);
  if (!target) return;

  if (dropPosition.value === 'inside') {
    // Reparent: make dragged page a child of target
    emit('reparent', draggedId.value, targetId);
    expandedIds.value.add(targetId);
  } else {
    // Before/after: move dragged page to target's parent and set sibling order
    const newParentId = target.parentId;
    const dragId = draggedId.value;

    // Compute the new sibling order INCLUDING the dragged page
    const siblings = props.pages
      .filter(p => p.parentId === newParentId && p.id !== dragId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const targetIdx = siblings.findIndex(p => p.id === targetId);
    const insertIdx = dropPosition.value === 'before' ? targetIdx : targetIdx + 1;
    const ordered = [...siblings];
    const draggedPage = props.pages.find(p => p.id === dragId);
    if (draggedPage) {
      ordered.splice(insertIdx, 0, draggedPage);
    }

    // Emit a single 'move' event so parent can handle atomically
    emit('reparent', dragId, newParentId);
    emit('reorder', ordered.map(p => p.id));
  }

  draggedId.value = null;
  dropTargetId.value = null;
  dropPosition.value = null;
}

function onDragEnd(): void {
  draggedId.value = null;
  dropTargetId.value = null;
  dropPosition.value = null;
}

// Flatten tree for rendering
function flattenForRender(nodes: PageTreeNode[]): PageTreeNode[] {
  const result: PageTreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children.length > 0 && isExpanded(node.id)) {
      result.push(...flattenForRender(node.children));
    }
  }
  return result;
}

const flatNodes = computed(() => flattenForRender(tree.value));

// Close context menu on click outside
onMounted(() => {
  document.addEventListener('click', closeContext);
});
onUnmounted(() => {
  document.removeEventListener('click', closeContext);
});
</script>

<template>
  <div class="cpub-page-tree" role="tree" aria-label="Pages">
    <div
      v-for="node in flatNodes"
      :key="node.id"
      class="cpub-tree-item"
      :class="{
        'cpub-tree-item-selected': selectedPageId === node.id,
        'cpub-tree-item-dragging': draggedId === node.id,
        'cpub-tree-item-drop-before': dropTargetId === node.id && dropPosition === 'before',
        'cpub-tree-item-drop-inside': dropTargetId === node.id && dropPosition === 'inside',
        'cpub-tree-item-drop-after': dropTargetId === node.id && dropPosition === 'after',
      }"
      :style="{ paddingLeft: `${12 + node.depth * 16}px` }"
      role="treeitem"
      :aria-selected="selectedPageId === node.id"
      :aria-expanded="node.children.length > 0 ? isExpanded(node.id) : undefined"
      draggable="true"
      @click="emit('select', node.id)"
      @contextmenu="showContext(node.id, $event)"
      @dragstart="onDragStart(node.id, $event)"
      @dragover="onDragOver(node.id, $event)"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop(node.id)"
      @dragend="onDragEnd"
    >
      <!-- Expand/collapse toggle -->
      <button
        v-if="node.children.length > 0"
        class="cpub-tree-toggle"
        :aria-label="isExpanded(node.id) ? 'Collapse' : 'Expand'"
        @click.stop="toggleExpanded(node.id)"
      >
        <i class="fa-solid" :class="isExpanded(node.id) ? 'fa-chevron-down' : 'fa-chevron-right'" />
      </button>
      <span v-else class="cpub-tree-toggle-spacer" />

      <i class="fa-solid fa-file-lines cpub-tree-icon" />
      <span class="cpub-tree-title">{{ node.title || 'Untitled' }}</span>

      <!-- Kebab menu -->
      <button class="cpub-tree-kebab" aria-label="Page actions" @click.stop="showContext(node.id, $event)">
        <i class="fa-solid fa-ellipsis-vertical" />
      </button>
    </div>

    <!-- Inline add at root or under parent -->
    <div
      v-if="addingUnder !== null"
      class="cpub-tree-add-row"
      :style="{ paddingLeft: `${12 + addingDepth * 16}px` }"
    >
      <i class="fa-solid fa-file-circle-plus cpub-tree-icon cpub-tree-icon-add" />
      <input
        v-model="newPageTitle"
        class="cpub-tree-add-input"
        placeholder="Page title..."
        @keydown.enter="confirmAdd"
        @keydown.escape="cancelAdd"
        @blur="confirmAdd"
      />
    </div>

    <!-- Add page button -->
    <button class="cpub-tree-add-btn" @click="startAdd(null)">
      <i class="fa-solid fa-plus" /> Add Page
    </button>

    <!-- Context menu -->
    <Teleport to="body">
      <div
        v-if="contextMenu"
        class="cpub-tree-context"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
        @click.stop
      >
        <button class="cpub-tree-context-item" @click="contextRename">
          <i class="fa-solid fa-pen" /> Rename
        </button>
        <button class="cpub-tree-context-item" @click="contextAddChild">
          <i class="fa-solid fa-folder-plus" /> Add Child
        </button>
        <button class="cpub-tree-context-item cpub-tree-context-danger" @click="contextDelete">
          <i class="fa-solid fa-trash" /> Delete
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.cpub-page-tree {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
  user-select: none;
}

.cpub-tree-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px 6px 12px;
  cursor: pointer;
  transition: background 0.1s;
  position: relative;
}

.cpub-tree-item:hover {
  background: var(--surface2);
}

.cpub-tree-item-selected {
  background: var(--accent-bg);
  border-left: 2px solid var(--accent);
}

.cpub-tree-item-dragging {
  opacity: 0.4;
}

.cpub-tree-item-drop-before::before {
  content: '';
  position: absolute;
  top: 0;
  left: 8px;
  right: 8px;
  height: 2px;
  background: var(--accent);
}

.cpub-tree-item-drop-inside {
  background: var(--accent-bg);
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.cpub-tree-item-drop-after::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 8px;
  right: 8px;
  height: 2px;
  background: var(--accent);
}

.cpub-tree-toggle {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 8px;
  padding: 0;
  flex-shrink: 0;
}

.cpub-tree-toggle:hover {
  color: var(--text);
}

.cpub-tree-toggle-spacer {
  width: 16px;
  flex-shrink: 0;
}

.cpub-tree-icon {
  font-size: 11px;
  color: var(--text-faint);
  flex-shrink: 0;
}

.cpub-tree-icon-add {
  color: var(--accent);
}

.cpub-tree-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.cpub-tree-item-selected .cpub-tree-title {
  color: var(--accent);
}

.cpub-tree-kebab {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 10px;
  padding: 0;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.1s;
}

.cpub-tree-item:hover .cpub-tree-kebab {
  opacity: 1;
}

.cpub-tree-kebab:hover {
  color: var(--text);
}

.cpub-tree-add-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
}

.cpub-tree-add-input {
  flex: 1;
  padding: 3px 6px;
  background: var(--surface);
  border: var(--border-width-default) solid var(--accent);
  color: var(--text);
  font-size: 12px;
  outline: none;
}

.cpub-tree-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px;
  margin-top: 4px;
  background: none;
  border: 2px dashed var(--border2);
  color: var(--text-faint);
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
}

.cpub-tree-add-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* Context menu */
.cpub-tree-context {
  position: fixed;
  z-index: 1000;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-md);
  min-width: 140px;
  padding: 4px 0;
}

.cpub-tree-context-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 12px;
  background: none;
  border: none;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}

.cpub-tree-context-item:hover {
  background: var(--surface2);
}

.cpub-tree-context-item i {
  width: 12px;
  font-size: 10px;
  color: var(--text-faint);
}

.cpub-tree-context-danger {
  color: var(--red);
}

.cpub-tree-context-danger i {
  color: var(--red);
}
</style>
