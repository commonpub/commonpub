import { d as defineEventHandler, G as useConfig, u as useDB, k as getPlatformStats, ch as buildNodeInfoResponse } from '../../nitro/nitro.mjs';
import 'drizzle-orm';
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

const _2_1 = defineEventHandler(async () => {
  var _a, _b;
  const config = useConfig();
  const db = useDB();
  let userCount = 0;
  let localPostCount = 0;
  try {
    const stats = await getPlatformStats(db);
    userCount = (_a = stats.userCount) != null ? _a : 0;
    localPostCount = (_b = stats.contentCount) != null ? _b : 0;
  } catch {
  }
  return buildNodeInfoResponse({
    config,
    version: "0.0.1",
    userCount,
    activeMonthCount: userCount,
    localPostCount
  });
});

export { _2_1 as default };
//# sourceMappingURL=2.1.mjs.map
