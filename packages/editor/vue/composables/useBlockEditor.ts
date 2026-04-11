/**
 * Block editor composable — manages an array of content blocks with full CRUD operations.
 * Blocks are stored as { id, type, content } and serialized to/from BlockTuple format for persistence.
 *
 * This is the canonical location — replaces duplicates in layer and explainer.
 */
import { ref, computed, readonly, type Ref } from 'vue';
import type { BlockTuple } from '@commonpub/editor';
import type { EditorBlock, BlockEditorOptions } from '../types.js';

/** Default content values when creating a new block of each type */
const BLOCK_DEFAULTS: Record<string, () => Record<string, unknown>> = {
  paragraph: () => ({ html: '' }),
  heading: () => ({ text: '', level: 2 }),
  code_block: () => ({ code: '', language: '', filename: '' }),
  image: () => ({ src: '', alt: '', caption: '' }),
  blockquote: () => ({ html: '', attribution: '' }),
  callout: () => ({ html: '', variant: 'info' }),
  gallery: () => ({ images: [] }),
  video: () => ({ url: '', platform: 'youtube', caption: '' }),
  embed: () => ({ url: '', type: 'generic', html: '' }),
  horizontal_rule: () => ({}),
  partsList: () => ({ parts: [] }),
  buildStep: () => ({ stepNumber: 1, title: '', time: '', children: [['paragraph', { html: '' }]] }),
  toolList: () => ({ tools: [] }),
  downloads: () => ({ files: [] }),
  quiz: () => ({ question: '', options: [], feedback: '' }),
  interactiveSlider: () => ({ label: '', min: 0, max: 100, step: 1, defaultValue: 50, states: [] }),
  checkpoint: () => ({ message: '' }),
  mathNotation: () => ({ expression: '', display: false }),
  bulletList: () => ({ html: '' }),
  orderedList: () => ({ html: '' }),
  sectionHeader: () => ({ tag: '', title: '', body: '' }),
  markdown: () => ({ content: '' }),
};

function generateId(): string {
  return `blk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useBlockEditor(initialBlocks?: BlockTuple[], options?: BlockEditorOptions) {
  const blocks = ref<EditorBlock[]>([]);
  const selectedBlockId = ref<string | null>(null);

  // --- Undo/Redo History ---
  const MAX_HISTORY = 50;
  const history: Array<{ blocks: EditorBlock[]; selectedBlockId: string | null }> = [];
  const historyIndex = ref(-1);
  const isRestoring = ref(false);

  function cloneBlocks(): EditorBlock[] {
    return blocks.value.map((b) => ({
      id: b.id,
      type: b.type,
      content: JSON.parse(JSON.stringify(b.content)),
    }));
  }

  /** Save current state snapshot to history (call AFTER mutation) */
  function pushHistory(): void {
    if (isRestoring.value) return;
    // Truncate any future states if we branched from an earlier point
    if (historyIndex.value < history.length - 1) {
      history.splice(historyIndex.value + 1);
    }
    history.push({ blocks: cloneBlocks(), selectedBlockId: selectedBlockId.value });
    if (history.length > MAX_HISTORY) {
      history.shift();
    }
    historyIndex.value = history.length - 1;
  }

  function undo(): boolean {
    if (historyIndex.value <= 0) return false;
    historyIndex.value--;
    const snapshot = history[historyIndex.value]!;
    isRestoring.value = true;
    blocks.value.splice(0, blocks.value.length, ...snapshot.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      content: JSON.parse(JSON.stringify(b.content)),
    })));
    selectedBlockId.value = snapshot.selectedBlockId;
    isRestoring.value = false;
    return true;
  }

  function redo(): boolean {
    if (historyIndex.value >= history.length - 1) return false;
    historyIndex.value++;
    const snapshot = history[historyIndex.value]!;
    isRestoring.value = true;
    blocks.value.splice(0, blocks.value.length, ...snapshot.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      content: JSON.parse(JSON.stringify(b.content)),
    })));
    selectedBlockId.value = snapshot.selectedBlockId;
    isRestoring.value = false;
    return true;
  }

  const canUndo = computed(() => historyIndex.value > 0);
  const canRedo = computed(() => historyIndex.value < history.length - 1);

  // Merge custom defaults with built-in defaults
  const defaults = options?.blockDefaults
    ? { ...BLOCK_DEFAULTS, ...options.blockDefaults }
    : BLOCK_DEFAULTS;

  // --- Init from BlockTuples ---
  function fromBlockTuples(tuples: BlockTuple[]): void {
    blocks.value = tuples.map(([type, content]) => ({
      id: generateId(),
      type,
      content: { ...content },
    }));
    // Reset history — loading new content is not an undoable operation
    history.splice(0, history.length);
    historyIndex.value = -1;
    pushHistory();
  }

  if (initialBlocks && initialBlocks.length > 0) {
    fromBlockTuples(initialBlocks);
  }

  // Capture initial state as first history entry
  pushHistory();

  // --- Serialize back to BlockTuples ---
  function toBlockTuples(): BlockTuple[] {
    return blocks.value.map((b) => [b.type, { ...b.content }]);
  }

  // --- Mutations ---

  function addBlock(type: string, attrs?: Record<string, unknown>, atIndex?: number): string {
    const blockDefaults = defaults[type]?.() ?? {};
    const block: EditorBlock = {
      id: generateId(),
      type,
      content: { ...blockDefaults, ...attrs },
    };

    if (atIndex !== undefined && atIndex >= 0 && atIndex <= blocks.value.length) {
      blocks.value.splice(atIndex, 0, block);
    } else {
      blocks.value.push(block);
    }

    selectedBlockId.value = block.id;
    pushHistory();
    return block.id;
  }

  function replaceBlock(id: string, newType: string, attrs?: Record<string, unknown>): string {
    const idx = blocks.value.findIndex((b) => b.id === id);
    if (idx === -1) return addBlock(newType, attrs);

    const blockDefaults = defaults[newType]?.() ?? {};
    const newBlock: EditorBlock = {
      id: generateId(),
      type: newType,
      content: { ...blockDefaults, ...attrs },
    };

    blocks.value.splice(idx, 1, newBlock);
    selectedBlockId.value = newBlock.id;
    pushHistory();
    return newBlock.id;
  }

  function removeBlock(id: string): void {
    const idx = blocks.value.findIndex((b) => b.id === id);
    if (idx === -1) return;
    blocks.value.splice(idx, 1);
    if (selectedBlockId.value === id) {
      selectedBlockId.value = null;
    }
    pushHistory();
  }

  function clearBlocks(): void {
    blocks.value.splice(0, blocks.value.length);
    selectedBlockId.value = null;
    pushHistory();
  }

  function updateBlock(id: string, content: Record<string, unknown>): void {
    const block = blocks.value.find((b) => b.id === id);
    if (block) {
      block.content = { ...block.content, ...content };
    }
  }

  function moveBlock(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= blocks.value.length) return;
    if (toIndex < 0 || toIndex >= blocks.value.length) return;
    const [moved] = blocks.value.splice(fromIndex, 1);
    blocks.value.splice(toIndex, 0, moved!);
    pushHistory();
  }

  function moveBlockUp(id: string): void {
    const idx = blocks.value.findIndex((b) => b.id === id);
    if (idx > 0) moveBlock(idx, idx - 1);
  }

  function moveBlockDown(id: string): void {
    const idx = blocks.value.findIndex((b) => b.id === id);
    if (idx < blocks.value.length - 1) moveBlock(idx, idx + 1);
  }

  function duplicateBlock(id: string): void {
    const idx = blocks.value.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const original = blocks.value[idx]!;
    const clone: EditorBlock = {
      id: generateId(),
      type: original.type,
      content: JSON.parse(JSON.stringify(original.content)),
    };
    blocks.value.splice(idx + 1, 0, clone);
    selectedBlockId.value = clone.id;
    pushHistory();
  }

  function selectBlock(id: string | null): void {
    selectedBlockId.value = id;
  }

  function getBlockIndex(id: string): number {
    return blocks.value.findIndex((b) => b.id === id);
  }

  const isEmpty = computed(() => blocks.value.length === 0);

  const selectedBlock = computed(() =>
    blocks.value.find((b) => b.id === selectedBlockId.value) ?? null,
  );

  return {
    blocks: readonly(blocks) as Readonly<Ref<EditorBlock[]>>,
    selectedBlockId: readonly(selectedBlockId),
    selectedBlock,
    isEmpty,
    addBlock,
    removeBlock,
    clearBlocks,
    updateBlock,
    moveBlock,
    moveBlockUp,
    moveBlockDown,
    duplicateBlock,
    replaceBlock,
    selectBlock,
    getBlockIndex,
    toBlockTuples,
    fromBlockTuples,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}

export type BlockEditor = ReturnType<typeof useBlockEditor>;
