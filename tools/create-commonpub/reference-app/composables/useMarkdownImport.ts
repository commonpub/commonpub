/**
 * Markdown import composable — converts markdown to blocks and handles image uploads.
 */
import { markdownToBlockTuples } from '@commonpub/editor';
import type { BlockTuple } from '@commonpub/editor';

interface BlockEditor {
  blocks: { id: string; type: string; content: Record<string, unknown> }[];
  addBlock: (type: string, content: Record<string, unknown>, afterId?: string) => void;
  updateBlock: (id: string, content: Record<string, unknown>) => void;
  clearBlocks: () => void;
}

export function useMarkdownImport(blockEditor: Ref<BlockEditor> | BlockEditor) {
  const importing = ref(false);
  const progress = ref({ total: 0, uploaded: 0 });

  async function importMarkdown(md: string, mode: 'append' | 'replace' = 'append'): Promise<void> {
    importing.value = true;
    progress.value = { total: 0, uploaded: 0 };

    try {
      const blocks = markdownToBlockTuples(md);
      if (!blocks.length) return;

      const editor = unref(blockEditor);

      if (mode === 'replace') {
        editor.clearBlocks();
      }

      // Insert blocks
      let lastBlockId: string | undefined;
      if (mode === 'append' && editor.blocks.length > 0) {
        lastBlockId = editor.blocks[editor.blocks.length - 1]!.id;
      }

      for (const [type, content] of blocks) {
        editor.addBlock(type, content as Record<string, unknown>, lastBlockId);
        // Get the ID of the just-added block for sequential insertion
        lastBlockId = editor.blocks[editor.blocks.length - 1]?.id;
      }

      // Find image blocks with remote URLs and upload them
      const imageBlocks = editor.blocks.filter(
        b => b.type === 'image' && b.content.src && isRemoteUrl(b.content.src as string),
      );

      if (imageBlocks.length > 0) {
        progress.value.total = imageBlocks.length;

        for (const block of imageBlocks) {
          try {
            const result = await $fetch<{ url: string }>('/api/files/upload-from-url', {
              method: 'POST',
              body: { url: block.content.src, purpose: 'content' },
            });
            editor.updateBlock(block.id, { ...block.content, src: result.url });
          } catch {
            // Non-fatal — remote URL stays in place
            console.warn(`[md-import] Failed to upload image: ${block.content.src}`);
          }
          progress.value.uploaded++;
        }
      }
    } finally {
      importing.value = false;
    }
  }

  async function importFile(file: File, mode: 'append' | 'replace' = 'append'): Promise<void> {
    const text = await file.text();
    return importMarkdown(text, mode);
  }

  return { importing, progress, importMarkdown, importFile };
}

function isRemoteUrl(url: string): boolean {
  if (!url.startsWith('http')) return false;
  // Skip URLs that are already on our S3 bucket
  if (url.includes('digitaloceanspaces.com')) return false;
  return true;
}
