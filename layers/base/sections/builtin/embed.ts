/**
 * Built-in section definition: embed.
 *
 * Phase 6b addition (session 159). Generic external embed for content
 * that doesn't fit video — Twitter/X, GitHub gists, CodePen, Loom,
 * Glitch, Figma, etc. Renders as a sandboxed iframe.
 *
 * Differs from `video`:
 *   - `video` is for media playback (specific YouTube/Vimeo rewriting)
 *   - `embed` is generic; URL passed through (post-allowlist check)
 *
 * Differs from `custom-html`:
 *   - `custom-html` accepts arbitrary HTML (admin-only, unsanitised)
 *   - `embed` accepts a URL only; iframe sandbox isolates the embedded
 *     content from the parent page
 *
 * Domain allowlist: instance operators can override `embedAllowlist`
 * (a string of comma-separated hostnames) via `instance_settings`. Default
 * covers the common providers. Unallowed hosts trip the renderer's
 * "domain not allowed" error placeholder + log.
 */
import { z } from 'zod';
import type { SectionDefinition } from '@commonpub/ui';
import SectionEmbed from '../../components/sections/SectionEmbed.vue';

const SAFE_URL = /^https?:\/\//i;

const configSchema = z.object({
  heading: z.string().max(120).default(''),
  // Empty allowed for defaultConfig; non-empty must be http(s) URL.
  src: z.string().max(2048).refine((s) => s === '' || SAFE_URL.test(s), {
    message: 'src must be an http(s) URL',
  }).default(''),
  title: z.string().max(240).default(''),
  height: z.number().int().min(120).max(2000).default(450),
});

export const embedSection: SectionDefinition<z.infer<typeof configSchema>> = {
  type: 'embed',
  name: 'Embed',
  description: 'Generic iframe — tweets, gists, CodePen, Loom, Figma, etc.',
  icon: 'fa-square-arrow-up-right',
  category: 'content',
  status: 'beta', // sandbox policy is still being tuned per provider; marking beta
  configSchema,
  defaultConfig: {
    heading: '',
    src: '',
    title: '',
    height: 450,
  },
  schemaVersion: 1,
  component: SectionEmbed,
  minColSpan: 6,
  maxColSpan: 12,
  defaultColSpan: 12,
  resizable: true,
};
