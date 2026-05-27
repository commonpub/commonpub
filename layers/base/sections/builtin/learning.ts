/**
 * Built-in section definition: learning.
 *
 * Phase 1c addition (session 159) — learning paths grid. Server-fetches
 * `/api/learn?limit=N` and renders a responsive grid of cards (title,
 * description, difficulty + duration, enrollment count).
 *
 * Feature-gated on `features.learning`. Behaves like editorial /
 * content-feed structurally — a discoverable feed of an entity type.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import SectionLearning from '../../components/sections/SectionLearning.vue';

const configSchema = z.object({
  heading: z.string().max(120).default('Learning Paths'),
  limit: z.number().int().min(1).max(12).default(6),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(3),
});

export const learningSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'learning',
  name: 'Learning paths',
  description: 'Grid of learning paths with enrollment + difficulty (feature-gated)',
  icon: 'fa-graduation-cap',
  category: 'data',
  status: 'stable',
  // Palette gate — see hubs.ts for the rationale.
  featureGate: 'learning',
  configSchema,
  defaultConfig: { heading: 'Learning Paths', limit: 6, columns: 3 },
  schemaVersion: 1,
  component: SectionLearning,
  minColSpan: 6,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
