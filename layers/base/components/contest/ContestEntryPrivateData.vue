<script setup lang="ts">
/**
 * ContestEntryPrivateData — the in-app viewer for an entry's partitioned personal
 * data: PII fields (addresses, etc. stored in contest_entry_private_fields) and
 * agreement acceptances (contest_agreement_acceptances). Presentational only — the
 * parent fetches `/api/contests/:slug/entries/:entryId/private` CLIENT-SIDE (so PII
 * never lands in the SSR payload) and passes the result here. The endpoint already
 * gates access to the entrant + `contest.pii` holders; this component just renders.
 *
 * `template` is the flat list of every stage's submission-template fields, used to
 * label PII keys + detect `address` fields (rendered as a formatted block rather
 * than raw JSON). Unknown keys fall back to the raw key + value.
 */
import { ADDRESS_SUBFIELDS, parseAddress } from '../../utils/contestSubmission';

interface TemplateField { key: string; label: string; type: string }
interface Agreement { fieldKey: string; stageId: string; termsHash: string; termsSnapshot: string; acceptedAt: string | Date }

const props = defineProps<{
  fields: Record<string, string>;
  agreements: Agreement[];
  template: TemplateField[];
  updatedAt?: string | Date | null;
}>();

const byKey = computed(() => new Map(props.template.map((f) => [f.key, f])));

interface FieldRow { key: string; label: string; isAddress: boolean; value: string; addressLines: string[] }
const fieldRows = computed<FieldRow[]>(() =>
  Object.entries(props.fields).map(([key, value]) => {
    const f = byKey.value.get(key);
    const isAddress = f?.type === 'address';
    return { key, label: f?.label ?? key, isAddress, value, addressLines: isAddress ? formatAddress(value) : [] };
  }),
);

function formatAddress(json: string): string[] {
  const a = parseAddress(json);
  const cityLine = [a.city, a.region].filter(Boolean).join(', ') + (a.postal ? ` ${a.postal}` : '');
  return [a.line1, a.line2, cityLine.trim(), a.country].map((l) => (l ?? '').trim()).filter(Boolean);
}

function agreementLabel(fieldKey: string): string {
  return byKey.value.get(fieldKey)?.label ?? fieldKey;
}
function fmtDate(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const hasData = computed(() => fieldRows.value.length > 0 || props.agreements.length > 0);
</script>

<template>
  <section v-if="hasData" class="cpub-epd" aria-labelledby="cpub-epd-head">
    <div class="cpub-epd-bar">
      <h2 id="cpub-epd-head" class="cpub-epd-head"><i class="fa-solid fa-user-shield"></i> Personal information</h2>
      <span class="cpub-epd-note"><i class="fa-solid fa-lock"></i> Visible only to you and contest organizers — never public or to judges.</span>
    </div>

    <dl v-if="fieldRows.length" class="cpub-epd-fields">
      <template v-for="row in fieldRows" :key="row.key">
        <dt>{{ row.label }}</dt>
        <dd>
          <address v-if="row.isAddress && row.addressLines.length" class="cpub-epd-address">
            <span v-for="(line, i) in row.addressLines" :key="i">{{ line }}</span>
          </address>
          <span v-else>{{ row.value }}</span>
        </dd>
      </template>
    </dl>

    <div v-if="agreements.length" class="cpub-epd-agreements">
      <h3 class="cpub-epd-subhead">Agreement acceptances</h3>
      <ul class="cpub-epd-agree-list">
        <li v-for="(a, i) in agreements" :key="`${a.fieldKey}-${a.stageId}-${i}`" class="cpub-epd-agree">
          <div class="cpub-epd-agree-top">
            <span class="cpub-epd-agree-label"><i class="fa-solid fa-circle-check"></i> {{ agreementLabel(a.fieldKey) }}</span>
            <span class="cpub-epd-agree-when">Accepted {{ fmtDate(a.acceptedAt) }}</span>
          </div>
          <details v-if="a.termsSnapshot" class="cpub-epd-terms">
            <summary>View the terms accepted</summary>
            <p class="cpub-epd-terms-text">{{ a.termsSnapshot }}</p>
          </details>
          <code v-if="a.termsHash" class="cpub-epd-hash" :title="`SHA-256 of the accepted terms (${a.stageId})`">sha256:{{ a.termsHash.slice(0, 16) }}…</code>
        </li>
      </ul>
    </div>

    <p v-if="updatedAt" class="cpub-epd-updated">Last updated {{ fmtDate(updatedAt) }}</p>
  </section>
</template>

<style scoped>
.cpub-epd { border: var(--border-width-default) dashed var(--accent-border); background: var(--accent-bg); box-shadow: var(--shadow-md); margin-bottom: 22px; }
.cpub-epd-bar { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 16px; border-bottom: var(--border-width-default) solid var(--accent-border); }
.cpub-epd-head { font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 8px; margin: 0; }
.cpub-epd-head i { color: var(--accent); }
.cpub-epd-note { font-size: 10px; color: var(--text-dim); font-family: var(--font-mono); display: inline-flex; align-items: center; gap: 5px; }
.cpub-epd-note i { color: var(--text-faint); }

.cpub-epd-fields { margin: 0; padding: 14px 16px; display: grid; grid-template-columns: minmax(120px, 200px) 1fr; gap: 8px 16px; }
.cpub-epd-fields dt { font-size: 11px; font-weight: 600; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .05em; color: var(--text-dim); }
.cpub-epd-fields dd { margin: 0; font-size: 13px; color: var(--text); line-height: 1.6; overflow-wrap: anywhere; }
.cpub-epd-address { font-style: normal; display: flex; flex-direction: column; }

.cpub-epd-agreements { padding: 0 16px 14px; }
.cpub-epd-subhead { font-size: 11px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); margin: 8px 0 8px; }
.cpub-epd-agree-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.cpub-epd-agree { border: var(--border-width-default) solid var(--border); background: var(--surface); padding: 10px 12px; }
.cpub-epd-agree-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.cpub-epd-agree-label { font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
.cpub-epd-agree-label i { color: var(--green); font-size: 11px; }
.cpub-epd-agree-when { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-epd-terms { margin: 8px 0 4px; }
.cpub-epd-terms summary { font-size: 11px; color: var(--accent); cursor: pointer; }
.cpub-epd-terms-text { font-size: 12px; color: var(--text-dim); line-height: 1.6; margin: 8px 0 0; white-space: pre-line; }
.cpub-epd-hash { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-epd-updated { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); margin: 0; padding: 0 16px 12px; }

@media (max-width: 600px) {
  .cpub-epd-fields { grid-template-columns: 1fr; gap: 2px 0; }
  .cpub-epd-fields dd { margin-bottom: 8px; }
}
</style>
