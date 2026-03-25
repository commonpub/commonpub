/**
 * Block editor composable — manages an array of content blocks with full CRUD operations.
 * Blocks are stored as { id, type, content } and serialized to/from BlockTuple format for persistence.
 */
import type { BlockTuple } from '@commonpub/editor';

export interface EditorBlock {
  id: string;
  type: string;
  content: Record<string, unknown>;
}

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
  buildStep: () => ({ stepNumber: 1, instructions: '', image: '', time: '' }),
  toolList: () => ({ tools: [] }),
  downloads: () => ({ files: [] }),
  quiz: () => ({ question: '', options: [], feedback: '' }),
  interactiveSlider: () => ({ label: '', min: 0, max: 100, step: 1, defaultValue: 50, states: [] }),
  checkpoint: () => ({ message: '' }),
  mathNotation: () => ({ expression: '', display: false }),
  bulletList: () => ({ html: '' }),
  orderedList: () => ({ html: '' }),
  sectionHeader: () => ({ tag: '', title: '', body: '' }),
};

function generateId(): string {
  return `blk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useBlockEditor(initialBlocks?: BlockTuple[]) {
  const blocks = ref<EditorBlock[]>([]);
  const selectedBlockId = ref<string | null>(null);

  // --- Init from BlockTuples ---
  function fromBlockTuples(tuples: BlockTuple[]): void {
    blocks.value = tuples.map(([type, content]) => ({
      id: generateId(),
      type,
      content: { ...content },
    }));
  }

  if (initialBlocks && initialBlocks.length > 0) {
    fromBlockTuples(initialBlocks);
  }

  // --- Serialize back to BlockTuples ---
  function toBlockTuples(): BlockTuple[] {
    return blocks.value.map((b) => [b.type, { ...b.content }]);
  }

  // --- Mutations ---

  function addBlock(type: string, attrs?: Record<string, unknown>, atIndex?: number): string {
    const defaults = BLOCK_DEFAULTS[type]?.() ?? {};
    const block: EditorBlock = {
      id: generateId(),
      type,
      content: { ...defaults, ...attrs },
    };

    if (atIndex !== undefined && atIndex >= 0 && atIndex <= blocks.value.length) {
      blocks.value.splice(atIndex, 0, block);
    } else {
      blocks.value.push(block);
    }

    selectedBlockId.value = block.id;
    return block.id;
  }

  /** Replace a block with a new block type (used by slash command) */
  function replaceBlock(id: string, newType: string, attrs?: Record<string, unknown>): string {
    const idx = blocks.value.findIndex((b) => b.id === id);
    if (idx === -1) return addBlock(newType, attrs);

    const defaults = BLOCK_DEFAULTS[newType]?.() ?? {};
    const newBlock: EditorBlock = {
      id: generateId(),
      type: newType,
      content: { ...defaults, ...attrs },
    };

    blocks.value.splice(idx, 1, newBlock);
    selectedBlockId.value = newBlock.id;
    return newBlock.id;
  }

  function removeBlock(id: string): void {
    const idx = blocks.value.findIndex((b) => b.id === id);
    if (idx === -1) return;
    blocks.value.splice(idx, 1);
    if (selectedBlockId.value === id) {
      selectedBlockId.value = null;
    }
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
  };
}

export type BlockEditor = ReturnType<typeof useBlockEditor>;
