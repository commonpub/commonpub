import { describe, it, expect } from 'vitest';
import { isRichRegistrationForm, resolveRegistrationAction } from '../contestRegistration';
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

/**
 * resolveRegistrationAction — the single decision every "Register" control on a
 * contest page now shares (session 253). Each case here is a divergence that was
 * live before it existed.
 */
describe('resolveRegistrationAction', () => {
  const slug = 'resilient';
  const REQUIRED: FormField[] = [{ key: 'name', label: 'Name', type: 'text', required: true }];
  const OPTIONAL: FormField[] = [{ key: 'note', label: 'Note', type: 'text', required: false }];
  const RICH: FormField[] = [
    { key: 'sec', label: 'About you', type: 'section', required: false },
    { key: 'name', label: 'Name', type: 'text', required: true },
  ];

  it('sends an anonymous visitor to sign-in, returning to the REGISTRATION FORM', () => {
    // The signup card had no anonymous branch at all, so any caller copying its
    // logic shipped a hole. This is now unconditional and first.
    for (const template of [null, OPTIONAL, REQUIRED, RICH]) {
      expect(resolveRegistrationAction({ slug, isAuthenticated: false, template })).toEqual({
        kind: 'login',
        to: '/auth/login?redirect=/contests/resilient/register',
      });
    }
  });

  it('one-click registers when nothing is required', () => {
    expect(resolveRegistrationAction({ slug, isAuthenticated: true, template: null }).kind).toBe('register');
    expect(resolveRegistrationAction({ slug, isAuthenticated: true, template: OPTIONAL }).kind).toBe('register');
  });

  it('routes a rich required form to the page even when the caller could host a modal', () => {
    expect(resolveRegistrationAction({ slug, isAuthenticated: true, template: RICH, allowModal: true })).toEqual({
      kind: 'page',
      to: '/contests/resilient/register',
    });
  });

  it('a SHORT required form is a modal only for a caller that has one', () => {
    // The live divergence: the sidebar opened a modal while the hero navigated
    // to the page, for the same contest and the same viewer.
    expect(resolveRegistrationAction({ slug, isAuthenticated: true, template: REQUIRED, allowModal: true }).kind).toBe('modal');
    expect(resolveRegistrationAction({ slug, isAuthenticated: true, template: REQUIRED, allowModal: false })).toEqual({
      kind: 'page',
      to: '/contests/resilient/register',
    });
  });

  it('defaults to no modal, so a new caller cannot accidentally promise one', () => {
    expect(resolveRegistrationAction({ slug, isAuthenticated: true, template: REQUIRED }).kind).toBe('page');
  });
});
