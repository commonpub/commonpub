<script setup lang="ts">
/**
 * `<PersonaLinkSharing>` — one toggle per link the member has actually filled
 * in, deciding whether that address is included when this site hands their
 * details to a named recipient (plan phase 3, R3.1 D6).
 *
 * Registered as `<PersonaLinkSharing>` by Nuxt's pathPrefix (the `persona`
 * directory prefix is deduplicated against the `Persona` filename prefix). A
 * bare `<LinkSharing>` renders EMPTY with no error and no test failure, so the
 * mounting page must use the full name.
 *
 * SELF-CONTAINED, WITH NO REQUIRED PROPS, and that is a coordination decision
 * rather than a style one. It reads `GET /api/persona/links` and writes
 * `PUT /api/persona/links` itself, so a page mounts it with `<PersonaLinkSharing />`
 * and needs to know nothing about the shape of the payload. A props-and-emits
 * version would have forced the Links tab to own a fetch, a DTO and an error
 * path for data it does not otherwise touch.
 *
 * IT IS NOT A LINK EDITOR. The addresses live in `users.social_links` and
 * `/settings/profile` owns them. This control changes who the address is sent
 * to, never whether it is on the profile, and the copy says so in the first
 * sentence because that is the exact confusion the whole correction exists to
 * remove: a member who reads "share my GitHub" as "put my GitHub on my profile"
 * has been asked the wrong question.
 *
 * NOTHING RENDERS WHEN NOTHING CAN BE SHARED. `sharingOffered` is false unless
 * the `dataSharingConsents` flag is on AND a recipient with its paperwork has
 * been declared for a purpose covering `profile_links`. An instance running
 * `persona` for operational questions alone (plan R2.3, the makerspace asking
 * which tools you are trained on) must see no sharing language anywhere, and
 * "recruiter sharing is off" is still sharing language: it teaches a member that
 * recruiters are somewhere in this software. So the whole block is absent.
 *
 * A PLATFORM WITH NO ADDRESS GETS NO TOGGLE. The route returns only platforms
 * this member has filled in. A control over nothing is noise, and a row per
 * supported platform would read as a list of accounts this person has.
 *
 * NO `:href` ANYWHERE. The addresses are rendered as text. `users.social_links`
 * holds rows written long before the current URL validators, and this repo has
 * shipped a `javascript:` href twice; not rendering an anchor to a stored URL at
 * all is stronger than sanitising one, and this surface has no reason to
 * navigate anywhere.
 */
import { computed, ref, watch } from 'vue';

/**
 * Mirrors `PersonaLinkSharingRow` / `PersonaLinkSharingResponse` from
 * `server/api/persona/links.get.ts`. Declared structurally rather than imported
 * because a client component cannot pull in a Nitro route module, and
 * `<script setup>` forbids ES exports so it cannot live in a shared file inside
 * a components directory either (that file would be scanned as a component and
 * break `typecheck` on its missing default export).
 */
interface LinkSharingRow {
  key: string;
  label: string;
  /** Rendered as text. Never an href. */
  url: string;
  shared: boolean;
}

interface LinkSharingPayload {
  platforms: LinkSharingRow[];
  sharingOffered: boolean;
}

const props = withDefaults(defineProps<{
  /** Keeps every id unique if a page ever renders two of these. */
  idPrefix?: string;
}>(), { idPrefix: 'cpub-link-sharing' });

const { persona, dataSharingConsents } = useFeatures();

/**
 * Per-viewer data, so `server: false`: it has no business in the SSR payload or
 * in any shared cache. There is no placeholder and no seeded row list either.
 * Rendering an "off" switch before the answer arrives would state a member's
 * choice back to them before it is known, and a control that flips under the
 * cursor once the fetch lands is worse than a control that appears late.
 */
const { data, pending } = useLazyFetch<LinkSharingPayload>('/api/persona/links', {
  server: false,
  default: () => null,
});

/**
 * The rows this component renders, seeded from the fetch and thereafter replaced
 * by whatever a write answers with.
 *
 * A watcher rather than a computed, and the exception is stated rather than
 * assumed: seeding client state from a fetch inside `watch(..., immediate)` is
 * the recorded cause of hydration mismatches in this repo, and it cannot be one
 * here because `server: false` means the server renders no part of this data.
 */
const rows = ref<LinkSharingRow[]>([]);
watch(
  data,
  (value) => {
    if (value) rows.value = value.platforms.map((r) => ({ ...r }));
  },
  { immediate: true },
);

/** The key whose write is in flight, so only that row's switch is disabled. */
const busyKey = ref<string | null>(null);
const failure = ref<string | null>(null);

const visible = computed<boolean>(
  () =>
    persona.value === true
    && dataSharingConsents.value === true
    // The server's answer, not the flag alone: a flag with no declared recipient
    // offers nothing, and a control for a disclosure that cannot happen is the
    // consent theatre this correction removes.
    && data.value?.sharingOffered === true
    && rows.value.length > 0,
);

function rowLabelId(key: string): string {
  return `${props.idPrefix}-label-${key}`;
}
function rowStateId(key: string): string {
  return `${props.idPrefix}-state-${key}`;
}

/** The one sentence under each switch. Present tense, no numbers, no urgency. */
function stateText(row: LinkSharingRow): string {
  return row.shared
    ? 'Included when your details are sent.'
    : 'Not included. It stays on your profile.';
}

async function toggle(row: LinkSharingRow): Promise<void> {
  if (busyKey.value !== null) return;

  // The whole set, computed BEFORE the optimistic flip, because the route is a
  // replacement and not a patch: a key left out is cleared, which is what makes
  // turning the last one off actually work.
  const next = rows.value
    .filter((r) => (r.key === row.key ? !r.shared : r.shared))
    .map((r) => r.key);

  const before = rows.value.map((r) => ({ ...r }));
  const target = rows.value.find((r) => r.key === row.key);
  if (target) target.shared = !target.shared;

  busyKey.value = row.key;
  failure.value = null;
  try {
    const saved = await $fetch<LinkSharingPayload>('/api/persona/links', {
      method: 'PUT',
      body: { platforms: next },
    });
    // Re-render from what the server stored, never from the optimistic guess.
    rows.value = saved.platforms.map((r) => ({ ...r }));
  } catch {
    // Put the switch back where it was. A control that stays where the member
    // left it after a failed write is a control that lies about a disclosure.
    rows.value = before;
    failure.value = 'That change could not be saved. Nothing has changed, and you can try again.';
  } finally {
    busyKey.value = null;
  }
}
</script>

<template>
  <section
    v-if="visible"
    class="cpub-link-sharing"
    :aria-labelledby="`${props.idPrefix}-title`"
    :aria-busy="pending ? 'true' : 'false'"
  >
    <div class="cpub-sec-head">
      <h2 :id="`${props.idPrefix}-title`">Sharing these links</h2>
    </div>

    <p class="cpub-link-sharing-lede">
      These addresses are on your public profile already, and nothing here changes that.
      This decides which of them are included when this site sends your details to the
      recipients you have agreed to on your
      <NuxtLink to="/settings/privacy">privacy settings</NuxtLink> page.
    </p>

    <ul class="cpub-link-sharing-rows">
      <li v-for="row in rows" :key="row.key" class="cpub-link-sharing-row">
        <span class="cpub-link-sharing-text">
          <span :id="rowLabelId(row.key)" class="cpub-link-sharing-label">{{ row.label }}</span>
          <!-- Text, never an anchor. See the header. -->
          <span class="cpub-link-sharing-url">{{ row.url }}</span>
          <span :id="rowStateId(row.key)" class="cpub-link-sharing-state">{{ stateText(row) }}</span>
        </span>

        <!-- The same control at the same size in both directions. There is no
             smaller, lighter way to say no. -->
        <button
          type="button"
          role="switch"
          class="cpub-link-sharing-switch"
          :aria-checked="row.shared ? 'true' : 'false'"
          :aria-labelledby="rowLabelId(row.key)"
          :aria-describedby="rowStateId(row.key)"
          :disabled="busyKey !== null"
          @click="toggle(row)"
        >
          <span class="cpub-link-sharing-track" aria-hidden="true">
            <span class="cpub-link-sharing-thumb"></span>
          </span>
          <span class="cpub-link-sharing-switch-text">{{ row.shared ? 'On' : 'Off' }}</span>
        </button>
      </li>
    </ul>

    <p v-if="failure" role="alert" class="cpub-link-sharing-error">{{ failure }}</p>

    <!-- The honest sentence, and it must not be softened: turning a link off
         stops it being sent again and cannot unring a bell. -->
    <p class="cpub-link-sharing-note">
      Turning one off leaves it out of everything sent from then on. It cannot recall what
      was already shared.
    </p>
  </section>
</template>

<style scoped>
/* Layout only. Every colour, font and border comes from a token, and
   `.cpub-sec-head` is a global rule from packages/ui/theme/components.css. */
.cpub-link-sharing {
  margin-bottom: var(--space-6, 32px);
}

.cpub-link-sharing-lede,
.cpub-link-sharing-note {
  margin: 0 0 var(--space-3, 12px);
  font-size: var(--text-sm, 14px);
  line-height: 1.7;
  color: var(--text-dim);
}

.cpub-link-sharing-note {
  margin: var(--space-3, 12px) 0 0;
}

.cpub-link-sharing-rows {
  list-style: none;
  margin: 0;
  padding: 0;
}

.cpub-link-sharing-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4, 16px);
  padding: var(--space-3, 12px) 0;
  border-bottom: var(--border-width-default) solid var(--border);
}

.cpub-link-sharing-row:last-child {
  border-bottom: none;
}

.cpub-link-sharing-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 4px);
  min-width: 0;
}

.cpub-link-sharing-label {
  font-size: var(--text-base, 16px);
  color: var(--text);
}

/* A member-supplied address: a single unbroken token must wrap rather than push
   the settings page sideways at 390px. */
.cpub-link-sharing-url {
  font-family: var(--font-mono);
  font-size: var(--text-xs, 12px);
  color: var(--text-faint);
  overflow-wrap: anywhere;
}

.cpub-link-sharing-state {
  font-size: var(--text-sm, 14px);
  color: var(--text-dim);
}

.cpub-link-sharing-switch {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2, 8px);
  flex-shrink: 0;
  /* The WCAG 2.1 AA target floor this repo holds itself to. */
  min-height: 44px;
  min-width: 44px;
  padding: var(--space-2, 8px) var(--space-4, 16px);
  border: var(--border-width-default) solid var(--border);
  background: var(--surface2);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--text-xs, 12px);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.cpub-link-sharing-switch:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.cpub-link-sharing-switch:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cpub-link-sharing-switch[aria-checked='true'] {
  border-color: var(--accent);
  background: var(--accent-bg);
  color: var(--accent);
}

.cpub-link-sharing-track {
  display: inline-flex;
  align-items: center;
  width: 34px;
  height: 18px;
  padding: 2px;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
}

.cpub-link-sharing-switch[aria-checked='true'] .cpub-link-sharing-track {
  border-color: var(--accent);
  justify-content: flex-end;
}

.cpub-link-sharing-thumb {
  display: block;
  width: 12px;
  height: 12px;
  background: var(--text-dim);
}

.cpub-link-sharing-switch[aria-checked='true'] .cpub-link-sharing-thumb {
  background: var(--accent);
}

.cpub-link-sharing-error {
  margin: var(--space-2, 8px) 0 0;
  font-size: var(--text-sm, 14px);
  color: var(--red-text);
}

@media (max-width: 640px) {
  .cpub-link-sharing-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
