<script setup lang="ts">
import { isFormFieldPii, type FormField } from '@commonpub/schema';
import { formatAddressLines } from '../../utils/contestSubmission';
import { fetchAllPages } from '../../utils/fetchAllPages';

// Organizer-only registrants panel (P5). Reads the gated registrants route and
// renders every full participant with their answers label-mapped by the contest's
// (effective) registration template. PII columns appear only when the route says
// the viewer holds contest.pii. The CSV downloads mirror the same gating.
//
// Two views (session 260): the full TABLE, and a SHIPPING view of cards with name,
// contact fields and a formatted address, built for sending dev kits. Addresses
// are stored as JSON strings and are formatted here, at read time, so every answer
// already submitted reads correctly. The table used to print the raw JSON.

const props = defineProps<{ slug: string }>();

interface Registrant {
  userId: string;
  username: string;
  displayName: string | null;
  registeredAt: string;
  fields: Record<string, string> | null;
  privateFields?: Record<string, string> | null;
  consentCount: number;
}
interface RegistrantsResponse {
  items: Registrant[];
  total: number;
  template: FormField[];
  includePii: boolean;
}

// Every registrant, not just the first page (the service caps a page at 100).
const { data, pending, error } = useLazyAsyncData(
  `registrants-${props.slug}`,
  async () => {
    let meta: Pick<RegistrantsResponse, 'template' | 'includePii'> = { template: [], includePii: false };
    const all = await fetchAllPages<Registrant>(async (offset, limit) => {
      const r = await $fetch<RegistrantsResponse>(`/api/contests/${props.slug}/registrants`, { query: { limit, offset } });
      meta = { template: r.template, includePii: r.includePii };
      return { items: r.items, total: r.total };
    }, { pageSize: 100 });
    return { ...all, ...meta } as RegistrantsResponse;
  },
  { server: false },
);

// Shared source of truth (see @commonpub/schema) — must match the server's write-side
// partition exactly, or a cell reads from the wrong map and renders blank.
const isPii = isFormFieldPii;

// Answer columns: skip section (display) + agreement (consent, not an answer);
// drop PII columns unless the viewer is allowed them.
const columns = computed<FormField[]>(() => {
  const t = data.value?.template ?? [];
  const pii = data.value?.includePii ?? false;
  return t.filter((f: FormField) => f.type !== 'section' && f.type !== 'agreement' && (pii || !isPii(f)));
});

// Contact fields for the shipping view and the shipping CSV, in form order: short
// text, email, phone, address. Same rule as the server's shipping export.
const CONTACT_TYPES = new Set(['text', 'email', 'tel', 'address']);
const contactColumns = computed(() => columns.value.filter((f) => CONTACT_TYPES.has(f.type)));
const hasAddress = computed(() => columns.value.some((f) => f.type === 'address'));
const canShip = computed(() => !!data.value?.includePii && contactColumns.value.length > 0);

// Consent denominator: how many agreement fields the form asks. `consentCount` on a
// registrant is how many they accepted. Consent isn't PII, so it shows to every organizer.
const agreementCount = computed<number>(() => (data.value?.template ?? []).filter((f: FormField) => f.type === 'agreement' && f.mustAccept !== false).length);

function answer(r: Registrant, f: FormField): string {
  const v = isPii(f) ? r.privateFields?.[f.key] : r.fields?.[f.key];
  return v ?? '';
}
function addressLines(r: Registrant, f: FormField): string[] {
  return formatAddressLines(answer(r, f));
}

function fmtDate(iso: string): string {
  return formatLocalDate(iso) ?? iso.slice(0, 10);
}

const view = ref<'table' | 'shipping'>('table');
const query = ref('');

/** Search across a registrant's name, username and every visible answer. */
const visible = computed<Registrant[]>(() => {
  const items = data.value?.items ?? [];
  const q = query.value.trim().toLowerCase();
  if (!q) return items;
  return items.filter((r) => {
    const hay = [r.username, r.displayName ?? '', ...columns.value.map((f) => (f.type === 'address' ? addressLines(r, f).join(' ') : answer(r, f)))]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
});

// Copy to clipboard. The button text confirms it visually; the status region below
// announces it (the buttons carry aria-labels, which a text change can't reach). A
// refused write (permission denied, insecure context) says so on the button
// rather than looking like it worked; the text on screen is still selectable.
const copyResult = ref<{ id: string; ok: boolean } | null>(null);
async function copy(id: string, text: string): Promise<void> {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    /* handled below */
  }
  copyResult.value = { id, ok };
  setTimeout(() => { if (copyResult.value?.id === id) copyResult.value = null; }, ok ? 1600 : 4000);
}
const copyAnnouncement = computed<string>(() =>
  !copyResult.value ? '' : copyResult.value.ok ? 'Copied to clipboard' : 'Copy failed. Select the text to copy it.',
);
function copyLabel(id: string, idle: string): string {
  if (copyResult.value?.id !== id) return idle;
  return copyResult.value.ok ? 'Copied' : 'Copy failed, select the text';
}
function contactBlock(r: Registrant): string {
  const lines = [r.displayName ? `${r.displayName} (@${r.username})` : `@${r.username}`];
  for (const f of contactColumns.value) {
    if (f.type === 'address') {
      const a = addressLines(r, f);
      if (a.length) lines.push(`${f.label}:`, ...a);
    } else {
      const v = answer(r, f).trim();
      if (v) lines.push(`${f.label}: ${v}`);
    }
  }
  return lines.join('\n');
}
</script>

<template>
  <section class="cpub-rp" aria-label="Registrants">
    <p class="cpub-sr-only" role="status">{{ copyAnnouncement }}</p>
    <div class="cpub-rp-head">
      <h3 class="cpub-form-label" style="margin: 0;">Registrants <span v-if="data" class="cpub-rp-count">{{ data.total }}</span></h3>
      <div v-if="data && data.total > 0" class="cpub-rp-actions">
        <a :href="`/api/contests/${slug}/registrants-export`" class="cpub-btn cpub-btn-sm" download>
          <i class="fa-solid fa-file-csv" aria-hidden="true"></i> Export CSV
        </a>
        <a v-if="canShip" :href="`/api/contests/${slug}/registrants-export?format=shipping`" class="cpub-btn cpub-btn-sm" download>
          <i class="fa-solid fa-truck" aria-hidden="true"></i> Shipping list (CSV)
        </a>
      </div>
    </div>

    <p v-if="pending && !data" class="cpub-form-hint">Loading registrants…</p>
    <p v-else-if="error" class="cpub-form-hint cpub-rp-error">Couldn’t load registrants.</p>
    <p v-else-if="!data || data.total === 0" class="cpub-form-hint">No one has registered yet.</p>

    <template v-else>
      <p v-if="!data.includePii" class="cpub-form-hint cpub-rp-note">
        Personal details (addresses, phone numbers, emails) are hidden because your account can’t see entrants’ personal data. An admin can grant it.
      </p>

      <div class="cpub-rp-tools">
        <div v-if="canShip" class="cpub-rp-views" role="group" aria-label="Registrants view">
          <button type="button" class="cpub-rp-view" :aria-pressed="view === 'table'" @click="view = 'table'">
            <i class="fa-solid fa-table" aria-hidden="true"></i> Table
          </button>
          <button type="button" class="cpub-rp-view" :aria-pressed="view === 'shipping'" @click="view = 'shipping'">
            <i class="fa-solid fa-truck" aria-hidden="true"></i> Shipping
          </button>
        </div>
        <label class="cpub-rp-search">
          <span class="cpub-sr-only">Search registrants</span>
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input v-model="query" type="search" placeholder="Search name, city, country…" />
        </label>
        <span class="cpub-rp-showing" aria-live="polite">{{ visible.length }} of {{ data.total }}</span>
      </div>

      <!-- SHIPPING: one card per registrant, everything needed to send a kit. -->
      <ul v-if="view === 'shipping' && canShip" class="cpub-rp-cards">
        <li v-for="r in visible" :key="r.userId" class="cpub-rp-card">
          <div class="cpub-rp-card-head">
            <NuxtLink :to="`/u/${r.username}`" class="cpub-rp-user">{{ r.displayName || r.username }}</NuxtLink>
            <span class="cpub-rp-handle">@{{ r.username }}</span>
          </div>
          <dl class="cpub-rp-card-fields">
            <template v-for="f in contactColumns" :key="f.key">
              <template v-if="f.type === 'address'">
                <dt>{{ f.label }}</dt>
                <dd>
                  <address v-if="addressLines(r, f).length" class="cpub-rp-address">
                    <span v-for="(line, i) in addressLines(r, f)" :key="i">{{ line }}</span>
                  </address>
                  <span v-else class="cpub-rp-missing">Not provided</span>
                  <button
                    v-if="addressLines(r, f).length"
                    type="button"
                    class="cpub-rp-copy"
                    :aria-label="`Copy ${f.label} for ${r.displayName || r.username}`"
                    @click="copy(`${r.userId}:${f.key}`, addressLines(r, f).join('\n'))"
                  >
                    <i class="fa-regular fa-copy" aria-hidden="true"></i>
                    {{ copyLabel(`${r.userId}:${f.key}`, 'Copy address') }}
                  </button>
                </dd>
              </template>
              <template v-else-if="answer(r, f)">
                <dt>{{ f.label }}</dt>
                <dd>{{ answer(r, f) }}</dd>
              </template>
            </template>
          </dl>
          <button
            type="button"
            class="cpub-rp-copy cpub-rp-copy-all"
            :aria-label="`Copy all contact details for ${r.displayName || r.username}`"
            @click="copy(`${r.userId}:all`, contactBlock(r))"
          >
            <i class="fa-regular fa-clipboard" aria-hidden="true"></i>
            {{ copyLabel(`${r.userId}:all`, 'Copy all') }}
          </button>
        </li>
      </ul>

      <!-- TABLE: every answer. -->
      <div v-else class="cpub-rp-scroll">
        <table class="cpub-rp-table">
          <thead>
            <tr>
              <th scope="col">Participant</th>
              <th scope="col">Registered</th>
              <th v-if="agreementCount" scope="col">Consents</th>
              <th v-for="f in columns" :key="f.key" scope="col">
                {{ f.label }}<span v-if="isPii(f)" class="cpub-rp-pii" title="Personal data"> · PII</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in visible" :key="r.userId">
              <td>
                <NuxtLink :to="`/u/${r.username}`" class="cpub-rp-user">{{ r.displayName || r.username }}</NuxtLink>
              </td>
              <td class="cpub-rp-date">{{ fmtDate(r.registeredAt) }}</td>
              <td v-if="agreementCount" class="cpub-rp-consent">
                <span :class="r.consentCount >= agreementCount ? 'cpub-rp-consent-ok' : 'cpub-rp-consent-partial'">
                  <i class="fa-solid" :class="r.consentCount >= agreementCount ? 'fa-circle-check' : 'fa-circle-half-stroke'" aria-hidden="true"></i>
                  {{ r.consentCount }}/{{ agreementCount }}
                </span>
              </td>
              <td v-for="f in columns" :key="f.key">
                <a
                  v-if="f.type === 'file' && answer(r, f)"
                  :href="`/api/files/${answer(r, f)}/raw`"
                  class="cpub-rp-file"
                  target="_blank"
                  rel="noopener"
                ><i class="fa-solid fa-paperclip" aria-hidden="true"></i> View file</a>
                <template v-else-if="f.type === 'address'">
                  <address v-if="addressLines(r, f).length" class="cpub-rp-address">
                    <span v-for="(line, i) in addressLines(r, f)" :key="i">{{ line }}</span>
                  </address>
                  <button
                    v-if="addressLines(r, f).length"
                    type="button"
                    class="cpub-rp-copy"
                    :aria-label="`Copy ${f.label} for ${r.displayName || r.username}`"
                    @click="copy(`${r.userId}:${f.key}`, addressLines(r, f).join('\n'))"
                  >
                    <i class="fa-regular fa-copy" aria-hidden="true"></i>
                    {{ copyLabel(`${r.userId}:${f.key}`, 'Copy') }}
                  </button>
                </template>
                <template v-else>{{ answer(r, f) }}</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="hasAddress && data.includePii" class="cpub-form-hint">
        Both CSV downloads split each address into separate columns (line 1, line 2, city, region, postal code, country) plus a ready-to-paste mailing label.
      </p>
    </template>
  </section>
</template>

<style scoped>
.cpub-rp { display: flex; flex-direction: column; gap: var(--space-2); }
.cpub-rp-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; }
.cpub-rp-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.cpub-rp-count { font-family: var(--font-mono); color: var(--text-dim); font-weight: 400; }
.cpub-rp-error { color: var(--red-text); }
.cpub-rp-note { margin: 0; }
.cpub-rp-tools { display: flex; align-items: center; gap: var(--space-2) var(--space-3); flex-wrap: wrap; }
.cpub-rp-views { display: inline-flex; border: var(--border-width-default) solid var(--border); }
.cpub-rp-view { font-size: var(--text-sm); padding: 6px 12px; min-height: 36px; background: var(--surface); color: var(--text-dim); border: 0; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.cpub-rp-view + .cpub-rp-view { border-left: var(--border-width-default) solid var(--border); }
.cpub-rp-view[aria-pressed='true'] { background: var(--accent-bg); color: var(--text); font-weight: 600; }
.cpub-rp-search { display: inline-flex; align-items: center; gap: 6px; border: var(--border-width-default) solid var(--border); background: var(--surface); padding: 0 10px; flex: 1 1 220px; max-width: 360px; color: var(--text-dim); }
.cpub-rp-search input { border: 0; background: transparent; color: var(--text); font-size: 16px; padding: 7px 0; width: 100%; outline: none; }
.cpub-rp-search:focus-within { border-color: var(--accent); }
.cpub-rp-showing { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-dim); }
.cpub-rp-scroll { overflow-x: auto; border: var(--border-width-default) solid var(--border); }
.cpub-rp-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
.cpub-rp-table th, .cpub-rp-table td { text-align: left; padding: var(--space-2) var(--space-3); border-bottom: var(--border-width-default) solid var(--border2); white-space: nowrap; vertical-align: top; }
.cpub-rp-table th { font-size: var(--text-xs); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .05em; color: var(--text-dim); background: var(--surface2); position: sticky; top: 0; }
.cpub-rp-table tbody tr:hover { background: var(--surface2); }
.cpub-rp-pii { font-size: 9px; color: var(--accent); }
.cpub-rp-user { color: var(--accent); text-decoration: none; font-weight: 600; }
.cpub-rp-user:hover { text-decoration: underline; }
.cpub-rp-date { font-family: var(--font-mono); color: var(--text-dim); }
.cpub-rp-file { color: var(--accent); text-decoration: none; white-space: nowrap; }
.cpub-rp-file:hover { text-decoration: underline; }
.cpub-rp-consent { font-family: var(--font-mono); font-size: var(--text-xs); }
.cpub-rp-consent-ok { color: var(--green-text); display: inline-flex; align-items: center; gap: var(--space-1); }
.cpub-rp-consent-partial { color: var(--text-dim); display: inline-flex; align-items: center; gap: var(--space-1); }
.cpub-rp-address { font-style: normal; display: flex; flex-direction: column; line-height: 1.45; white-space: normal; min-width: 180px; }
.cpub-rp-copy { margin-top: 6px; font-size: var(--text-xs); font-family: var(--font-mono); padding: 4px 8px; min-height: 32px; border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text-dim); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.cpub-rp-copy:hover { border-color: var(--accent); color: var(--text); }
.cpub-rp-missing { color: var(--text-dim); font-style: italic; }
.cpub-rp-cards { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
.cpub-rp-card { border: var(--border-width-default) solid var(--border); background: var(--surface); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
.cpub-rp-card-head { display: flex; flex-direction: column; gap: 2px; }
.cpub-rp-handle { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-dim); }
.cpub-rp-card-fields { margin: 0; display: grid; gap: 4px; font-size: var(--text-sm); }
.cpub-rp-card-fields dt { font-family: var(--font-mono); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .05em; color: var(--text-dim); margin-top: 4px; }
.cpub-rp-card-fields dd { margin: 0; color: var(--text); overflow-wrap: anywhere; }
.cpub-rp-copy-all { align-self: flex-start; margin-top: auto; }
.cpub-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
</style>
