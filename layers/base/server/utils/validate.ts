/**
 * API route validation helpers.
 *
 * Eliminates Zod .safeParse + createError boilerplate from 42+ route files.
 */
import type { H3Event } from 'h3';
import type { ZodType } from 'zod';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*$/;

/** True when `value` is a syntactically-valid UUID. Use to guard untrusted
 *  query/body values that feed a uuid SQL bind (a non-uuid string reaching
 *  the bind throws an unhandled 500). Router params should use `parseParams`. */
export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Hard ceiling on JSON request bodies (10 MB). Every JSON write route funnels
 * through `parseBody`, so this one guard caps them all. It rejects on the
 * `Content-Length` header *before* `readBody` buffers + `JSON.parse`s the
 * payload — both synchronous, event-loop-blocking, memory-spiking operations.
 * A pathological body (e.g. a giant blob pasted/scripted into a write) is what
 * can stall or OOM-restart the server; this stops it at the door.
 *
 * The ceiling is deliberately generous, NOT tight: some content bodies are
 * legitimately large and *unbounded* at the schema layer (`content` is
 * `z.unknown()` for articles/projects/docs), so a low cap would reject real
 * saves. 10MB is impossible for a single legitimate document (~6000 pages of
 * text) yet still kills the truly catastrophic payload. The per-field Zod
 * `.max()` caps (e.g. contest text at `CONTEST_RICH_TEXT_MAX`) are the real
 * semantic bound *within* this envelope. Multipart uploads use
 * `readMultipartFormData` (not `parseBody`) and are bounded separately by
 * `validateUpload`, so they are unaffected.
 */
const MAX_JSON_BODY_BYTES = 10_000_000;

type ParamType = 'uuid' | 'slug' | 'string';

/** Parse and validate request body against a Zod schema. Throws 400 on failure, 413 if oversized. */
export async function parseBody<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  // Fast-path: reject on the declared Content-Length before buffering anything.
  const declaredLength = Number(getRequestHeader(event, 'content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Payload too large' });
  }

  // The header is advisory and absent on chunked (Transfer-Encoding: chunked)
  // requests — a client can stream an unbounded body with no Content-Length and
  // slip past the fast-path. Read the RAW body once and enforce the cap on the
  // ACTUAL buffered byte size before JSON.parse. `readBody` reuses this cached
  // raw body, so there is no double read.
  const raw: string | Buffer | undefined = await readRawBody(event, false);
  if (raw != null) {
    const size = typeof raw === 'string' ? Buffer.byteLength(raw) : raw.length;
    if (size > MAX_JSON_BODY_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'Payload too large' });
    }
  }

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
