/**
 * Locks the public contest count rules (session 253).
 *
 * These exist because the operator reported "0s on the contest tile" and the
 * investigation found three separate causes, two of which are asserted here:
 * `entryCount` was rendered ungated at all 9 of its sites (so an open contest
 * read "0 entries"), and it was unpluralized at two of them (the live deveco
 * contest read "1 entries"). The third cause, the SSR-zero countdown, is fixed
 * in CountdownTimer.vue and covered by CountdownTimer.test.ts, which renders
 * the component through the SSR path where the bug actually appeared. That
 * claim was previously false: no test rendered the component at all.
 */
import { describe, it, expect } from 'vitest';
import {
  showsEntryCount,
  entryCountLabel,
  showsRegisteredCount,
  registeredCountLabel,
} from '../contestCounts';

describe('showsEntryCount', () => {
  it('hides the count while a contest is still open', () => {
    for (const status of ['draft', 'upcoming', 'active', 'paused']) {
      expect(showsEntryCount({ status, entryCount: 7 }), status).toBe(false);
    }
  });

  it('shows the count once submissions have closed', () => {
    expect(showsEntryCount({ status: 'judging', entryCount: 7 })).toBe(true);
    expect(showsEntryCount({ status: 'completed', entryCount: 7 })).toBe(true);
  });

  it('never shows a zero, even after close', () => {
    expect(showsEntryCount({ status: 'completed', entryCount: 0 })).toBe(false);
    expect(showsEntryCount({ status: 'judging', entryCount: null })).toBe(false);
    expect(showsEntryCount({ status: 'completed' })).toBe(false);
  });

  it('treats a cancelled contest as not worth an entry count', () => {
    expect(showsEntryCount({ status: 'cancelled', entryCount: 7 })).toBe(false);
  });
});

describe('entryCountLabel', () => {
  it('pluralizes', () => {
    // The live deveco contest rendered "1 entries" in two places.
    expect(entryCountLabel({ entryCount: 1 })).toBe('1 entry');
    expect(entryCountLabel({ entryCount: 2 })).toBe('2 entries');
  });

  it('treats a missing count as zero rather than printing undefined', () => {
    expect(entryCountLabel({})).toBe('0 entries');
    expect(entryCountLabel({ entryCount: null })).toBe('0 entries');
  });
});

describe('showsRegisteredCount', () => {
  it('shows any positive count regardless of status', () => {
    for (const status of ['upcoming', 'active', 'judging', 'completed']) {
      expect(showsRegisteredCount({ status, followerCount: 1 }), status).toBe(true);
    }
  });

  it('suppresses zero and missing', () => {
    expect(showsRegisteredCount({ followerCount: 0 })).toBe(false);
    expect(showsRegisteredCount({ followerCount: null })).toBe(false);
    expect(showsRegisteredCount({})).toBe(false);
  });
});

describe('registeredCountLabel', () => {
  it('reads as registered, not following or entries', () => {
    // followerCount is every registration row, so "registered" is accurate;
    // binding this label to entryCount would not be.
    expect(registeredCountLabel({ followerCount: 10 })).toBe('10 registered');
    expect(registeredCountLabel({ followerCount: 1 })).toBe('1 registered');
  });
});
