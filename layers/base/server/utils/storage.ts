import { createStorageFromEnv } from '@commonpub/server';
import type { StorageAdapter } from '@commonpub/server';

// Process-wide singleton storage adapter. Every file route previously kept its
// own identical `let storage; getStorage()` lazy-init block — this consolidates
// them so the adapter is created once per process, in one place.
let storage: StorageAdapter | null = null;

/** The configured file storage adapter (S3/Spaces in prod, local in dev), lazily
 *  created once. Named `useFileStorage` (not `useStorage`) to avoid shadowing
 *  Nitro's built-in `useStorage` KV auto-import. */
export function useFileStorage(): StorageAdapter {
  if (!storage) storage = createStorageFromEnv();
  return storage;
}
