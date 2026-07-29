import { describe, it, expect } from 'vitest';
import { toLocalInput, fromLocalInput, formatLocalDate, formatLocalDateRange } from '../datetime';

// These assertions are timezone-independent for the CORRECT implementation: they
// build an instant from LOCAL components and read it back as local, so they hold
// in any runner zone. The old toISOString()-based code shifts by the local offset
// and fails these in every non-UTC zone (proven RED via TZ=America/New_York).
describe('datetime local-input conversion', () => {
  it('toLocalInput renders the ISO instant in local wall-clock (no UTC shift)', () => {
    const local = new Date(2026, 5, 15, 14, 30, 0, 0); // 2026-06-15 14:30 local
    expect(toLocalInput(local.toISOString())).toBe('2026-06-15T14:30');
  });

  it('fromLocalInput parses a local wall-clock string to the right instant', () => {
    expect(fromLocalInput('2026-06-15T14:30')).toBe(new Date(2026, 5, 15, 14, 30, 0, 0).toISOString());
  });

  it('round-trips to minute precision in any timezone', () => {
    const iso = new Date(2026, 0, 2, 9, 5, 0, 0).toISOString();
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
  });

  it('handles empty / null / invalid input', () => {
    expect(toLocalInput('')).toBe('');
    expect(toLocalInput(null)).toBe('');
    expect(toLocalInput('not-a-date')).toBe('');
    expect(fromLocalInput('')).toBeUndefined();
    expect(fromLocalInput(null)).toBeUndefined();
    expect(fromLocalInput('garbage')).toBeUndefined();
  });
});

describe('formatLocalDate', () => {
  it('formats an instant as a short local date with the year by default', () => {
    const iso = new Date(2026, 7, 1, 12, 0).toISOString(); // 2026-08-01 local noon
    expect(formatLocalDate(iso)).toBe('Aug 1, 2026');
  });

  it('omits the year with { year: false }', () => {
    const iso = new Date(2026, 7, 1, 12, 0).toISOString();
    expect(formatLocalDate(iso, { year: false })).toBe('Aug 1');
  });

  it('returns an empty string for empty / null / invalid input', () => {
    expect(formatLocalDate('')).toBe('');
    expect(formatLocalDate(null)).toBe('');
    expect(formatLocalDate('not-a-date')).toBe('');
  });
});

// TZ-independent: assertions compare formatLocalDateRange against formatLocalDate on
// the SAME instants, so the runner's zone cancels out.
describe('formatLocalDateRange', () => {
  const start = '2026-08-15T12:00:00Z';
  const end = '2026-09-15T12:00:00Z';
  const endOtherYear = '2027-01-05T12:00:00Z';

  it('renders a range with the year once when both dates share a year', () => {
    expect(formatLocalDateRange(start, end)).toBe(`${formatLocalDate(start, { year: false })} to ${formatLocalDate(end)}`);
  });
  it('shows the year on both sides across a year boundary', () => {
    expect(formatLocalDateRange(start, endOtherYear)).toBe(`${formatLocalDate(start)} to ${formatLocalDate(endOtherYear)}`);
  });
  it('collapses to a single date when only one bound is set', () => {
    expect(formatLocalDateRange(start, null)).toBe(formatLocalDate(start));
    expect(formatLocalDateRange(null, end)).toBe(formatLocalDate(end));
  });
  it('collapses to a single date when the two bounds are equal', () => {
    expect(formatLocalDateRange(start, start)).toBe(formatLocalDate(start));
  });
  it('collapses when both bounds fall on the same displayed day at different times', () => {
    // Midday UTC on the same date stays the same calendar day in any runner zone
    // within +/-12h; the range must not print "Aug 15 to Aug 15".
    const a = '2026-08-15T11:00:00Z';
    const b = '2026-08-15T12:30:00Z';
    expect(formatLocalDateRange(a, b)).toBe(formatLocalDate(a));
    expect(formatLocalDateRange(a, b)).not.toContain(' to ');
  });
  it('returns empty for no/invalid input', () => {
    expect(formatLocalDateRange(null, null)).toBe('');
    expect(formatLocalDateRange('', undefined)).toBe('');
    expect(formatLocalDateRange('not-a-date', null)).toBe('');
  });
})
