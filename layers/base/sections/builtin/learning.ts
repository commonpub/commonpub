/**
 * Built-in section definition: learning.
 *
 * Phase 1c addition (session 159) — learning paths grid. Server-fetches
 * `/api/learn?limit=N` and renders a responsive grid of cards.
 *
 * Schema lives in `@commonpub/schema/sectionConfigs` (session 161 move).
 */
import type { SectionDefinition } from '@commonpub/ui';
import { learningConfigSchema, type LearningConfig } from '@commonpub/schema';
import SectionLearning from '../../components/sections/SectionLearning.vue';

export const learningSection: SectionDefinition<LearningConfig> = {
  type: 'learning',
  name: 'Learning paths',
  description: 'Grid of learning paths with enrollment + difficulty (feature-gated)',
  icon: 'fa-graduation-cap',
  category: 'data',
  status: 'stable',
  // Palette gate — see hubs.ts for the rationale.
  featureGate: 'learning',
  configSchema: learningConfigSchema,
  defaultConfig: { heading: 'Learning Paths', limit: 6, columns: 3 },
  schemaVersion: 1,
  component: SectionLearning,
  minColSpan: 6,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
