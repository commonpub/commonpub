import { d as defineEventHandler, u as useDB, o as getCertificateByCode, p as createError } from '../../../nitro/nitro.mjs';
import { a as parseParams } from '../../../_/validate.mjs';
import 'drizzle-orm';
import 'unified';
import 'remark-parse';
import 'remark-gfm';
import 'remark-frontmatter';
import 'remark-rehype';
import 'rehype-stringify';
import 'rehype-slug';
import 'rehype-sanitize';
import 'yaml';
import 'drizzle-orm/pg-core';
import 'jose';
import 'node:fs';
import 'node:fs/promises';
import 'node:path';
import 'node:stream/promises';
import 'node:crypto';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:url';
import 'zod';
import 'drizzle-orm/node-postgres';
import 'pg';
import 'better-auth';
import 'better-auth/adapters/drizzle';
import 'better-auth/plugins';

const _code__get = defineEventHandler(async (event) => {
  const db = useDB();
  const { code } = parseParams(event, { code: "string" });
  const result = await getCertificateByCode(db, code);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: "Certificate not found" });
  }
  return result;
});

export { _code__get as default };
//# sourceMappingURL=_code_.get.mjs.map
