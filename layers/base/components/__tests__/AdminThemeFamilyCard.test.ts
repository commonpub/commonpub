/**
 * Regression test for the B1 audit bug: the family card's Edit/Duplicate/
 * Export/Delete must target the PRIMARY record (the variant whose id has no
 * `-light`/`-dark` suffix), NOT `family.light?.id ?? family.dark!.id`. For a
 * dark-primary pair (dice/Studio with a dark default) the latter targeted the
 * auto-generated light sibling — editing/deleting the wrong record.
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import AdminThemeFamilyCard from '../admin/theme/AdminThemeFamilyCard.vue';
import type { ThemeFamilyView } from '../../types/theme';

const sw = { bg: '#fff', surface: '#fff', accent: '#5b9cf6', text: '#111', border: '#111' };

function family(over: Partial<ThemeFamilyView>): ThemeFamilyView {
  return {
    id: 'kiln',
    name: 'Kiln',
    description: '',
    source: 'custom',
    light: null,
    dark: null,
    preview: { light: sw, dark: sw },
    ...over,
  } as ThemeFamilyView;
}

function clickAction(container: Element, label: RegExp): void {
  const btn = Array.from(container.querySelectorAll('button')).find((b) => label.test(b.textContent ?? ''));
  if (!btn) throw new Error(`button ${label} not found`);
  void fireEvent.click(btn);
}

describe('AdminThemeFamilyCard — primary targeting (B1)', () => {
  it('dark-primary pair: Edit/Delete target the suffix-less primary, not the light sibling', async () => {
    const fam = family({
      light: { id: 'cpub-custom-kiln-light', name: 'Kiln Light' },
      dark: { id: 'cpub-custom-kiln', name: 'Kiln' }, // primary (no suffix)
    });
    const { container, emitted } = render(AdminThemeFamilyCard, { props: { family: fam, active: false, saving: false } });
    clickAction(container, /Edit/);
    clickAction(container, /Delete/);
    expect((emitted().edit as string[][])[0][0]).toBe('cpub-custom-kiln');
    expect((emitted().remove as string[][])[0][0]).toBe('cpub-custom-kiln');
  });

  it('light-primary pair: targets the suffix-less primary (the light one)', async () => {
    const fam = family({
      id: 'my-theme',
      name: 'My theme',
      light: { id: 'cpub-custom-my-theme', name: 'My theme' }, // primary
      dark: { id: 'cpub-custom-my-theme-dark', name: 'My theme' },
    });
    const { container, emitted } = render(AdminThemeFamilyCard, { props: { family: fam, active: false, saving: false } });
    clickAction(container, /Edit/);
    expect((emitted().edit as string[][])[0][0]).toBe('cpub-custom-my-theme');
  });
});
