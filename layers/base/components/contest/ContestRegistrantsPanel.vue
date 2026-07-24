<script setup lang="ts">
import { isFormFieldPii, type FormField } from '@commonpub/schema';

// Organizer-only registrants table (P5). Reads the gated registrants route and
// renders one row per full participant with their answers label-mapped by the
// contest's (effective) registration template. PII columns appear only when the
// route says the viewer holds contest.pii. A CSV download mirrors the same gating.

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

const { data, pending, error } = useFetch<RegistrantsResponse>(() => `/api/contests/${props.slug}/registrants`, {
  query: { limit: 200 },
});

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

// Consent denominator: how many agreement fields the form asks. `consentCount` on a
// registrant is how many they accepted. Consent isn't PII, so it shows to every organizer.
const agreementCount = computed<number>(() => (data.value?.template ?? []).filter((f: FormField) => f.type === 'agreement').length);

function answer(r: Registrant, f: FormField): string {
  const v = isPii(f) ? r.privateFields?.[f.key] : r.fields?.[f.key];
  return v ?? '';
}

function fmtDate(iso: string): string {
  return formatLocalDate(iso) ?? iso.slice(0, 10);
}
</script>

<template>
  <section class="cpub-rp" aria-label="Registrants">
    <div class="cpub-rp-head">
      <h3 class="cpub-form-label" style="margin: 0;">Registrants <span v-if="data" class="cpub-rp-count">{{ data.total }}</span></h3>
      <a v-if="data && data.total > 0" :href="`/api/contests/${slug}/registrants-export`" class="cpub-btn cpub-btn-sm" download>
        <i class="fa-solid fa-file-csv"></i> Export CSV
      </a>
    </div>

    <p v-if="pending" class="cpub-form-hint">Loading registrants…</p>
    <p v-else-if="error" class="cpub-form-hint cpub-rp-error">Couldn’t load registrants.</p>
    <p v-else-if="!data || data.total === 0" class="cpub-form-hint">No one has registered yet.</p>

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
          <tr v-for="r in data.items" :key="r.userId">
            <td>
              <NuxtLink :to="`/u/${r.username}`" class="cpub-rp-user">{{ r.displayName || r.username }}</NuxtLink>
            </td>
            <td class="cpub-rp-date">{{ fmtDate(r.registeredAt) }}</td>
            <td v-if="agreementCount" class="cpub-rp-consent">
              <span :class="r.consentCount >= agreementCount ? 'cpub-rp-consent-ok' : 'cpub-rp-consent-partial'">
                <i class="fa-solid" :class="r.consentCount >= agreementCount ? 'fa-circle-check' : 'fa-circle-half-stroke'"></i>
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
              ><i class="fa-solid fa-paperclip"></i> View file</a>
              <template v-else>{{ answer(r, f) }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="data && data.total > data.items.length" class="cpub-form-hint">
      Showing {{ data.items.length }} of {{ data.total }}. Export the CSV for the full list.
    </p>
  </section>
</template>

<style scoped>
.cpub-rp { display: flex; flex-direction: column; gap: var(--space-2); }
.cpub-rp-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; }
.cpub-rp-count { font-family: var(--font-mono); color: var(--text-dim); font-weight: 400; }
.cpub-rp-error { color: var(--red-text); }
.cpub-rp-scroll { overflow-x: auto; border: var(--border-width-default) solid var(--border); }
.cpub-rp-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
.cpub-rp-table th, .cpub-rp-table td { text-align: left; padding: var(--space-2) var(--space-3); border-bottom: var(--border-width-default) solid var(--border2); white-space: nowrap; vertical-align: top; }
.cpub-rp-table th { font-size: var(--text-xs); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .05em; color: var(--text-dim); background: var(--surface2); position: sticky; top: 0; }
.cpub-rp-table tbody tr:hover { background: var(--surface2); }
.cpub-rp-pii { font-size: 9px; color: var(--accent); }
.cpub-rp-user { color: var(--accent); text-decoration: none; }
.cpub-rp-user:hover { text-decoration: underline; }
.cpub-rp-date { font-family: var(--font-mono); color: var(--text-dim); }
.cpub-rp-file { color: var(--accent); text-decoration: none; white-space: nowrap; }
.cpub-rp-file:hover { text-decoration: underline; }
.cpub-rp-consent { font-family: var(--font-mono); font-size: var(--text-xs); }
.cpub-rp-consent-ok { color: var(--green-text); display: inline-flex; align-items: center; gap: var(--space-1); }
.cpub-rp-consent-partial { color: var(--text-dim); display: inline-flex; align-items: center; gap: var(--space-1); }
</style>
