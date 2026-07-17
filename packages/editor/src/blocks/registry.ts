import type { BlockDefinition, BlockTuple } from './types.js';
import {
  textContentSchema,
  headingContentSchema,
  codeContentSchema,
  imageContentSchema,
  quoteContentSchema,
  calloutContentSchema,
  galleryContentSchema,
  videoContentSchema,
  embedContentSchema,
  markdownContentSchema,
  dividerContentSchema,
  tableContentSchema,
  partsListContentSchema,
  buildStepContentSchema,
  toolListContentSchema,
  downloadsContentSchema,
  quizContentSchema,
  interactiveSliderContentSchema,
  checkpointContentSchema,
  mathNotationContentSchema,
  sectionHeaderContentSchema,
} from './schemas.js';

const registry = new Map<string, BlockDefinition>();

/** Register a block definition */
export function registerBlock(definition: BlockDefinition): void {
  if (registry.has(definition.type)) {
    throw new Error(`Block type "${definition.type}" is already registered`);
  }
  registry.set(definition.type, definition);
}

/** Look up a block definition by type */
export function lookupBlock(type: string): BlockDefinition | undefined {
  return registry.get(type);
}

/** List all registered block definitions */
export function listBlocks(): BlockDefinition[] {
  return Array.from(registry.values());
}

/** Validate a single block tuple against its registered schema */
export function validateBlock(tuple: BlockTuple): { success: boolean; error?: string } {
  const [type, content] = tuple;
  const definition = registry.get(type);
  if (!definition) {
    return { success: false, error: `Unknown block type: "${type}"` };
  }
  const result = definition.schema.safeParse(content);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }
  return { success: true };
}

/** Clear the registry (for testing) */
export function clearRegistry(): void {
  registry.clear();
}

/** Register all core block types */
export function registerCoreBlocks(): void {
  const coreBlocks: BlockDefinition[] = [
    { type: 'text', schema: textContentSchema, label: 'Text' },
    { type: 'heading', schema: headingContentSchema, label: 'Heading' },
    { type: 'code', schema: codeContentSchema, label: 'Code' },
    { type: 'image', schema: imageContentSchema, label: 'Image' },
    { type: 'quote', schema: quoteContentSchema, label: 'Quote' },
    { type: 'callout', schema: calloutContentSchema, label: 'Callout' },
    { type: 'gallery', schema: galleryContentSchema, label: 'Gallery' },
    { type: 'video', schema: videoContentSchema, label: 'Video' },
    { type: 'embed', schema: embedContentSchema, label: 'Embed' },
    { type: 'markdown', schema: markdownContentSchema, label: 'Markdown' },
    { type: 'divider', schema: dividerContentSchema, label: 'Divider' },
    { type: 'table', schema: tableContentSchema, label: 'Table' },
    { type: 'partsList', schema: partsListContentSchema, label: 'Parts List' },
    { type: 'buildStep', schema: buildStepContentSchema, label: 'Build Step' },
    { type: 'toolList', schema: toolListContentSchema, label: 'Tool List' },
    { type: 'downloads', schema: downloadsContentSchema, label: 'Downloads' },
    { type: 'quiz', schema: quizContentSchema, label: 'Quiz' },
    { type: 'interactiveSlider', schema: interactiveSliderContentSchema, label: 'Interactive Slider' },
    { type: 'checkpoint', schema: checkpointContentSchema, label: 'Checkpoint' },
    { type: 'mathNotation', schema: mathNotationContentSchema, label: 'Math Notation' },
    { type: 'sectionHeader', schema: sectionHeaderContentSchema, label: 'Section Header' },
  ];

  for (const block of coreBlocks) {
    if (!registry.has(block.type)) {
      registerBlock(block);
    }
  }
}
