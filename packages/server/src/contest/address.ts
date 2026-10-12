/**
 * Mailing addresses from contest forms.
 *
 * An `address` answer is stored as a JSON string of these parts. Exports and the
 * organizer screens format it at read time, so every answer already stored reads
 * correctly without a migration. Mirrored on the client in
 * layers/base/utils/contestSubmission.ts (ADDRESS_SUBFIELDS + formatAddressLines);
 * a parity test there pins the two together.
 */
export const ADDRESS_PARTS = [
  { key: 'line1', label: 'Address line 1' },
  { key: 'line2', label: 'Address line 2' },
  { key: 'city', label: 'City' },
  { key: 'region', label: 'State / region' },
  { key: 'postal', label: 'Postal code' },
  { key: 'country', label: 'Country' },
] as const;

export type AddressPartKey = (typeof ADDRESS_PARTS)[number]['key'];
export type AddressParts = Partial<Record<AddressPartKey, string>>;

const str = (v: unknown): string => (v == null ? '' : typeof v === 'string' ? v : String(v)).trim();

/**
 * The stored value as parts. A value that isn't a JSON object (an answer saved as
 * plain text before addresses were structured) is kept whole as line 1 rather than
 * dropped: an export that silently blanks an address is worse than an untidy one.
 */
export function parseAddressValue(value: string | null | undefined): AddressParts {
  const raw = str(value);
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as unknown;
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      const out: AddressParts = {};
      for (const { key } of ADDRESS_PARTS) {
        const v = str((o as Record<string, unknown>)[key]);
        if (v) out[key] = v;
      }
      return out;
    }
  } catch {
    /* not JSON: fall through to plain text */
  }
  return { line1: raw };
}

/** Mailing lines: line 1, line 2, "City, Region Postal", Country. Empty parts drop out. */
export function formatAddressLines(value: string | null | undefined): string[] {
  const a = parseAddressValue(value);
  const cityLine = `${[a.city, a.region].filter(Boolean).join(', ')}${a.postal ? ` ${a.postal}` : ''}`.trim();
  return [a.line1, a.line2, cityLine, a.country].map((l) => (l ?? '').trim()).filter(Boolean);
}
