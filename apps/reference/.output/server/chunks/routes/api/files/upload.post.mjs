import { d as defineEventHandler, u as useDB, am as readMultipartFormData, f as createError, an as validateUpload, ao as isProcessableImage, ap as processImage, aq as generateStorageKey, ak as files, al as createStorageFromEnv } from '../../../nitro/nitro.mjs';
import { a as requireAuth } from '../../../_/auth.mjs';
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

let storage = null;
function getStorage() {
  if (!storage) storage = createStorageFromEnv();
  return storage;
}
const upload_post = defineEventHandler(async (event) => {
  var _a, _b;
  const db = useDB();
  const user = requireAuth(event);
  const formData = await readMultipartFormData(event);
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No file uploaded" });
  }
  const file = formData[0];
  const filename = file.filename || `upload-${Date.now()}`;
  const mimeType = file.type || "application/octet-stream";
  const sizeBytes = file.data.length;
  const purpose = ((_a = formData.find((f) => f.name === "purpose")) == null ? void 0 : _a.data.toString()) || "content";
  const validation = validateUpload(mimeType, sizeBytes, purpose);
  if (!validation.valid) {
    throw createError({ statusCode: 400, statusMessage: (_b = validation.error) != null ? _b : "Invalid upload" });
  }
  const adapter = getStorage();
  let publicUrl;
  let storageKey;
  let width = null;
  let height = null;
  let variants = null;
  if (isProcessableImage(mimeType)) {
    const processed = await processImage(file.data, filename, purpose, adapter);
    publicUrl = processed.originalUrl;
    storageKey = processed.originalKey;
    width = processed.width;
    height = processed.height;
    if (processed.variants.length > 0) {
      variants = {};
      for (const v of processed.variants) {
        variants[v.name] = v.url;
      }
    }
  } else {
    storageKey = generateStorageKey(filename, purpose);
    publicUrl = await adapter.upload(storageKey, file.data, mimeType);
  }
  const [row] = await db.insert(files).values({
    uploaderId: user.id,
    filename: storageKey,
    originalName: filename,
    mimeType,
    sizeBytes,
    storageKey,
    publicUrl,
    purpose,
    width,
    height
  }).returning();
  return {
    id: row.id,
    filename: row.filename,
    originalName: filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    url: publicUrl,
    width,
    height,
    variants,
    purpose: row.purpose
  };
});

export { upload_post as default };
//# sourceMappingURL=upload.post.mjs.map
