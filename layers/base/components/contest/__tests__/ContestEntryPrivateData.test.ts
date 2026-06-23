import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import axe from 'axe-core';
import ContestEntryPrivateData from '../ContestEntryPrivateData.vue';

const template = [
  { key: 'mailing_address', label: 'Mailing address (for prizes)', type: 'address' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'terms_general', label: 'Contest rules', type: 'agreement' },
];
const baseProps = {
  template,
  fields: {
    mailing_address: JSON.stringify({ line1: '42 Maker St', line2: 'Unit 4', city: 'Springfield', region: 'IL', postal: '62704', country: 'USA' }),
    phone: '555-0100',
  },
  agreements: [
    { fieldKey: 'terms_general', stageId: 's-proposal', termsHash: 'abcdef0123456789abcdef', termsSnapshot: 'You agree to the rules.', acceptedAt: '2026-06-23T12:00:00.000Z' },
  ],
  updatedAt: '2026-06-23T12:00:00.000Z',
};

describe('ContestEntryPrivateData', () => {
  it('formats an address field across lines (not raw JSON)', () => {
    const { container, getByText } = render(ContestEntryPrivateData, { props: baseProps });
    const addr = container.querySelector('.cpub-epd-address');
    expect(addr).toBeTruthy();
    expect(addr?.textContent).toContain('42 Maker St');
    expect(addr?.textContent).toContain('Springfield, IL 62704');
    expect(addr?.textContent).not.toContain('{'); // not raw JSON
    getByText('Mailing address (for prizes)'); // label from template
  });

  it('shows non-address PII fields as plain text', () => {
    const { getByText } = render(ContestEntryPrivateData, { props: baseProps });
    getByText('Phone');
    getByText('555-0100');
  });

  it('lists agreement acceptances with label, accepted date, terms snapshot and hash', () => {
    const { getByText, container } = render(ContestEntryPrivateData, { props: baseProps });
    getByText('Contest rules'); // label resolved from template via fieldKey
    expect(container.textContent).toMatch(/Accepted/);
    expect(container.querySelector('.cpub-epd-terms-text')?.textContent).toContain('You agree to the rules.');
    expect(container.querySelector('.cpub-epd-hash')?.textContent).toContain('sha256:');
  });

  it('shows the privacy notice', () => {
    const { container } = render(ContestEntryPrivateData, { props: baseProps });
    expect(container.textContent).toMatch(/Visible only to you and contest organizers/);
  });

  it('renders nothing when there is no PII and no agreements', () => {
    const { container } = render(ContestEntryPrivateData, { props: { template, fields: {}, agreements: [] } });
    expect(container.querySelector('.cpub-epd')).toBeNull();
  });

  it('passes an axe scan', async () => {
    const { container } = render(ContestEntryPrivateData, { props: baseProps });
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
