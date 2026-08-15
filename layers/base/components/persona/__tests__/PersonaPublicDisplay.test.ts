/**
 * `<PersonaPublicDisplay>` — the read-only render of one member's persona on
 * their public profile (plan 8.5).
 *
 * Three properties are load-bearing and each is pinned below. It renders NOTHING
 * for a visitor when there is nothing to show, because an empty state on someone
 * else's profile is pressure applied to the wrong person. Its chips are inert
 * spans, because a visitor must not be able to touch another person's answer and
 * a control that looks operable but is not is worse than a label. And it renders
 * NO link to another site at all: `GET /api/users/:username/persona` excludes
 * `link` fields, because they live in `users.social_links` and the profile hero
 * already prints that column as its icon row. The one anchor this component can
 * produce is the owner's own `/settings/persona` link.
 *
 * That exclusion is also why there is no `safeHref` here. `users.social_links`
 * holds rows written long before the current URL validators and this repo has
 * shipped a `javascript:` href twice, so the guard matters — but not rendering
 * the value at all is stronger than sanitising it, and the assertion below pins
 * the absence so a future edit that re-adds links cannot pass silently.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import axe from 'axe-core';
import Display from '../PersonaPublicDisplay.vue';

interface FieldItem {
  key: string;
  label: string;
  /** Mirrors `PublicPersonaDisplay`, which has no `'link'` member. */
  display: 'chips' | 'text';
  values: string[];
}
interface SectionItem {
  key: string;
  label: string;
  fields: FieldItem[];
}

const SECTIONS: SectionItem[] = [
  {
    key: 'basics',
    label: 'Basics',
    fields: [
      { key: 'industry', label: 'Industry', display: 'chips', values: ['Hardware'] },
      { key: 'motto', label: 'Motto', display: 'text', values: ['Measure twice'] },
    ],
  },
  {
    key: 'interests',
    label: 'Interests',
    fields: [
      { key: 'interests', label: 'What are you into?', display: 'chips', values: ['Robotics', 'PCB design'] },
    ],
  },
];

// NuxtLink is not registered outside a Nuxt app; a plain anchor keeps the
// href assertion on the owner note honest.
const NuxtLink = {
  props: { to: { type: String, required: true } },
  template: '<a :href="to"><slot /></a>',
};

function mount(props: Partial<{ sections: SectionItem[]; isOwner: boolean }> = {}) {
  return render(Display, {
    props: { sections: SECTIONS, isOwner: false, ...props },
    global: { components: { NuxtLink } },
  });
}

describe('PersonaPublicDisplay — nothing to show', () => {
  it('renders absolutely nothing for a visitor when there are no sections', () => {
    const { container } = mount({ sections: [] });
    expect(container.textContent?.trim()).toBe('');
    expect(container.querySelector('section')).toBeNull();
  });

  it('renders nothing when every section came back with empty fields', () => {
    const { container } = mount({
      sections: [{ key: 'basics', label: 'Basics', fields: [{ key: 'industry', label: 'Industry', display: 'chips', values: [] }] }],
    });
    expect(container.textContent?.trim()).toBe('');
  });

  it('never tells a visitor what this person has not done', () => {
    const { container } = mount({ sections: [] });
    const text = (container.textContent ?? '').toLowerCase();
    for (const phrase of ['has not', 'no profile', 'not filled', 'empty']) {
      expect(text).not.toContain(phrase);
    }
  });

  it('gives the OWNER one quiet line pointing at their own editor', () => {
    const { container, getByRole } = mount({ sections: [], isOwner: true });
    expect(getByRole('link').getAttribute('href')).toBe('/settings/persona');
    // A pointer, not a scoreboard: no count, no percentage, no meter.
    expect(container.textContent ?? '').not.toMatch(/\d/);
    expect(container.querySelector('progress')).toBeNull();
  });

  it('shows the owner line only when there is nothing, never above real answers', () => {
    const { container } = mount({ isOwner: true });
    expect(container.querySelector('.cpub-persona-public-owner-note')).toBeNull();
  });
});

describe('PersonaPublicDisplay — the answers', () => {
  it('heads each section and keeps the order it was given', () => {
    const { container } = mount();
    const headings = [...container.querySelectorAll('h2')].map((h) => h.textContent?.trim());
    expect(headings).toEqual(['Basics', 'Interests']);
  });

  it('labels every section for assistive tech by a real id, not by a guess', () => {
    const { container } = mount();
    for (const section of container.querySelectorAll('section')) {
      const id = section.getAttribute('aria-labelledby');
      expect(id).toBeTruthy();
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it('renders each answer under its own question label', () => {
    const { getByText } = mount();
    expect(getByText('Industry')).toBeTruthy();
    expect(getByText('What are you into?')).toBeTruthy();
  });

  it('renders multiselect answers as inert chips: not checkboxes and not links', () => {
    const { container } = mount();
    const chips = [...container.querySelectorAll('.cpub-tag')].map((c) => c.textContent?.trim());
    expect(chips).toContain('Robotics');
    expect(chips).toContain('PCB design');
    for (const chip of container.querySelectorAll('.cpub-tag')) {
      expect(chip.tagName).toBe('SPAN');
    }
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  it('renders free text as plain text, never as markup', () => {
    const { container, getByText } = mount({
      sections: [{
        key: 'basics',
        label: 'Basics',
        fields: [{ key: 'motto', label: 'Motto', display: 'text', values: ['<script>alert(1)</script>'] }],
      }],
    });
    expect(getByText('<script>alert(1)</script>')).toBeTruthy();
    expect(container.querySelector('script')).toBeNull();
  });

});

/**
 * The absence of an outbound `:href` is a property worth pinning, not an
 * accident of the fixture. The route excludes `link` fields (the profile hero
 * renders `users.social_links` already), so nothing from that column reaches
 * this template — which is why there is no `safeHref` call here to test. If a
 * future change re-adds links to the payload, the first assertion turns red and
 * `safeHref` has to come back with it.
 */
describe('PersonaPublicDisplay — no outbound link surface', () => {
  it('renders no anchor at all when there are answers to show', () => {
    const { queryAllByRole } = mount();
    expect(queryAllByRole('link')).toHaveLength(0);
  });

  it('prints a URL-shaped free-text answer as text, never as an anchor', () => {
    // The realistic reintroduction is not a new `display` mode: it is somebody
    // "helpfully" auto-linking text. A `javascript:` answer is the value that
    // makes that a stored-XSS bug rather than a formatting choice.
    const { queryAllByRole, getByText } = mount({
      sections: [{
        key: 'basics',
        label: 'Basics',
        fields: [{
          key: 'motto',
          label: 'Motto',
          display: 'text',
          values: ['javascript:alert(document.cookie)'],
        }],
      }],
    });
    expect(getByText('javascript:alert(document.cookie)')).toBeTruthy();
    expect(queryAllByRole('link')).toHaveLength(0);
  });

  it('still renders the owner note as a real link to their own editor', () => {
    // The one anchor this component may produce, so "no anchors" above is a
    // statement about outbound links and not about a component that renders none.
    const { getByRole } = mount({ sections: [], isOwner: true });
    expect(getByRole('link').getAttribute('href')).toBe('/settings/persona');
  });
});

describe('PersonaPublicDisplay — accessibility', () => {
  it('has no axe violations with answers', async () => {
    const { container } = mount();
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it('has no axe violations on the owner note', async () => {
    const { container } = mount({ sections: [], isOwner: true });
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
