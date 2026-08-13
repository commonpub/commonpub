/**
 * Component tests for `/admin/api-keys`, specifically the `read:members`
 * recipient binding (member-visibility plan section 6, second bullet).
 *
 * `read:members` is the only scope on this instance that returns identified
 * people rather than aggregates, and the only one with a SECOND gate behind it:
 * the key must carry a `recipient_id`, or the endpoint refuses every request.
 * A form that lets an operator mint such a key without one produces a key that
 * looks correct, appears in the list, and reads nothing. The operator finds out
 * from their consumer's 403.
 *
 * So the assertions here are about the two claims this form makes:
 *
 *  1. it will not create an unbound `read:members` key, and it says why;
 *  2. the `read:*` disclaimer names every wildcard-protected scope, DERIVED
 *     from `WILDCARD_PROTECTED_SCOPES` rather than hand-written, because a
 *     hand-written sentence is how a checkbox comes to promise something the
 *     gate refuses.
 *
 * The second one is asserted against the real exported constant, so adding a
 * protected scope later cannot leave this sentence behind.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/vue';
import {
  Suspense,
  createApp,
  defineComponent,
  h,
  ref,
  computed,
  reactive,
  watch,
  nextTick,
  type App,
  type Ref,
} from 'vue';
import axe from 'axe-core';
import { PUBLIC_API_SCOPES, WILDCARD_PROTECTED_SCOPES } from '@commonpub/schema';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// --- Wire fixtures ---------------------------------------------------------

interface WireKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  description: string | null;
  allowedOrigins: string[] | null;
  rateLimitPerMinute: number;
  createdBy: null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedBy: null;
  recipientId?: string | null;
}

function makeKey(overrides: Partial<WireKey> = {}): WireKey {
  return {
    id: 'k1',
    name: 'Analytics dashboard',
    prefix: 'cpub_abc',
    scopes: ['read:content'],
    description: null,
    allowedOrigins: null,
    rateLimitPerMinute: 60,
    createdBy: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    revokedBy: null,
    ...overrides,
  };
}

const RECIPIENTS = {
  configRecipients: [
    { id: 'acme', name: 'Acme Robotics', purposes: ['recruiter_visibility'] },
  ],
  storedRecipients: [
    { id: 'globex', name: 'Globex', purposes: ['sponsor_sharing'] },
    // Same id as the config half. The file wins, so the union must keep ONE.
    { id: 'acme', name: 'Acme (stale copy)', purposes: [] },
  ],
};

// --- Auto-import stubs -----------------------------------------------------

const publicApiFlag = ref(true);
const keysRef: Ref<{ items: WireKey[]; total: number } | null> = ref({
  items: [makeKey()],
  total: 1,
});
const pendingRef = ref(false);
const errorRef: Ref<unknown> = ref(null);

const refresh = vi.fn(async () => {});
const toastSuccess = vi.fn();
const toastError = vi.fn();

/** Every `$fetch` the page makes, so the create body can be asserted exactly. */
const fetchCalls: Array<{ url: string; options?: Record<string, unknown> }> = [];
let recipientsFails = false;
let recipientsEmpty = false;

const $fetch = vi.fn(async (url: string, options?: Record<string, unknown>) => {
  fetchCalls.push({ url, options });
  if (url === '/api/admin/data-sharing/recipients') {
    if (recipientsFails) throw new Error('403');
    if (recipientsEmpty) return { configRecipients: [], storedRecipients: [] };
    return RECIPIENTS;
  }
  if (url === '/api/admin/api-keys') {
    return { key: makeKey({ id: 'k2', name: 'Recruiter feed' }), token: 'cpub_secret' };
  }
  return {};
});

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSeoMeta: () => {},
  useSiteName: () => 'Test',
  useToast: () => ({ success: toastSuccess, error: toastError }),
  useFeatures: () => ({ publicApi: computed(() => publicApiFlag.value) }),
  useFetch: () => ({ data: keysRef, pending: pendingRef, refresh, error: errorRef }),
  $fetch,
  computed,
  ref,
  reactive,
  watch,
});

const ApiKeysPage = (await import('../api-keys.vue')).default;

/**
 * The page has a top-level `await useFetch`, so its setup is async and Vue needs
 * a Suspense boundary. `@testing-library/vue`'s `render` cannot supply one that
 * resolves: its VTU mount leaves the pending branch in Suspense's hidden
 * container, so every assertion target is EMPTY and every test passes or fails
 * for the wrong reason (verified: the container stays `""` forever). `createApp`
 * gives real DOM. Same pattern as
 * `components/__tests__/privacySettingsPage.test.ts`.
 */
const NuxtLinkStub = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: String, default: '' } },
  setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()),
});

const mountedApps: Array<{ app: App; el: HTMLElement }> = [];

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }
}

const vueWarnings: string[] = [];
let warnSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  fetchCalls.length = 0;
  $fetch.mockClear();
  refresh.mockClear();
  toastSuccess.mockClear();
  toastError.mockClear();
  publicApiFlag.value = true;
  keysRef.value = { items: [makeKey()], total: 1 };
  pendingRef.value = false;
  errorRef.value = null;
  recipientsFails = false;
  recipientsEmpty = false;
  vueWarnings.length = 0;
  warnSpy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    vueWarnings.push(args.map(String).join(' '));
  });
});

afterEach(() => {
  while (mountedApps.length) {
    const entry = mountedApps.pop()!;
    entry.app.unmount();
    entry.el.remove();
  }
  warnSpy?.mockRestore();
  warnSpy = null;
  expect(vueWarnings, vueWarnings.join('\n')).toHaveLength(0);
});

async function mount(): Promise<{ container: HTMLElement }> {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const Wrapper = defineComponent({
    setup: () => () => h(Suspense, null, { default: () => h(ApiKeysPage) }),
  });
  const app = createApp(Wrapper);
  app.component('NuxtLink', NuxtLinkStub);
  app.mount(el);
  mountedApps.push({ app, el });
  await settle();
  // The guard on the guard: an unresolved Suspense renders nothing, and every
  // assertion in this file would then pass against an empty container.
  expect(el.textContent ?? '').toContain('API Keys');
  return { container: el };
}

function text(container: Element): string {
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Open the create form and tick a scope by its rendered code label. */
async function openFormAndTick(container: Element, scope: string): Promise<void> {
  const newKey = [...container.querySelectorAll('button')].find((b) =>
    (b.textContent ?? '').includes('New key'),
  );
  await fireEvent.click(newKey as HTMLButtonElement);
  const chip = [...container.querySelectorAll('.cpub-scope-chip')].find(
    (l) => l.querySelector('code')?.textContent === scope,
  );
  await fireEvent.click(chip?.querySelector('input') as HTMLInputElement);
  await settle();
}

async function fillName(container: Element, name: string): Promise<void> {
  await fireEvent.update(container.querySelector('#key-name') as HTMLInputElement, name);
}

async function submit(container: Element): Promise<void> {
  const create = [...container.querySelectorAll('button')].find((b) =>
    (b.textContent ?? '').includes('Create key'),
  );
  await fireEvent.click(create as HTMLButtonElement);
  await settle();
}

// --- The disclaimer, derived --------------------------------------------

describe('/admin/api-keys — the read:* disclaimer names every protected scope', () => {
  it('lists read:members, from the exported constant rather than a hand-written line', async () => {
    const { container } = await mount();
    const newKey = [...container.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('New key'),
    );
    await fireEvent.click(newKey as HTMLButtonElement);

    const help = container.querySelector('#key-scopes-help');
    expect(help).not.toBeNull();
    const body = (help?.textContent ?? '').replace(/\s+/g, ' ');

    // The guard on the guard: the constant is non-empty, so a list that lost
    // its entries could not make this test vacuously green.
    expect(WILDCARD_PROTECTED_SCOPES.length).toBeGreaterThan(0);
    expect(WILDCARD_PROTECTED_SCOPES).toContain('read:members');
    for (const scope of WILDCARD_PROTECTED_SCOPES) expect(body, scope).toContain(scope);
    expect(body).toContain('which a key has to be given by name');
  });

  it('offers read:members as a scope of its own', async () => {
    const { container } = await mount();
    const newKey = [...container.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('New key'),
    );
    await fireEvent.click(newKey as HTMLButtonElement);

    const codes = [...container.querySelectorAll('.cpub-scope-chip code')].map(
      (c) => c.textContent,
    );
    expect(codes).toContain('read:members');
    // `read:*` is never offered as a tickable chip on this form.
    expect(codes).not.toContain('read:*');
  });
});

// --- The binding gate ------------------------------------------------------

describe('/admin/api-keys — a read:members key cannot be created without a recipient', () => {
  it('refuses to submit and says a key with no recipient reads nothing', async () => {
    const { container } = await mount();
    await openFormAndTick(container, 'read:members');
    await fillName(container, 'Recruiter feed');
    await submit(container);

    expect(text(container)).toContain(
      'Choose the recipient this key belongs to. A key with read:members and no recipient can read nothing.',
    );
    // And nothing was created. The refusal is the point, not the message.
    expect(fetchCalls.some((c) => c.url === '/api/admin/api-keys')).toBe(false);
  });

  it('creates the key once a recipient is chosen, and sends the binding', async () => {
    const { container } = await mount();
    await openFormAndTick(container, 'read:members');
    await fillName(container, 'Recruiter feed');
    await fireEvent.update(container.querySelector('#key-recipient') as HTMLSelectElement, 'acme');
    await submit(container);

    const create = fetchCalls.find((c) => c.url === '/api/admin/api-keys');
    expect(create).toBeDefined();
    expect((create?.options as { body: Record<string, unknown> }).body).toMatchObject({
      name: 'Recruiter feed',
      scopes: ['read:members'],
      recipientId: 'acme',
    });
  });

  it('sends no binding on a key that does not hold the scope', async () => {
    const { container } = await mount();
    await openFormAndTick(container, 'read:content');
    await fillName(container, 'Content feed');
    await submit(container);

    const create = fetchCalls.find((c) => c.url === '/api/admin/api-keys');
    expect((create?.options as { body: Record<string, unknown> }).body).toMatchObject({
      recipientId: null,
    });
  });

  it('clears a chosen recipient when the scope is un-ticked', async () => {
    const { container } = await mount();
    await openFormAndTick(container, 'read:members');
    await fireEvent.update(container.querySelector('#key-recipient') as HTMLSelectElement, 'acme');
    await openFormAndTick(container, 'read:members'); // un-tick
    await openFormAndTick(container, 'read:members'); // tick again
    await fillName(container, 'Recruiter feed');
    await submit(container);

    // A recipient left behind on a key that lost the scope is a claim about
    // whose key it is that nothing enforces.
    expect(text(container)).toContain('Choose the recipient this key belongs to.');
  });
});

// --- The selector itself ---------------------------------------------------

describe('/admin/api-keys — the recipient selector', () => {
  it('asks for recipients only once the scope is actually ticked', async () => {
    const { container } = await mount();
    expect(fetchCalls.some((c) => c.url === '/api/admin/data-sharing/recipients')).toBe(false);

    await openFormAndTick(container, 'read:content');
    expect(fetchCalls.some((c) => c.url === '/api/admin/data-sharing/recipients')).toBe(false);

    await openFormAndTick(container, 'read:members');
    expect(fetchCalls.filter((c) => c.url === '/api/admin/data-sharing/recipients')).toHaveLength(1);
  });

  it('shows the union of both halves, with the config half winning a repeated id', async () => {
    const { container } = await mount();
    await openFormAndTick(container, 'read:members');

    const options = [...container.querySelectorAll('#key-recipient option')].map(
      (o) => o.textContent?.trim(),
    );
    expect(options).toEqual([
      'Choose a recipient',
      'Acme Robotics (acme)',
      'Globex (globex)',
    ]);
    expect(options).not.toContain('Acme (stale copy) (acme)');
  });

  it('explains that recipients need a different permission when the read fails', async () => {
    recipientsFails = true;
    const { container } = await mount();
    await openFormAndTick(container, 'read:members');

    expect(text(container)).toContain(
      'Recipients could not be loaded. Reading them needs the settings permission, so ask an operator who has it to add one in Data sharing.',
    );
    expect(container.querySelector('#key-recipient')).toBeNull();
  });

  it('says the key would read nothing when no recipient is declared at all', async () => {
    recipientsEmpty = true;
    const { container } = await mount();
    await openFormAndTick(container, 'read:members');

    expect(text(container)).toContain(
      'No recipient is declared on this site, so this key cannot be bound to one and would read nothing.',
    );
  });

  it('explains what the scope does before the operator picks anything', async () => {
    const { container } = await mount();
    await openFormAndTick(container, 'read:members');

    const help = container.querySelector('#key-recipient-help');
    const body = (help?.textContent ?? '').replace(/\s+/g, ' ');
    expect(body).toContain('lists the individual members who chose to be visible');
    expect(body).toContain('shown to those members');
    expect(body).toContain('A key with no recipient can read nothing.');
    // And the control points at it, so it is announced with the field.
    expect(container.querySelector('#key-recipient')?.getAttribute('aria-describedby')).toBe(
      'key-recipient-help',
    );
  });

  it('renders no selector at all for a key that does not list members', async () => {
    const { container } = await mount();
    await openFormAndTick(container, 'read:content');
    expect(container.querySelector('#key-recipient')).toBeNull();
    expect(container.querySelector('#key-recipient-help')).toBeNull();
  });
});

// --- The list --------------------------------------------------------------

describe('/admin/api-keys — an unbound member key is called out in the list', () => {
  it('says it reads nothing', async () => {
    keysRef.value = { items: [makeKey({ scopes: ['read:members'] })], total: 1 };
    const { container } = await mount();

    expect(text(container)).toContain('No recipient, reads nothing');
  });

  it('names the recipient when the key carries one', async () => {
    keysRef.value = {
      items: [makeKey({ scopes: ['read:members'], recipientId: 'acme' })],
      total: 1,
    };
    const { container } = await mount();

    expect(text(container)).toContain('Recipient: acme');
    expect(text(container)).not.toContain('No recipient, reads nothing');
  });

  it('says nothing about recipients for a key without the scope', async () => {
    const { container } = await mount();
    expect(text(container)).not.toContain('No recipient, reads nothing');
    expect(container.querySelector('.cpub-key-recipient')).toBeNull();
  });
});

// --- Accessibility ---------------------------------------------------------

describe('/admin/api-keys — accessibility of the new control', () => {
  it('labels the recipient select and has no axe violations with it open', async () => {
    const { container } = await mount();
    await openFormAndTick(container, 'read:members');

    const label = container.querySelector('label[for="key-recipient"]');
    expect(label?.textContent?.trim()).toBe('Recipient');

    const results = await axe.run(container, {
      rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } },
    });
    expect(results.violations, JSON.stringify(results.violations.map((v) => v.id))).toEqual([]);
  });

  it('announces the refusal, so a screen reader user is not left guessing', async () => {
    const { container } = await mount();
    await openFormAndTick(container, 'read:members');
    await fillName(container, 'Recruiter feed');
    await submit(container);

    const alerts = [...container.querySelectorAll('[role="alert"]')].map((a) =>
      (a.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(alerts.join(' ')).toContain('Choose the recipient this key belongs to.');
  });
});

// --- The scope literal ------------------------------------------------------

describe('/admin/api-keys — the scope this form gates on is a real one', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(resolve(here, '../api-keys.vue'), 'utf8');

  it('the guard on the guard: it read the real page file', () => {
    expect(raw.length).toBeGreaterThan(8000);
    expect(raw).toContain('const MEMBER_SCOPE =');
  });

  it("declares MEMBER_SCOPE once, and it is a scope the server actually knows", () => {
    // The whole binding gate keys off this literal. A typo, or a scope renamed
    // in `@commonpub/schema`, would leave a form that never asks for a recipient
    // and a key that reads nothing, with nothing failing anywhere.
    const declarations = [...raw.matchAll(/const MEMBER_SCOPE = '([^']+)'/g)];
    expect(declarations).toHaveLength(1);
    const scope = declarations[0]![1] as string;

    expect(PUBLIC_API_SCOPES as readonly string[]).toContain(scope);
    // And it is wildcard protected, which is the reason it needs a second gate
    // at all: `read:*` must not be able to reach it.
    expect(WILDCARD_PROTECTED_SCOPES as readonly string[]).toContain(scope);
  });

  it('never hardcodes the scope again in the template', () => {
    const template = raw.slice(raw.indexOf('<template>'), raw.lastIndexOf('</template>'));
    expect(template).not.toContain("'read:members'");
    expect(template).toContain('MEMBER_SCOPE');
  });
});
