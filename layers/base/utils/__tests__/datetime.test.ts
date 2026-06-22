import { describe, it, expect } from 'vitest';
import { toLocalInput, fromLocalInput } from '../datetime';

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
