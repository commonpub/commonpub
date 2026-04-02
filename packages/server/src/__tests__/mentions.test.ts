import { describe, it, expect } from 'vitest';
import { extractMentions } from '../social/mentions.js';

describe('extractMentions', () => {
  it('extracts a single mention', () => {
    expect(extractMentions('hello @alice')).toEqual(['alice']);
  });

  it('extracts multiple mentions', () => {
    const result = extractMentions('@alice and @bob check this out');
    expect(result).toContain('alice');
    expect(result).toContain('bob');
    expect(result).toHaveLength(2);
  });

  it('deduplicates mentions', () => {
    expect(extractMentions('@alice @alice @alice')).toEqual(['alice']);
  });

  it('normalizes to lowercase', () => {
    expect(extractMentions('@Alice @BOB')).toEqual(['alice', 'bob']);
  });

  it('handles mention at start of text', () => {
    expect(extractMentions('@alice is cool')).toEqual(['alice']);
  });

  it('handles mention at end of text', () => {
    expect(extractMentions('thanks @alice')).toEqual(['alice']);
  });

  it('handles mention with punctuation after', () => {
    expect(extractMentions('hey @alice, how are you?')).toEqual(['alice']);
    expect(extractMentions('thanks @bob!')).toEqual(['bob']);
    expect(extractMentions('cc @charlie.')).toEqual(['charlie']);
  });

  it('handles mention in parentheses', () => {
    expect(extractMentions('(cc @alice)')).toEqual(['alice']);
  });

  it('returns empty array for no mentions', () => {
    expect(extractMentions('no mentions here')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractMentions('')).toEqual([]);
  });

  it('handles usernames with hyphens and underscores', () => {
    expect(extractMentions('@foo-bar @baz_qux')).toEqual(['foo-bar', 'baz_qux']);
  });

  it('limits username to 39 characters', () => {
    const long = 'a'.repeat(40);
    expect(extractMentions(`@${long}`)).toEqual([]);

    const exact = 'a'.repeat(39);
    expect(extractMentions(`@${exact}`)).toEqual([exact]);
  });

  it('does not extract email addresses as mentions', () => {
    // The regex requires whitespace or start before @, so emails should not match
    expect(extractMentions('email test@example.com')).toEqual([]);
  });
});
