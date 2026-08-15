/**
 * `<PersonaRetiredData>` — "Data from removed fields".
 *
 * This block is the Art. 16 and Art. 17 surface for data whose question no
 * longer exists. The two failure modes it is written against are both silent:
 * showing nothing when there IS retained data (invisible data cannot be
 * corrected or erased), and putting a locale-formatted date into SSR output
 * (which mismatches only in production, where the server's timezone differs
 * from the reader's).
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import Retired from '../PersonaRetiredData.vue';

const ITEMS = [
  { fieldKey: 'favourite_soldering_iron', values: ['hakko'], text: null, retiredAt: '2026-03-04T09:00:00.000Z' },
  { fieldKey: 'old_note', values: [], text: 'a free text answer', retiredAt: null },
];

describe('PersonaRetiredData', () => {
  it('renders nothing when there is nothing retired', () => {
    const { container } = render(Retired, { props: { items: [] } });
    expect(container.textContent?.trim()).toBe('');
  });

  it('names the block and explains it in the agreed words', () => {
    const { getByText } = render(Retired, { props: { items: ITEMS } });
    expect(getByText('Data from removed fields')).toBeTruthy();
    expect(getByText(
      'This was collected under a question that is no longer part of this profile. You can delete it.',
    )).toBeTruthy();
  });

  it('shows the RAW stored key, because a removed question has no label left', () => {
    const { getByText } = render(Retired, { props: { items: ITEMS } });
    expect(getByText('favourite_soldering_iron')).toBeTruthy();
    expect(getByText('old_note')).toBeTruthy();
  });

  it('shows both closed-vocabulary values and free text', () => {
    const { getByText } = render(Retired, { props: { items: ITEMS } });
    expect(getByText('hakko')).toBeTruthy();
    expect(getByText('a free text answer')).toBeTruthy();
  });

  it('offers one Delete per field, named so it is self-descriptive out of context', async () => {
    const { getByLabelText, emitted } = render(Retired, { props: { items: ITEMS } });
    await fireEvent.click(getByLabelText('Delete the saved answer for old_note'));
    expect((emitted('delete') as Array<[string]>)[0]?.[0]).toBe('old_note');
  });

  it('asks for no confirmation, because friction belongs on collection not deletion', async () => {
    const { getByLabelText, queryByRole } = render(Retired, { props: { items: ITEMS } });
    await fireEvent.click(getByLabelText('Delete the saved answer for old_note'));
    expect(queryByRole('dialog')).toBeNull();
    expect(queryByRole('alertdialog')).toBeNull();
  });

  it('disables only the row whose delete is in flight', () => {
    const { getByLabelText } = render(Retired, { props: { items: ITEMS, deletingKey: 'old_note' } });
    expect((getByLabelText('Delete the saved answer for old_note') as HTMLButtonElement).disabled).toBe(true);
    expect((getByLabelText('Delete the saved answer for favourite_soldering_iron') as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders the ISO date on first paint and keeps the machine value in <time>', () => {
    // A `toLocaleDateString` on the server resolves against the SERVER's zone,
    // so it mismatches hydration only in production, where the two differ. The
    // first render is therefore zone-independent, and localisation happens after
    // mount.
    const { container } = render(Retired, { props: { items: ITEMS } });
    const time = container.querySelector('time');
    expect(time?.getAttribute('datetime')).toBe('2026-03-04T09:00:00.000Z');
  });

  it('omits the date line entirely when the removal predates the record', () => {
    const { container } = render(Retired, { props: { items: [ITEMS[1]!] } });
    expect(container.querySelector('time')).toBeNull();
    expect(container.textContent).not.toContain('Removed on');
  });

  it('has no axe violations', async () => {
    const { container } = render(Retired, { props: { items: ITEMS } });
    const results = await axe.run(container, {
      rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
