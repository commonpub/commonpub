import type { ExplainerSection, ExplainerSectionType, SectionDefinition } from '../types.js';
import {
  textSectionSchema,
  interactiveSectionSchema,
  quizSectionSchema,
  checkpointSectionSchema,
} from '../schemas.js';

const registry = new Map<string, SectionDefinition>();

/** Register a section type definition */
export function registerSectionType(definition: SectionDefinition): void {
  if (registry.has(definition.type)) {
    throw new Error(`Section type "${definition.type}" is already registered`);
  }
  registry.set(definition.type, definition);
}

/** Look up a section type definition */
export function lookupSectionType(type: string): SectionDefinition | undefined {
  return registry.get(type);
}

/** List all registered section type definitions */
export function listSectionTypes(): SectionDefinition[] {
  return Array.from(registry.values());
}

/** Validate a section against its registered schema */
export function validateSection(section: ExplainerSection): { success: boolean; error?: string } {
  const definition = registry.get(section.type);
  if (!definition) {
    return { success: false, error: `Unknown section type: "${section.type}"` };
  }
  const result = definition.schema.safeParse(section);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }
  return { success: true };
}

/** Clear the registry (for testing) */
export function clearRegistry(): void {
  registry.clear();
}

/** Register all core section types */
export function registerCoreSectionTypes(): void {
  const coreTypes: SectionDefinition[] = [
    { type: 'text', schema: textSectionSchema, label: 'Text' },
    { type: 'interactive', schema: interactiveSectionSchema, label: 'Interactive' },
    { type: 'quiz', schema: quizSectionSchema, label: 'Quiz' },
    { type: 'checkpoint', schema: checkpointSectionSchema, label: 'Checkpoint' },
  ];

  for (const def of coreTypes) {
    if (!registry.has(def.type)) {
      registerSectionType(def);
    }
  }
}
