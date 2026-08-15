/**
 * The nested Profile editor (plan R3.1 D7, D8; R3.4 phase 2).
 *
 * `/settings/profile` used to be one 990-line form and `/settings/persona` a
 * second editor for the same person. This suite covers the merge: the parent's
 * tab strip, both redirects, each child rendering the slice it owns, and the
 * property the merge exists to establish, which is that no field is editable in
 * two tabs.
 *
 * P7 — A SCANNING TEST NEEDS ITS OWN GUARD. The duplication sweep at the bottom
 * reads the page directory from disk. A wrong path walks zero files and passes
 * green, so it asserts how many files it read, names them, and asserts the
 * extractor found real fields before it asserts anything about overlap.
 *
 * Lives under components/__tests__ (bracket-free) so packaging excludes it: the
 * layer's `!**\/__tests__/` exclusion is unreliable under `pages/`, which
 * carries bracketed route directories npm pack reads as glob character classes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { render, fireEvent } from '@testing-library/vue';
import { createApp, defineComponent, h, ref, Suspense, nextTick, type App } from 'vue';
// The REAL list, not a hand-copied one: `links.vue` keeps a local mirror so the
// page does not pull package values into the client bundle, and this import is
// what stops the mirror drifting.
import { BUILTIN_PERSONA_LINK_PLATFORMS } from '@commonpub/persona';
import { useApiError } from '../../composables/useApiError';
import ProfileParent from '../../pages/settings/profile.vue';

const here = dirname(fileURLToPath(import.meta.url));
const pagesDir = resolve(here, '../../pages/settings');
const childDir = resolve(pagesDir, 'profile');

// --- shared stubs -----------------------------------------------------------

const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: String, default: '' } },
  setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()),
});

const NuxtPage = defineComponent({ name: 'NuxtPage', setup: () => () => h('div', { class: 'stub-page' }) });

const persona = ref(false);
const routePath = ref('/settings/profile/basics');
const navigateTo = vi.fn((_to: string, _opts?: Record<string, unknown>) => {});
const toastSuccess = vi.fn();
const toastError = vi.fn();
const uploadFile = vi.fn(async (_file: Blob, _purpose?: string) => ({ url: '/uploads/x.png' }));
const $fetch = vi.fn(async (_url: string, _opts?: Record<string, unknown>) => ({}) as unknown);
const leaveGuards: Array<(to: unknown, from: unknown, next: (ok?: false) => void) => void> = [];

const profileRef = ref<Record<string, unknown> | null>(null);

function makeProfile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'u1',
    username: 'sam',
    displayName: 'Sam',
    headline: 'Maker',
    bio: 'Bio text',
    location: 'Berlin',
    pronouns: 'they/them',
    avatarUrl: '/uploads/a.png',
    bannerUrl: '/uploads/b.png',
    website: 'https://sam.example',
    socialLinks: { github: 'https://github.com/sam' },
    skills: ['soldering'],
    experience: [
      { title: 'Engineer', company: 'Acme', startDate: '2020-01', endDate: '', description: 'Built things' },
    ],
    ...overrides,
  };
}

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSeoMeta: () => {},
  useSiteName: () => 'Test',
  useFeatures: () => ({ persona, dataSharingConsents: ref(false), referralLinks: ref(false) }),
  useRoute: () => ({ path: routePath.value }),
  useToast: () => ({ success: toastSuccess, error: toastError, show: vi.fn() }),
  useApiError,
  useFileUpload: () => ({ uploadFile }),
  useFetch: vi.fn(async () => ({ data: profileRef })),
  onBeforeRouteLeave: (guard: (to: unknown, from: unknown, next: (ok?: false) => void) => void) => {
    leaveGuards.push(guard);
  },
  navigateTo,
  $fetch,
  confirm: () => false,
});

beforeEach(() => {
  persona.value = false;
  routePath.value = '/settings/profile/basics';
  profileRef.value = makeProfile();
  navigateTo.mockClear();
  toastSuccess.mockClear();
  toastError.mockClear();
  uploadFile.mockClear();
  $fetch.mockClear();
  $fetch.mockImplementation(async () => ({}));
  leaveGuards.length = 0;
});

// --- the parent: sub-navigation ---------------------------------------------

function mountParent() {
  return render(ProfileParent, { global: { stubs: { NuxtLink, NuxtPage } } });
}

function hrefs(container: Element): string[] {
  return Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
}

describe('/settings/profile — the parent tab strip', () => {
  it('renders the three always-on tabs and the child outlet', () => {
    const { container } = mountParent();
    expect(hrefs(container)).toEqual([
      '/settings/profile/basics',
      '/settings/profile/links',
      '/settings/profile/experience',
    ]);
    // Guard: without the outlet the tabs would be a nav to nowhere, and every
    // absence assertion below would pass for the wrong reason.
    expect(container.querySelector('.stub-page')).not.toBeNull();
  });

  it('adds the questions tab only when `persona` is on (off is the default)', () => {
    expect(hrefs(mountParent().container)).not.toContain('/settings/profile/questions');
    persona.value = true;
    expect(hrefs(mountParent().container)).toContain('/settings/profile/questions');
  });

  it('names the questions tab for the member, never "persona"', () => {
    persona.value = true;
    const text = mountParent().container.textContent ?? '';
    expect(text).toContain('About you');
    expect(text.toLowerCase()).not.toContain('persona');
  });

  it('marks exactly the open tab with aria-current="page"', () => {
    routePath.value = '/settings/profile/links';
    const { container } = mountParent();
    const current = Array.from(container.querySelectorAll('[aria-current="page"]'));
    expect(current).toHaveLength(1);
    expect(current[0]!.getAttribute('href')).toBe('/settings/profile/links');
  });

  it('marks nothing when the open path is not a tab', () => {
    routePath.value = '/settings/profile';
    expect(mountParent().container.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
  });

  it('labels the tab strip and keeps every tab a real link (so Tab reaches it)', () => {
    const { container } = mountParent();
    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('Profile sections');
    for (const anchor of Array.from(container.querySelectorAll('a'))) {
      expect(anchor.getAttribute('href')).toMatch(/^\/settings\/profile\//);
    }
  });

  it('carries a visible focus style and no em dash in its copy', () => {
    const raw = readFileSync(resolve(pagesDir, 'profile.vue'), 'utf8');
    expect(raw).toContain('.cpub-profile-settings-tab:focus-visible');
    // A view-identity class collision with the PUBLIC profile page would make a
    // style change to one silently redraw the other.
    expect(raw).not.toContain('class="cpub-profile-tabs"');
    persona.value = true;
    const text = mountParent().container.textContent ?? '';
    expect(text.length).toBeGreaterThan(20);
    expect(text).not.toMatch(/—/);
  });
});

// --- the two redirects ------------------------------------------------------

describe('redirects', () => {
  it('/settings/profile sends the member to the first tab', async () => {
    const mod = await import('../../pages/settings/profile/index.vue');
    render(mod.default);
    expect(navigateTo).toHaveBeenCalledWith('/settings/profile/basics', { replace: true });
  });

  it('/settings/persona sends the member to the questions tab, not to a 404', async () => {
    const mod = await import('../../pages/settings/persona.vue');
    render(mod.default);
    expect(navigateTo).toHaveBeenCalledWith('/settings/profile/questions', { replace: true });
  });
});

// --- the children -----------------------------------------------------------

const mounted: Array<{ app: App; el: HTMLElement }> = [];

/**
 * Each child has a top-level `await useFetch`, so its setup is async and Vue
 * needs a Suspense boundary. `@testing-library/vue`'s render cannot supply one
 * that resolves, so the boundary is mounted with `createApp` against real DOM.
 */
async function mountChild(component: unknown): Promise<HTMLElement> {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const Wrapper = defineComponent({
    setup: () => () => h(Suspense, null, { default: () => h(component as never) }),
  });
  const app = createApp(Wrapper);
  app.component('NuxtLink', NuxtLink);
  app.mount(el);
  mounted.push({ app, el });
  for (let i = 0; i < 4; i += 1) {
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();
  }
  return el;
}

afterEach(() => {
  while (mounted.length) {
    const entry = mounted.pop()!;
    entry.app.unmount();
    entry.el.remove();
  }
});

function ids(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('input, textarea, select'))
    .map((e) => e.getAttribute('id') ?? '')
    .filter(Boolean);
}

async function submit(container: HTMLElement): Promise<void> {
  await fireEvent.submit(container.querySelector('form')!);
  await nextTick();
}

function bodyOf(call: unknown[]): Record<string, unknown> {
  return (call[1] as { body: Record<string, unknown> }).body;
}

describe('basics.vue', () => {
  it('renders the identity fields, seeded from GET /api/profile', async () => {
    const mod = await import('../../pages/settings/profile/basics.vue');
    const container = await mountChild(mod.default);
    expect(ids(container)).toEqual(
      expect.arrayContaining(['displayName', 'username', 'headline', 'bio', 'location', 'pronouns']),
    );
    expect(container.querySelector<HTMLInputElement>('#displayName')!.value).toBe('Sam');
    expect(container.querySelector<HTMLInputElement>('#pronouns')!.value).toBe('they/them');
    // Username is shown and not editable; changing it is not a profile edit.
    expect(container.querySelector<HTMLInputElement>('#username')!.readOnly).toBe(true);
    // The avatar and banner widgets stay here, as bespoke controls.
    expect(container.querySelector('.cpub-avatar-upload')).not.toBeNull();
    expect(container.querySelector('.cpub-banner-upload')).not.toBeNull();
  });

  it('PUTs only the keys this tab owns, so a save cannot blank another tab', async () => {
    const mod = await import('../../pages/settings/profile/basics.vue');
    const container = await mountChild(mod.default);
    await submit(container);
    expect($fetch).toHaveBeenCalledTimes(1);
    const body = bodyOf($fetch.mock.calls[0]!);
    expect(Object.keys(body).sort()).toEqual(
      ['avatarUrl', 'bannerUrl', 'bio', 'displayName', 'headline', 'location', 'pronouns'].sort(),
    );
    // The fields the other tabs own must be ABSENT, not empty: `updateUserProfile`
    // skips an undefined key but would happily write an empty object or array.
    expect(body).not.toHaveProperty('socialLinks');
    expect(body).not.toHaveProperty('skills');
    expect(body).not.toHaveProperty('experience');
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('surfaces a save failure instead of claiming success', async () => {
    $fetch.mockImplementation(async () => {
      throw { data: { data: { errors: { headline: ['Too long'] } } } };
    });
    const mod = await import('../../pages/settings/profile/basics.vue');
    const container = await mountChild(mod.default);
    await submit(container);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith('headline: Too long');
  });
});

describe('links.vue', () => {
  it('renders one input per built-in platform, plus the website column', async () => {
    const mod = await import('../../pages/settings/profile/links.vue');
    const container = await mountChild(mod.default);
    for (const platform of BUILTIN_PERSONA_LINK_PLATFORMS) {
      expect(container.querySelector(`#social-${platform.key}`)).not.toBeNull();
    }
    expect(container.querySelector<HTMLInputElement>('#link-website')!.value).toBe('https://sam.example');
    expect(container.querySelector<HTMLInputElement>('#social-github')!.value).toBe('https://github.com/sam');
  });

  it('gives an operator-declared platform an input instead of hiding it', async () => {
    profileRef.value = makeProfile({ socialLinks: { github: 'https://github.com/sam', gitlab: 'https://gitlab.com/sam' } });
    const mod = await import('../../pages/settings/profile/links.vue');
    const container = await mountChild(mod.default);
    const extra = container.querySelector<HTMLInputElement>('#social-gitlab');
    expect(extra).not.toBeNull();
    expect(extra!.value).toBe('https://gitlab.com/sam');
  });

  it('sends back EVERY stored platform, because socialLinks is a whole-object replace', async () => {
    profileRef.value = makeProfile({ socialLinks: { github: 'https://github.com/sam', gitlab: 'https://gitlab.com/sam' } });
    const mod = await import('../../pages/settings/profile/links.vue');
    const container = await mountChild(mod.default);
    await submit(container);
    const body = bodyOf($fetch.mock.calls[0]!);
    expect(Object.keys(body).sort()).toEqual(['socialLinks', 'website']);
    const links = body.socialLinks as Record<string, string>;
    expect(links.github).toBe('https://github.com/sam');
    // The regression this guards: a form seeded with only the built-in keys
    // silently DELETED a platform the operator declared and the member filled.
    expect(links.gitlab).toBe('https://gitlab.com/sam');
  });

  it('mounts the per-platform sharing control, and shows no sharing copy with the flags off', async () => {
    // The mount is asserted in the SOURCE rather than the DOM because the
    // component is auto-imported by Nuxt and is a stub in this harness. A
    // component with no call site is dead code that reads exactly like finished
    // work, which is the failure this line exists to catch.
    const raw = readFileSync(resolve(childDir, 'links.vue'), 'utf8');
    expect(raw).toContain('<PersonaLinkSharing />');
    // OUTSIDE the form element: a save that also granted a disclosure would be
    // the bundling pattern the whole design exists to avoid.
    expect(raw.indexOf('<PersonaLinkSharing />')).toBeGreaterThan(raw.indexOf('</form>') - 1200);
    // And not inside the per-platform loop, which would mount it N times.
    const loopStart = raw.indexOf('v-for="platform in allPlatforms"');
    expect(loopStart).toBeGreaterThan(-1);
    expect(raw.indexOf('<PersonaLinkSharing />')).toBeGreaterThan(loopStart);

    const mod = await import('../../pages/settings/profile/links.vue');
    const container = await mountChild(mod.default);
    // An instance may run persona for purely operational questions. With the
    // sharing flags off, no sharing language may appear anywhere. The mounted
    // control renders nothing at all in that state, which is why this still
    // holds with it present.
    const text = (container.textContent ?? '').toLowerCase();
    expect(text.length, 'the page rendered something to sweep').toBeGreaterThan(40);
    for (const word of ['recruiter', 'sponsor', 'statistic', 'shared with', 'third part']) {
      expect(text).not.toContain(word);
    }
    // Each row is addressable by platform key, which is the key the sharing
    // table stores.
    expect(container.querySelectorAll('[data-platform]').length).toBe(BUILTIN_PERSONA_LINK_PLATFORMS.length);
  });

  it('mirrors BUILTIN_PERSONA_LINK_PLATFORMS exactly (keys, labels, placeholders)', () => {
    const raw = readFileSync(resolve(childDir, 'links.vue'), 'utf8');
    const block = raw.slice(
      raw.indexOf('const PLATFORMS'),
      raw.indexOf('];', raw.indexOf('const PLATFORMS')),
    );
    const entries = Array.from(
      block.matchAll(/\{\s*key:\s*'([^']+)',\s*label:\s*'([^']+)',\s*placeholder:\s*'([^']+)'\s*\}/g),
    ).map((m) => ({ key: m[1]!, label: m[2]!, placeholder: m[3]! }));
    // Positive control: a regex that matched nothing would make the comparison
    // below vacuous in the direction that matters.
    expect(entries.length).toBe(BUILTIN_PERSONA_LINK_PLATFORMS.length);
    expect(entries).toEqual(
      BUILTIN_PERSONA_LINK_PLATFORMS.map((p) => ({ key: p.key, label: p.label, placeholder: p.placeholder })),
    );
  });
});

describe('experience.vue', () => {
  it('renders the stored roles and skills', async () => {
    const mod = await import('../../pages/settings/profile/experience.vue');
    const container = await mountChild(mod.default);
    expect(container.querySelector<HTMLInputElement>('#exp-title-0')!.value).toBe('Engineer');
    expect(container.querySelector<HTMLInputElement>('#exp-company-0')!.value).toBe('Acme');
    const skill = container.querySelector<HTMLInputElement>('input[aria-label="Skill 1"]');
    expect(skill!.value).toBe('soldering');
  });

  it('PUTs only skills and experience, and strips the client-side row id', async () => {
    const mod = await import('../../pages/settings/profile/experience.vue');
    const container = await mountChild(mod.default);
    await submit(container);
    const body = bodyOf($fetch.mock.calls[0]!);
    expect(Object.keys(body).sort()).toEqual(['experience', 'skills']);
    expect(body.skills).toEqual(['soldering']);
    const rows = body.experience as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    // `_id` is a v-for key, not stored shape; `updateProfileSchema` is strict
    // about the row object it accepts.
    expect(rows[0]).not.toHaveProperty('_id');
    expect(rows[0]!.title).toBe('Engineer');
  });

  it('drops an untitled row rather than saving an empty entry', async () => {
    const mod = await import('../../pages/settings/profile/experience.vue');
    const container = await mountChild(mod.default);
    const addButtons = Array.from(container.querySelectorAll('.cpub-btn-add'));
    await fireEvent.click(addButtons[addButtons.length - 1]!);
    await nextTick();
    await submit(container);
    expect((bodyOf($fetch.mock.calls[0]!).experience as unknown[])).toHaveLength(1);
  });
});

describe('the unsaved-changes guard', () => {
  it('is installed by every editing tab, so switching tabs cannot lose an edit', async () => {
    for (const name of ['basics', 'links', 'experience']) {
      leaveGuards.length = 0;
      const mod = await import(`../../pages/settings/profile/${name}.vue`);
      await mountChild(mod.default);
      expect(leaveGuards, `${name}.vue installs no leave guard`).toHaveLength(1);
    }
  });
});

// --- the sweep: no field lives in two tabs ----------------------------------

interface ChildSource { name: string; raw: string; template: string }

function templateOf(raw: string): string {
  const open = raw.indexOf('<template>');
  const close = raw.lastIndexOf('</template>');
  if (open === -1 || close === -1) return '';
  return raw.slice(open + '<template>'.length, close).replace(/<!--[\s\S]*?-->/g, '');
}

const childFiles = readdirSync(childDir).filter((f) => f.endsWith('.vue')).sort();
const children: ChildSource[] = childFiles.map((name) => {
  const raw = readFileSync(resolve(childDir, name), 'utf8');
  return { name, raw, template: templateOf(raw) };
});

/**
 * Every element identifier a tab puts in the DOM: literal `id="x"` and the
 * literal prefix of a dynamic ``:id="`x-${i}`"``. The editing tabs' ids all
 * descend from one original form, so the same field surfacing in two tabs
 * surfaces as the same identifier in two files. Heading ids are swept too;
 * they cost nothing and a shared one would mean a shared section.
 */
function fieldIdsOf(template: string): string[] {
  const out = new Set<string>();
  for (const m of template.matchAll(/\sid="([a-zA-Z][\w-]*)"/g)) out.add(m[1]!);
  for (const m of template.matchAll(/\s:id="`([a-zA-Z][\w-]*)-\$\{/g)) out.add(`${m[1]!}-*`);
  return [...out].sort();
}

describe('the merge: no field is editable in two tabs (R3.5)', () => {
  it('walked the child directory and found every page it expects', () => {
    // `questions.vue` is another agent's file and is swept as soon as it lands,
    // which is the point of reading the directory rather than a list.
    expect(childFiles).toEqual(expect.arrayContaining(['basics.vue', 'experience.vue', 'index.vue', 'links.vue']));
    expect(childFiles.length).toBeGreaterThanOrEqual(4);
    for (const child of children) expect(child.raw.length).toBeGreaterThan(200);
  });

  it('extracted real field ids from each editing tab (the guard on the guard)', () => {
    const counts = Object.fromEntries(children.map((c) => [c.name, fieldIdsOf(c.template).length]));
    expect(counts['basics.vue']).toBeGreaterThanOrEqual(6);
    expect(counts['links.vue']).toBeGreaterThanOrEqual(2);
    expect(counts['experience.vue']).toBeGreaterThanOrEqual(4);
    // index.vue is the redirect and legitimately has none.
    expect(counts['index.vue']).toBe(0);
  });

  it('shares no field id between two tabs', () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const child of children) {
      for (const id of fieldIdsOf(child.template)) {
        const existing = owner.get(id);
        if (existing) clashes.push(`${id}: ${existing} and ${child.name}`);
        else owner.set(id, child.name);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('binds each profile column in exactly one tab', () => {
    // The five columns the two old editors both wrote, plus the three fields
    // that moved out of Basics. One writer each, by name.
    const bindings: Record<string, RegExp> = {
      displayName: /v-model="form\.displayName"/,
      headline: /v-model="form\.headline"/,
      location: /v-model="form\.location"/,
      pronouns: /v-model="form\.pronouns"/,
      bio: /v-model="form\.bio"/,
      website: /v-model="website"/,
      socialLinks: /v-model="socialLinks\[/,
      skills: /v-model="skills\[/,
    };
    for (const [field, pattern] of Object.entries(bindings)) {
      const writers = children.filter((c) => pattern.test(c.template)).map((c) => c.name);
      expect(writers, `${field} must have exactly one editor`).toHaveLength(1);
    }
  });

  it('leaves no second copy of the email notification toggles', () => {
    // `/settings/notifications` owns these and writes the same column. The
    // Profile form's gated duplicate went with the merge.
    for (const child of children) {
      expect(child.raw, `${child.name} still edits email notifications`).not.toContain('emailNotifications');
    }
  });

  it('carries no em dash in any tab copy', () => {
    for (const child of children) {
      expect(child.template, `${child.name}`).not.toMatch(/—/);
    }
  });
});
