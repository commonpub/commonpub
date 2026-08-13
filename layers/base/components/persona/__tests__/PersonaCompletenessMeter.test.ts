/**
 * `<PersonaCompletenessMeter>`.
 *
 * The assertion that earns its keep is the false-zero one. Seeding a
 * client-resolved count to `ref(0)` silences a hydration warning and ships
 * "0 of 9 sections filled in" into the first paint and into the HTML a crawler
 * reads. That is a false statement about a real person, and it shipped once
 * already as "0 makers registered". This component has no local state at all,
 * and the test below pins the absence of the number rather than the presence of
 * a skeleton class.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import axe from 'axe-core';
import type { PersonaCompleteness } from '@commonpub/persona';
import { BUILTIN_PERSONA_SECTIONS, personaCompleteness } from '@commonpub/persona';
import Meter from '../PersonaCompletenessMeter.vue';

function completeness(filledSections: number, totalSections: number): PersonaCompleteness {
  return {
    perSection: Array.from({ length: totalSections }, (_, i) => ({
      key: `s${i}`,
      label: `Section ${i}`,
      filledFields: i < filledSections ? 1 : 0,
      totalFields: 1,
      percent: i < filledSections ? 100 : 0,
      filled: i < filledSections,
      points: 0,
    })),
    filledFields: filledSections,
    totalFields: totalSections,
    percent: Math.round((filledSections / totalSections) * 100),
    points: 0,
  };
}

describe('PersonaCompletenessMeter — with data', () => {
  it('is a progressbar counting SECTIONS, matching the visible text exactly', () => {
    const { getByRole, getByText } = render(Meter, { props: { completeness: completeness(4, 9) } });
    const bar = getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('4');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('9');
    expect(bar.getAttribute('aria-valuetext')).toBe('4 of 9 sections filled in');
    // The text equivalent is on the page, not only in an ARIA attribute.
    expect(getByText('4 of 9 sections filled in')).toBeTruthy();
  });

  it('carries the one honest line', () => {
    const { getByText } = render(Meter, { props: { completeness: completeness(4, 9) } });
    expect(getByText('This is all optional. Fill in what you want people to see.')).toBeTruthy();
  });

  it('leaves the empty state to the page, so the sentence is never on screen twice', () => {
    // `pages/settings/persona.vue` renders "Nothing here yet..." above the
    // sections. The meter carrying it too would print it twice on exactly the
    // page it matters on.
    const { queryByText } = render(Meter, { props: { completeness: completeness(0, 9) } });
    expect(queryByText(/Nothing here yet/)).toBeNull();
  });

  it('reports zero filled sections honestly rather than hiding the meter', () => {
    const { getByText, getByRole } = render(Meter, { props: { completeness: completeness(0, 9) } });
    expect(getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    expect(getByText('0 of 9 sections filled in')).toBeTruthy();
  });

  it('has no score, streak, leaderboard, percentage or red state in its copy', () => {
    const { container } = render(Meter, { props: { completeness: completeness(4, 9) } });
    const text = container.textContent ?? '';
    for (const banned of ['%', 'score', 'points', 'streak', 'rank', 'level', 'complete your']) {
      expect(text.toLowerCase()).not.toContain(banned);
    }
  });

  it('agrees with the pure function it renders, for the real built-in schema', () => {
    // Belt and braces against a hand-rolled count drifting from the brain.
    const real = personaCompleteness(BUILTIN_PERSONA_SECTIONS, { interests: ['hardware'] });
    const { getByRole } = render(Meter, { props: { completeness: real } });
    const filled = real.perSection.filter((s) => s.filled).length;
    expect(getByRole('progressbar').getAttribute('aria-valuenow')).toBe(String(filled));
    expect(filled).toBe(1);
  });
});

describe('PersonaCompletenessMeter — without data', () => {
  it('renders a busy skeleton and NO number at all', () => {
    const { container, getByRole } = render(Meter, { props: { completeness: null } });
    const bar = getByRole('progressbar');
    expect(bar.getAttribute('aria-busy')).toBe('true');
    // Indeterminate: no value, because there is no value yet.
    expect(bar.getAttribute('aria-valuenow')).toBeNull();
    // The false-zero guard: nothing anywhere in the rendered text is a digit.
    expect(container.textContent ?? '').not.toMatch(/\d/);
  });

  it('is identical whether the prop is null or omitted', () => {
    const omitted = render(Meter);
    expect(omitted.getByRole('progressbar').getAttribute('aria-busy')).toBe('true');
    expect(omitted.container.textContent ?? '').not.toMatch(/\d/);
  });
});

describe('PersonaCompletenessMeter — accessibility', () => {
  it.each([['with data', completeness(4, 9)], ['without data', null]] as const)(
    'has no axe violations %s',
    async (_name, value) => {
      const { container } = render(Meter, { props: { completeness: value } });
      const results = await axe.run(container, {
        rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } },
      });
      expect(results.violations).toEqual([]);
    },
  );
});
