import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getContentBySlug } from '$lib/server/content';
import {
  generateExplainerHtml,
  type ExplainerSection,
  type ExportOptions,
} from '@commonpub/explainer';

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.config.features.explainers) {
    error(404, 'Explainer system is not enabled');
  }

  if (!locals.user) {
    error(401, 'Authentication required');
  }

  const item = await getContentBySlug(locals.db, params.slug, locals.user.id);

  if (!item) {
    error(404, 'Explainer not found');
  }

  if (item.type !== 'explainer') {
    error(404, 'Explainer not found');
  }

  // Only author or admin can export
  if (item.author.id !== locals.user.id) {
    error(403, 'Not authorized to export this explainer');
  }

  const sections = (item.sections ?? []) as ExplainerSection[];

  const options: ExportOptions = {
    includeAnimations: false,
    inlineImages: false,
    theme: 'base',
    title: item.title,
    description: item.description ?? undefined,
    author: item.author.displayName ?? item.author.username,
  };

  const html = generateExplainerHtml(sections, options);
  const filename = `${item.slug}.html`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache',
    },
  });
};
