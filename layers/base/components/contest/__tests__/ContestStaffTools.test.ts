/**
 * Organizer / judge tools row on the contest page (session 261). Each button shows
 * to exactly the viewers its destination admits; nothing renders for anyone else.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import axe from 'axe-core';
import ContestStaffTools from '../ContestStaffTools.vue';

const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: String },
  setup(props, { slots }) { return () => h('a', { href: props.to }, slots.default?.()); },
});

type Props = { status: string; canManage: boolean; canJudge: boolean };
const mount = (p: Props) => render(ContestStaffTools, { props: { slug: 'demo', ...p }, global: { components: { NuxtLink } } });
const links = (c: Element): Record<string, string> =>
  Object.fromEntries(Array.from(c.querySelectorAll('a')).map((a) => [a.textContent!.trim(), a.getAttribute('href')!]));

describe('ContestStaffTools', () => {
  it('organizers get the judging portal, the registrants page and the editor', () => {
    const { container, getByRole } = mount({ status: 'judging', canManage: true, canJudge: false });
    expect(getByRole('navigation', { name: 'Organizer tools' })).toBeTruthy();
    expect(links(container)).toEqual({
      'Judging portal': '/contests/demo/judge',
      'View registrants': '/contests/demo/registrants',
      'Edit contest': '/contests/demo/edit',
    });
  });

  it('a panel judge gets the judging portal only, highlighted while judging is open', () => {
    const { container, getByRole } = mount({ status: 'judging', canManage: false, canJudge: true });
    expect(getByRole('navigation', { name: 'Judge tools' })).toBeTruthy();
    expect(Object.keys(links(container))).toEqual(['Judging portal']);
    expect(container.querySelector('a')!.className).toContain('cpub-btn-primary');
  });

  it('a judge can preview before judging opens, but not after the contest ends', () => {
    expect(Object.keys(links(mount({ status: 'active', canManage: false, canJudge: true }).container))).toEqual(['Judging portal']);
    expect(mount({ status: 'completed', canManage: false, canJudge: true }).container.querySelector('nav')).toBeNull();
  });

  it('organizers keep the judging record after the contest ends; nobody gets it once cancelled', () => {
    expect(Object.keys(links(mount({ status: 'completed', canManage: true, canJudge: false }).container))).toContain('Judging portal');
    expect(Object.keys(links(mount({ status: 'cancelled', canManage: true, canJudge: true }).container))).toEqual(['View registrants', 'Edit contest']);
  });

  it('renders nothing for everyone else', () => {
    expect(mount({ status: 'judging', canManage: false, canJudge: false }).container.querySelector('nav')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = mount({ status: 'judging', canManage: true, canJudge: true });
    const res = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(res.violations.map((v) => v.id)).toEqual([]);
  });
});
