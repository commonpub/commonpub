import { W as getQuery, p as createError, X as getRouterParam, A as readBody } from '../nitro/nitro.mjs';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*$/;
async function parseBody(event, schema) {
  const body = await readBody(event);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Validation failed",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return parsed.data;
}
function parseQueryParams(event, schema) {
  const query = getQuery(event);
  const parsed = schema.safeParse(query);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid query parameters",
      data: { errors: parsed.error.flatten().fieldErrors }
    });
  }
  return parsed.data;
}
function parseParams(event, spec) {
  const result = {};
  for (const [name, type] of Object.entries(spec)) {
    const value = getRouterParam(event, name);
    if (!value) {
      throw createError({ statusCode: 400, statusMessage: `Missing parameter: ${name}` });
    }
    if (type === "uuid" && !UUID_REGEX.test(value)) {
      throw createError({ statusCode: 400, statusMessage: `Invalid ${name} format` });
    }
    if (type === "slug" && !SLUG_REGEX.test(value)) {
      throw createError({ statusCode: 400, statusMessage: `Invalid ${name} format` });
    }
    result[name] = value;
  }
  return result;
}

export { parseParams as a, parseBody as b, parseQueryParams as p };
//# sourceMappingURL=validate.mjs.map
