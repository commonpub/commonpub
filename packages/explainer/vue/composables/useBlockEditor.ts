/**
 * Block editor composable — manages an array of content blocks with full CRUD.
 * Blocks stored as { id, type, content }, serialized to/from BlockTuple format.
 */
import { ref, computed, readonly, type Ref } from 'vue';

type BlockTuple = [string, Record<string, unknown>];

export interface EditorBlock {
  id: string;
  type: string;
  content: Record<string, unknown>;
}

const BLOCK_DEFAULTS: Record<string, () => Record<string, unknown>> = {
  paragraph: () => ({ html: '' }),
  heading: () => ({ text: '', level: 2 }),
  code_block: () => ({ code: '', language: '', filename: '' }),
  image: () => ({ src: '', alt: '', caption: '' }),
  blockquote: () => ({ html: '', attribution: '' }),
  callout: () => ({ html: '', variant: 'info' }),
  embed: () => ({ url: '' }),
  horizontal_rule: () => ({}),
  quiz: () => ({ question: '', options: [], feedback: '' }),
  interactiveSlider: () => ({ label: '', min: 0, max: 100, step: 1, defaultValue: 50, feedback: [] }),
  checkpoint: () => ({ label: '' }),
  mathNotation: () => ({ expression: '', display: false }),
  sectionHeader: () => ({ tag: '', title: '', body: '' }),
  markdown: () => ({ content: '' }),
};

function generateId(): string {
  return `blk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useBlockEditor(initialBlocks?: BlockTuple[]) {
  const blocks = ref<EditorBlock[]>([]);
  const selectedBlockId = ref<string | null>(null);

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

  function toBlockTuples(): BlockTuple[] {
    return blocks.value.map((b) => [b.type, { ...b.content }]);
  }

  function addBlock(type: string, attrs?: Record<string, unknown>, atIndex?: number): string {
    const defaults = BLOCK_DEFAULTS[type]?.() ?? {};
    const block: EditorBlock = { id: generateId(), type, content: { ...defaults, ...attrs } };
    if (atIndex !== undefined && atIndex >= 0 && atIndex <= blocks.value.length) {
      blocks.value.splice(atIndex, 0, block);
    } else {
      blocks.value.push(block);
    }
    selectedBlockId.value = block.id;
    return block.id;
  }

  function replaceBlock(id: string, newType: string, attrs?: Record<string, unknown>): string {
    const idx = blocks.value.findIndex((b) => b.id === id);
    if (idx === -1) return addBlock(newType, attrs);
    const defaults = BLOCK_DEFAULTS[newType]?.() ?? {};
    const newBlock: EditorBlock = { id: generateId(), type: newType, content: { ...defaults, ...attrs } };
    blocks.value.splice(idx, 1, newBlock);
    selectedBlockId.value = newBlock.id;
    return newBlock.id;
  }

  function removeBlock(id: string): void {
    const idx = blocks.value.findIndex((b) => b.id === id);
    if (idx === -1) return;
    blocks.value.splice(idx, 1);
    if (selectedBlockId.value === id) selectedBlockId.value = null;
  }

  function clearBlocks(): void {
    blocks.value.splice(0, blocks.value.length);
    selectedBlockId.value = null;
  }

  function updateBlock(id: string, content: Record<string, unknown>): void {
    const block = blocks.value.find((b) => b.id === id);
    if (block) block.content = { ...block.content, ...content };
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
    const clone: EditorBlock = { id: generateId(), type: original.type, content: JSON.parse(JSON.stringify(original.content)) };
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
  const selectedBlock = computed(() => blocks.value.find((b) => b.id === selectedBlockId.value) ?? null);

  return {
    blocks: readonly(blocks) as Readonly<Ref<EditorBlock[]>>,
    selectedBlockId: readonly(selectedBlockId),
    selectedBlock,
    isEmpty,
    addBlock, removeBlock, clearBlocks, updateBlock,
    moveBlock, moveBlockUp, moveBlockDown, duplicateBlock, replaceBlock,
    selectBlock, getBlockIndex,
    toBlockTuples, fromBlockTuples,
  };
}

export type BlockEditor = ReturnType<typeof useBlockEditor>;
