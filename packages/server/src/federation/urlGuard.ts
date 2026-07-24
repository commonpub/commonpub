/**
 * Scheme-guard a URL arriving from a remote instance (federated objects bypass
 * local zod validation). A hostile instance can ship a `javascript:`/`data:` URL
 * that becomes stored XSS the moment it is rendered into an `:href`/`:src`. Returns
 * the value only if it is an http(s) URL, else null. Shared by every federation
 * ingestion path (hub resources/products, federated content).
 */
export function safeRemoteUrl(value: unknown): string | null {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim()) ? value : null;
}
