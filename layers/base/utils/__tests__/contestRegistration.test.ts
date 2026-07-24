import { describe, it, expect } from 'vitest';
import { isRichRegistrationForm } from '../contestRegistration';
import type { FormField } from '@commonpub/schema';

const f = (type: FormField['type'], key: string = type): FormField => ({ key, label: key, type, required: false });

describe('isRichRegistrationForm', () => {
  it('is false for an empty or bare short form', () => {
    expect(isRichRegistrationForm(null)).toBe(false);
    expect(isRichRegistrationForm([])).toBe(false);
    expect(isRichRegistrationForm([f('text', 'a'), f('email', 'b'), f('textarea', 'c')])).toBe(false);
  });

  it('is rich when it has a section header', () => {
    expect(isRichRegistrationForm([f('section'), f('text', 'a')])).toBe(true);
  });

  it('is rich with a room-hungry type (address/file/signature)', () => {
    expect(isRichRegistrationForm([f('address')])).toBe(true);
    expect(isRichRegistrationForm([f('file')])).toBe(true);
    expect(isRichRegistrationForm([f('signature')])).toBe(true);
  });

  it('is rich with two or more agreements', () => {
    expect(isRichRegistrationForm([f('agreement', 'a1')])).toBe(false);
    expect(isRichRegistrationForm([f('agreement', 'a1'), f('agreement', 'a2')])).toBe(true);
  });

  it('is rich with more than 5 input fields (sections do not count)', () => {
    const five = Array.from({ length: 5 }, (_, i) => f('text', `t${i}`));
    expect(isRichRegistrationForm(five)).toBe(false);
    expect(isRichRegistrationForm([...five, f('text', 't5')])).toBe(true);
    // a section does not push a 5-input form over the line by itself counting as an input
    expect(isRichRegistrationForm([f('section'), ...five])).toBe(true); // (section itself makes it rich)
  });
});
