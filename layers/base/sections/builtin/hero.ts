/**
 * Built-in section definition: hero.
 *
 * Phase 1c starter. Three variants — `default` (left-aligned with grid
 * backdrop), `compact` (narrow with no backdrop), `centered` (centered
 * content). Up to two CTAs each with their own variant.
 *
 * NOT contest-aware (the existing HomepageHeroSection has dispatch
 * logic for the live-contest hero — that responsibility moves to a
 * future `contest-feature` data section in Phase 6b).
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import SectionHero from '../../components/sections/SectionHero.vue';

const ctaSchema = z.object({
  label: z.string().min(1).max(80),
  href: z.string().min(1).max(2048),
  variant: z.enum(['primary', 'secondary']).default('primary'),
});

const configSchema = z.object({
  variant: z.enum(['default', 'compact', 'centered']).default('default'),
  eyebrow: z.string().max(120).default(''),
  title: z.string().min(1).max(240).default('Welcome'),
  subtitle: z.string().max(800).default(''),
  // Capped at 2 — visual + a11y guidance: more than two competing CTAs
  // dilute the call-to-action and read as a button bar instead.
  ctas: z.array(ctaSchema).max(2).default([]),
});

export const heroSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'hero',
  name: 'Hero',
  description: 'Banner with title, subtitle, and up to two CTAs',
  icon: 'fa-bullhorn',
  category: 'layout',
  status: 'stable',
  configSchema,
  defaultConfig: {
    variant: 'default',
    eyebrow: '',
    title: 'Welcome',
    subtitle: '',
    ctas: [],
  },
  schemaVersion: 1,
  component: SectionHero,
  // Hero breaks at <6 cols (CTA wrap looks awful); 12 is the canonical use
  minColSpan: 6,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
