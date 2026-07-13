import { describe, it, expect } from 'vitest';
import { humanizeTimeRemaining, formatDeadlineUtc } from '../contest/reminders.js';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// The reminder copy states the ACTUAL time left, derived from ms, so a milestone
// that fires late (email enabled near the deadline / a mid-window registrant)
// never claims a wrong number. These boundaries also keep the on-schedule
// milestones reading naturally: 48h/24h/1h.
describe('humanizeTimeRemaining', () => {
  it('floors to at least one minute and pluralizes minutes', () => {
    expect(humanizeTimeRemaining(0)).toBe('1 minute');
    expect(humanizeTimeRemaining(30 * 1000)).toBe('1 minute');
    expect(humanizeTimeRemaining(MIN)).toBe('1 minute');
    expect(humanizeTimeRemaining(30 * MIN)).toBe('30 minutes');
    expect(humanizeTimeRemaining(59 * MIN)).toBe('59 minutes');
  });

  it('reads hours up to 48 so the 48h/24h/1h milestones read naturally', () => {
    expect(humanizeTimeRemaining(HOUR)).toBe('1 hour');
    expect(humanizeTimeRemaining(20 * HOUR)).toBe('20 hours');
    expect(humanizeTimeRemaining(24 * HOUR)).toBe('24 hours');
    expect(humanizeTimeRemaining(48 * HOUR)).toBe('48 hours');
  });

  it('switches to days beyond 48 hours', () => {
    expect(humanizeTimeRemaining(50 * HOUR)).toBe('2 days'); // a mid-window registrant, NOT "7 days"
    expect(humanizeTimeRemaining(6 * DAY)).toBe('6 days');
    expect(humanizeTimeRemaining(7 * DAY)).toBe('7 days');
  });
});

// Regression: newer ICU renders "August 12, 2026 at 05:44" (native " at ", one
// comma). A comma-rewriting regex mangled that into "August 12 at 2026 at 05:44".
// The output must be stable and read as a sentence regardless of ICU version.
describe('formatDeadlineUtc', () => {
  it('renders a single, well-formed UTC deadline sentence', () => {
    expect(formatDeadlineUtc(new Date('2026-08-12T05:44:00Z'))).toBe('August 12, 2026 at 05:44 UTC');
    expect(formatDeadlineUtc(new Date('2026-07-19T14:00:00Z'))).toBe('July 19, 2026 at 14:00 UTC');
  });

  it('never doubles the " at " separator', () => {
    const out = formatDeadlineUtc(new Date('2026-01-02T09:05:00Z'));
    expect(out.match(/ at /g)).toHaveLength(1);
    expect(out).toBe('January 2, 2026 at 09:05 UTC');
  });
});
