/**
 * Shared render-side URL guards. Stored/federated/author-supplied URLs reach
 * `:href`/`:src` bindings all over the app; a non-http(s) scheme (`javascript:`,
 * `data:`, `vbscript:`…) there is stored XSS on click. Write-time validation
 * (schema `httpUrl`/`optionalUrl`, ingestion `safeRemoteUrl`) blocks NEW bad values,
 * but legacy rows and any un-validated path still flow through render — so every
 * external link binds through `safeHref`. Auto-imported in components.
 */

/** True only for an http(s) URL (after trimming). */
export function isHttpUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

/** An `:href` value that can never carry a script-executing scheme: an http(s)
 *  URL passes through; anything else collapses to '#'. Use for every external,
 *  user- or remote-sourced link. */
export function safeHref(url: string | null | undefined): string {
  return isHttpUrl(url) ? (url as string) : '#';
}
