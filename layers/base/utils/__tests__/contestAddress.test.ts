import { describe, it, expect } from 'vitest';
import { formatAddressLines as serverFormat, ADDRESS_PARTS } from '@commonpub/server';
import { formatAddressLines, ADDRESS_SUBFIELDS } from '../contestSubmission';

// The organizer screens (this formatter) and the CSV exports (the server's) must
// render the same stored address the same way, or the table and the spreadsheet
// disagree about where a dev kit goes. Session 260.
const SAMPLES: Array<string | undefined> = [
  JSON.stringify({ line1: '1039 South Fair Play Way', line2: 'Unit 4', city: 'Aurora', region: 'CO', postal: '80012', country: 'USA' }),
  JSON.stringify({ line1: 'House 17, Street 39,G-6/2', city: 'Islamabad', country: 'Pakistan' }),
  JSON.stringify({ line1: '18 Furstenwalder Str.', city: 'Berlin', postal: '10243', country: 'Germany' }),
  JSON.stringify({ line1: '  padded  ', city: ' Chennai ', region: 'TN', postal: '600015', country: 'India' }),
  JSON.stringify({ city: 'Only a city' }),
  '12 Main St, Springfield', // legacy plain text
  '',
  undefined,
];

describe('formatAddressLines', () => {
  it('formats a full address into mailing lines', () => {
    expect(formatAddressLines(SAMPLES[0])).toEqual(['1039 South Fair Play Way', 'Unit 4', 'Aurora, CO 80012', 'USA']);
  });

  it('keeps a legacy plain-text value as line 1', () => {
    expect(formatAddressLines('12 Main St, Springfield')).toEqual(['12 Main St, Springfield']);
  });

  it('matches the server formatter used by the CSV exports, sample by sample', () => {
    expect(SAMPLES.length).toBeGreaterThan(5); // the guard actually walked the samples
    for (const s of SAMPLES) expect(formatAddressLines(s), String(s)).toEqual(serverFormat(s));
  });

  it('names the same parts in the same order as the server', () => {
    expect(ADDRESS_SUBFIELDS.map((p) => p.key)).toEqual(ADDRESS_PARTS.map((p) => p.key));
  });
});
