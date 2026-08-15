import { describe, expect, it } from 'vitest';

import {
  PERSONA_DATA_CLASSES,
  PROCESSING_PURPOSES,
  PROCESSING_PURPOSE_SPECS,
  PURPOSE_COPY_MAX_LENGTH,
} from '../purposes.js';
import {
  PERSONA_STATISTICS,
  STATISTICS_LEGAL_BASIS,
  STATISTICS_OBJECTION_STATES,
  renderStatisticsSummary,
  statisticsCovers,
  statisticsStateSummary,
} from '../statistics.js';

/** The floors an operator can actually configure, at both extremes. */
const FLOOR = { minBucket: 5, minPopulation: 25 } as const;
const CEILING = { minBucket: 100, minPopulation: 10_000 } as const;

/** Every sentence a member could be shown about statistics. */
function allCopy(): string[] {
  return [
    PERSONA_STATISTICS.label,
    renderStatisticsSummary(FLOOR),
    PERSONA_STATISTICS.basisNote,
    PERSONA_STATISTICS.countedSummary,
    PERSONA_STATISTICS.objectedSummary,
    PERSONA_STATISTICS.objectLabel,
    PERSONA_STATISTICS.objectEffect,
    PERSONA_STATISTICS.withdrawObjectionLabel,
    PERSONA_STATISTICS.withdrawObjectionEffect,
  ];
}

describe('statistics are an objection, not a consent', () => {
  it('runs on legitimate interest and says so', () => {
    // The whole correction in one assertion. Consent for processing that would
    // happen regardless is a dark pattern; the honest basis carries an
    // objection right instead.
    expect(PERSONA_STATISTICS.legalBasis).toBe('legitimate_interest');
    expect(STATISTICS_LEGAL_BASIS).toBe('legitimate_interest');
    expect(PERSONA_STATISTICS.legalBasis).not.toBe('consent');
  });

  it('is not in the purpose registry under any name', () => {
    // It is a different legal instrument with a different lifecycle. Folding it
    // back in as a purpose would give it a scope digest, and a digest exists to
    // invalidate a GRANT when scope changes, which is exactly what a refusal
    // must survive.
    for (const id of PROCESSING_PURPOSES) {
      expect(PROCESSING_PURPOSE_SPECS[id].disclosedTo, id).toBe('named_recipients');
      expect(id).not.toContain('analytics');
      expect(id).not.toContain('statistic');
    }
  });

  it('nobody is pre-objected, as a type and not as a test', () => {
    // Pre-objecting sounds protective and is not: an objection is the member's
    // act, and one nobody made is one nobody can be shown to have made.
    expect(PERSONA_STATISTICS.defaultObjected).toBe(false);
    expect(STATISTICS_OBJECTION_STATES).toEqual(['counted', 'objected']);
  });

  it('keeps the totals on this instance', () => {
    // A statistic that left would be a disclosure to a named recipient, which
    // is a consent purpose and lives in the other module.
    expect(PERSONA_STATISTICS.disclosedTo).toBe('this_instance');
  });
});

describe('the statistics copy', () => {
  it('states the OPERATOR’s bucket floor, not a hardcoded five', () => {
    // "Measure what you ship." A line saying "at least five people" on an
    // instance running `minBucket: 25` understates the member's own protection
    // by five times.
    expect(renderStatisticsSummary(FLOOR)).toContain('at least 5 people');
    expect(renderStatisticsSummary({ ...FLOOR, minBucket: 25 })).toContain('at least 25 people');
  });

  it('says counts are rounded DOWN, which is what quantisePersonaCount does', () => {
    expect(renderStatisticsSummary(FLOOR)).toContain('rounded down');
  });

  it('discloses the private-profile exclusion', () => {
    // The aggregate query filters on a public profile, so a member who goes
    // private stops being counted without being told. A number that quietly
    // excludes you is not the number you were shown.
    expect(renderStatisticsSummary(FLOOR).toLowerCase()).toContain(
      'while your profile is private your answers are not counted',
    );
  });

  it('leaves no unsubstituted token in any sentence', () => {
    for (const copy of allCopy()) {
      expect(copy).not.toMatch(/[{}]/);
    }
  });

  it('says what is true right now before offering the change', () => {
    expect(PERSONA_STATISTICS.countedSummary.toLowerCase()).toContain('right now');
    expect(PERSONA_STATISTICS.objectedSummary.toLowerCase()).toContain('right now');
    expect(statisticsStateSummary('counted')).toBe(PERSONA_STATISTICS.countedSummary);
    expect(statisticsStateSummary('objected')).toBe(PERSONA_STATISTICS.objectedSummary);
  });

  it('states what objecting cannot undo', () => {
    // Totals already published are not recalculated. Saying so is the same
    // register as "it cannot recall what was already shared" on a consent card.
    const effect = PERSONA_STATISTICS.objectEffect.toLowerCase();
    expect(effect).toContain('not recalculated');
    expect(effect).toContain('usually within a day');
  });

  it('offers the way back, so an objection is not a trap', () => {
    expect(PERSONA_STATISTICS.withdrawObjectionLabel.length).toBeGreaterThan(10);
    expect(PERSONA_STATISTICS.withdrawObjectionEffect.toLowerCase()).toContain('not recalculated');
  });

  it('explains why there is no toggle rather than leaving it to be noticed', () => {
    expect(PERSONA_STATISTICS.basisNote.toLowerCase()).toContain('not a consent question');
    expect(PERSONA_STATISTICS.basisNote.toLowerCase()).toContain('object');
  });

  it('never claims your answers are on a profile you did not publish', () => {
    // `showOnProfile` defaults off, so an answer is private unless the operator
    // opted its field in.
    for (const copy of allCopy()) {
      expect(copy.toLowerCase()).not.toContain('on your profile');
    }
  });

  it('uses no em dash and no exclamation mark, and sells nothing', () => {
    for (const copy of allCopy()) {
      expect(copy).not.toMatch(/—/);
      expect(copy).not.toContain('!');
      for (const banned of ['Help us improve', 'Get the most out of', 'Unlock', 'Boost']) {
        expect(copy.toLowerCase(), banned).not.toContain(banned.toLowerCase());
      }
    }
  });

  it('keeps every sentence inside the same cap a consent sentence has', () => {
    // No snapshot stores these, because there is no grant to record. The cap is
    // about a reader's attention, and that does not change with the basis.
    for (const copy of [...allCopy(), renderStatisticsSummary(CEILING)]) {
      expect(copy.length, copy.slice(0, 40)).toBeLessThanOrEqual(PURPOSE_COPY_MAX_LENGTH);
    }
  });
});

describe('statisticsCovers', () => {
  it('names the classes the totals are actually built from', () => {
    // The counterpart of `purposeCovers`. `getPersonaLinkPresence` counts which
    // link platforms a member lists, so `profile_links` has to be here or that
    // aggregate is counting something the copy never mentioned.
    expect(statisticsCovers('persona_selections')).toBe(true);
    expect(statisticsCovers('profile_links')).toBe(true);
  });

  it('covers nothing a total has no business holding', () => {
    // A name or a town in a group total would make it identifying, which is the
    // opposite of what k-anonymity is there to produce.
    expect(statisticsCovers('public_identity')).toBe(false);
    expect(statisticsCovers('location_coarse')).toBe(false);
  });

  it('only ever names a real data class', () => {
    for (const cls of PERSONA_STATISTICS.covers) {
      expect(PERSONA_DATA_CLASSES, cls).toContain(cls);
    }
  });

  it('names every class it covers in the sentence a member reads', () => {
    const mentions: Record<string, string[]> = {
      persona_selections: ['answers'],
      profile_links: ['link', 'answers'],
    };
    const copy = renderStatisticsSummary(FLOOR).toLowerCase();
    for (const cls of PERSONA_STATISTICS.covers) {
      expect((mentions[cls] ?? []).some((w) => copy.includes(w)), cls).toBe(true);
    }
  });
});
