import type { BlockTuple } from '@commonpub/editor';

export interface ImportResult {
  title: string;
  description: string;
  coverImageUrl: string | null;
  content: BlockTuple[];
  tags: string[];
  /** true if only partial content could be extracted */
  partial: boolean;
  /** platform-specific metadata */
  meta: Record<string, unknown>;
}

export interface PlatformHandler {
  match(url: URL): boolean;
  import(url: URL, html: string): Promise<ImportResult>;
}
