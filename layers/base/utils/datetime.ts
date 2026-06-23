/**
 * Local-time conversion for `<input type="datetime-local">`.
 *
 * A datetime-local control speaks the operator's LOCAL wall-clock with no zone.
 * The common idiom `new Date(iso).toISOString().slice(0, 16)` is WRONG: toISOString
 * is UTC, so the value shown is shifted by the local offset and the time the
 * operator picks isn't the time that gets stored. These helpers build the input
 * value from the date's LOCAL components and parse it back as local, so the
 * round-trip is offset-correct in every timezone.
 */

const pad = (n: number): string => String(n).padStart(2, '0');

/** An ISO instant rendered as `YYYY-MM-DDTHH:mm` in the viewer's local zone (the input value). */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A `YYYY-MM-DDTHH:mm` local wall-clock value parsed to an ISO instant. Empty/invalid -> undefined. */
export function fromLocalInput(local?: string | null): string | undefined {
  if (!local) return undefined;
  // A datetime-local string carries no offset, so the runtime parses it as LOCAL.
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * An ISO instant as a short human date in the VIEWER's local zone, e.g.
 * "Aug 1, 2026" (or "Aug 1" with `{ year: false }`). One formatter for every
 * contest date surface (hero, sidebar timeline, entry rows).
 *
 * It is timezone-dependent (the local calendar day differs by zone), so any caller
 * that renders server-side MUST gate it behind a client `mounted` flag — otherwise
 * the server's TZ and the viewer's disagree on hydration and Vue won't rectify it.
 * Empty / invalid input -> ''.
 */
export function formatLocalDate(iso?: string | null, opts?: { year?: boolean }): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(opts?.year === false ? {} : { year: 'numeric' }) });
}
