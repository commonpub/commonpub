// DEBUG (session 126 SSR-500 probe): tap Nitro's error hook, mutate the
// error message to include the route + real error before Nitro's production
// sanitizer replaces it with "Server Error".
//
// This plugin runs first (00- prefix) so it sees errors from any source.
// Revert once the root cause of the /docs, /learn, /videos, /explainer
// SSR-500 bug is identified.

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('error', (error, ctx) => {
    const event = (ctx as { event?: { path?: string } } | undefined)?.event;
    const path = event?.path ?? 'unknown';
    const err = error as Error & { statusCode?: number; statusMessage?: string };
    const origMessage = err.message || String(err);
    const origStatus = err.statusCode ?? 500;

    // Preserve 404s
    if (origStatus === 404) return;

    // eslint-disable-next-line no-console
    console.error(`[ERROR_PROBE] ${path} status=${origStatus} msg=${origMessage}`);
    if (err.stack) {
      // eslint-disable-next-line no-console
      console.error(`[ERROR_PROBE] stack: ${err.stack.slice(0, 800)}`);
    }

    // Mutate the statusMessage so it shows up in the JSON response body
    // even in production. Includes first line of message.
    if (err.statusMessage === undefined || err.statusMessage === 'Server Error') {
      err.statusMessage = `PROBE[${path}]: ${origMessage.slice(0, 180)}`;
    }
  });
});
