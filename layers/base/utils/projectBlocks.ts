/**
 * projectBlocks — pure parsers that turn a project's BlockTuple content into
 * the structured shapes the ProjectView tabs render (BOM parts, build steps,
 * code snippets, download files, table-of-contents headings).
 *
 * Extracted verbatim from ProjectView.vue's inline computeds (session 206) so
 * the parsing is unit-tested independently of the component. Each function
 * accepts the raw `content` value (which may be undefined, a legacy markdown
 * string, or a BlockTuple[]) and returns [] for anything that is not an array
 * of blocks — matching the component's original guards exactly.
 */

export interface PartItem {
  name: string;
  quantity: number;
  productId?: string;
  notes?: string;
}

export interface BuildStep {
  number: number;
  title: string;
  children: Array<[string, Record<string, unknown>]>;
  time?: string;
}

export interface CodeSnippet {
  language: string;
  filename: string;
  code: string;
}

export interface FileItem {
  name: string;
  url: string;
  size?: string;
}

export interface TocEntry {
  id: string;
  text: string;
  level: number;
}

type Block = [string, Record<string, unknown>];

/** Narrow raw content to a block array, or [] when it is not one. */
function asBlocks(blocks: unknown): Block[] {
  return Array.isArray(blocks) ? (blocks as Block[]) : [];
}

/** Slugify heading text into a stable anchor id (lowercase, dash-separated). */
export function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Flatten every `partsList` block into a BOM parts list. */
export function extractParts(blocks: unknown): PartItem[] {
  const items: PartItem[] = [];
  for (const [type, data] of asBlocks(blocks)) {
    if (type === 'partsList' && Array.isArray(data.parts)) {
      for (const part of data.parts as Array<Record<string, unknown>>) {
        items.push({
          name: (part.name as string) || 'Unknown',
          quantity: (part.qty as number) ?? (part.quantity as number) ?? 1,
          productId: part.productId as string | undefined,
          notes: (part.notes as string) || '',
        });
      }
    }
  }
  return items;
}

/** Collect `buildStep` blocks, migrating the legacy instructions+image shape into children. */
export function extractBuildSteps(blocks: unknown): BuildStep[] {
  const steps: BuildStep[] = [];
  let stepNum = 0;
  for (const [type, data] of asBlocks(blocks)) {
    if (type !== 'buildStep') continue;
    stepNum++;
    // Migrate old format (instructions + image) to children
    let children: Array<[string, Record<string, unknown>]> = [];
    if (data.children && Array.isArray(data.children) && data.children.length > 0) {
      children = data.children as Array<[string, Record<string, unknown>]>;
    } else {
      const instructions = data.instructions as string | undefined;
      if (instructions && instructions.trim()) {
        const html = instructions.startsWith('<') ? instructions : `<p>${instructions}</p>`;
        children.push(['paragraph', { html }]);
      }
      const image = data.image as string | undefined;
      if (image && image.trim()) {
        children.push(['image', { src: image, alt: `Step ${stepNum}`, caption: '' }]);
      }
    }
    steps.push({
      number: (data.stepNumber as number) || stepNum,
      title: (data.title as string) || `Step ${stepNum}`,
      children,
      time: data.time as string | undefined,
    });
  }
  return steps;
}

/** Collect `code_block`/`codeBlock` snippets for the Code tab. */
export function extractCodeBlocks(blocks: unknown): CodeSnippet[] {
  const snippets: CodeSnippet[] = [];
  for (const [type, data] of asBlocks(blocks)) {
    if (type === 'code_block' || type === 'codeBlock') {
      snippets.push({
        language: (data.language as string) || '',
        filename: (data.filename as string) || '',
        code: (data.code as string) || '',
      });
    }
  }
  return snippets;
}

/** Flatten every `downloads` block into a flat file list for the Files tab. */
export function extractDownloadFiles(blocks: unknown): FileItem[] {
  const files: FileItem[] = [];
  for (const [type, data] of asBlocks(blocks)) {
    if (type === 'downloads' && Array.isArray(data.files)) {
      for (const file of data.files as Array<Record<string, unknown>>) {
        files.push({
          name: (file.name as string) || 'Unknown',
          url: (file.url as string) || '',
          size: (file.size as string) || '',
        });
      }
    }
  }
  return files;
}

/** Build a table of contents from `heading` blocks (HTML stripped, slugified ids). */
export function extractTocEntries(blocks: unknown): TocEntry[] {
  const entries: TocEntry[] = [];
  for (const [type, data] of asBlocks(blocks)) {
    if (type === 'heading' && data.text) {
      const text = String(data.text).replace(/<[^>]+>/g, '');
      if (text.trim()) {
        entries.push({
          id: headingSlug(text),
          text: text.trim(),
          level: (data.level as number) ?? 2,
        });
      }
    }
  }
  return entries;
}
