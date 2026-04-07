export interface EditorBlock {
  id: string;
  type: string;
  content: Record<string, unknown>;
}

export interface BlockEditorOptions {
  /** Override default content values per block type */
  blockDefaults?: Record<string, () => Record<string, unknown>>;
}

// BlockEditor type is derived from the composable's return type — see useBlockEditor.ts
// Re-exported from the composable module to ensure type compatibility

export interface BlockTypeDef {
  type: string;
  label: string;
  icon: string;
  description?: string;
  attrs?: Record<string, unknown>;
}

export interface BlockTypeGroup {
  name: string;
  blocks: BlockTypeDef[];
}

export interface BlockDef {
  type: string;
  label: string;
  icon: string;
  description?: string;
  attrs?: Record<string, unknown>;
}

export interface BlockGroup {
  name: string;
  variant?: string;
  blocks: BlockDef[];
}
