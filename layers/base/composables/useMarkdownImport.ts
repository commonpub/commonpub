/**
 * Markdown import composable — converts markdown to blocks and handles image uploads.
 */
import { markdownToBlockTuples } from '@commonpub/editor';
import type { BlockTuple } from '@commonpub/editor';
import type { BlockEditor } from './useBlockEditor';

export function useMarkdownImport(blockEditor: BlockEditor) {
  const importing = ref(false);
  const progress = ref({ total: 0, uploaded: 0 });

  async function importMarkdown(md: string, mode: 'append' | 'replace' = 'append'): Promise<void> {
    importing.value = true;
    progress.value = { total: 0, uploaded: 0 };

    try {
      const tuples = markdownToBlockTuples(md);
      if (!tuples.length) return;

      const editor = blockEditor;

      if (mode === 'replace') {
        editor.clearBlocks();
      }

      // Insert blocks sequentially, tracking position for correct ordering
      let insertAt: number | undefined;
      if (mode === 'append') {
        insertAt = editor.blocks.value.length;
      }

      for (const [type, content] of tuples) {
        editor.addBlock(type, content as Record<string, unknown>, insertAt);
        if (insertAt !== undefined) insertAt++;
      }

      // Find image blocks with remote URLs and upload them
      const imageBlocks = [...editor.blocks.value].filter(
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
