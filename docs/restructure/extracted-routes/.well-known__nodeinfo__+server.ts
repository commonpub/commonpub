import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildNodeInfoWellKnown } from '@commonpub/protocol';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.config.features.federation) {
    error(404, 'Federation is not enabled');
  }

  const response = buildNodeInfoWellKnown(locals.config.instance.domain);
  return json(response);
};
