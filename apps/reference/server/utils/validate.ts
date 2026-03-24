/**
 * API route validation helpers.
 *
 * Eliminates Zod .safeParse + createError boilerplate from 42+ route files.
 */
import type { H3Event } from 'h3';
import type { ZodType } from 'zod';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*$/;

type ParamType = 'uuid' | 'slug' | 'string';

/** Parse and validate request body against a Zod schema. Throws 400 on failure. */
export async function parseBody<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  const body = await readBody(event);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }
  return parsed.data;
}

/** Parse and validate query string against a Zod schema. Throws 400 on failure. */
export function parseQueryParams<T>(event: H3Event, schema: ZodType<T>): T {
  const query = getQuery(event);
  const parsed = schema.safeParse(query);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid query parameters',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }
  return parsed.data;
}

/** Require a feature flag to be enabled. Throws 404 if disabled. */
export function requireFeature(feature: string): void {
  const config = useConfig();
  const flags = config.features as unknown as Record<string, boolean>;
  if (!flags[feature]) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }
}

/**
 * Extract and validate route parameters.
 *
 * @example
 * const { id } = parseParams(event, { id: 'uuid' });
 * const { slug } = parseParams(event, { slug: 'slug' });
 * const { siteSlug, pageId } = parseParams(event, { siteSlug: 'string', pageId: 'uuid' });
 */
export function parseParams<T extends Record<string, ParamType>>(
  event: H3Event,
  spec: T,
): { [K in keyof T]: string } {
  const result = {} as { [K in keyof T]: string };

  for (const [name, type] of Object.entries(spec)) {
    const value = getRouterParam(event, name);
    if (!value) {
      throw createError({ statusCode: 400, statusMessage: `Missing parameter: ${name}` });
    }

    if (type === 'uuid' && !UUID_REGEX.test(value)) {
      throw createError({ statusCode: 400, statusMessage: `Invalid ${name} format` });
    }
    if (type === 'slug' && !SLUG_REGEX.test(value)) {
      throw createError({ statusCode: 400, statusMessage: `Invalid ${name} format` });
    }

    (result as Record<string, string>)[name] = value;
  }

  return result;
}
