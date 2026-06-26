<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: `Broadcast, Admin, ${useSiteName()}` });

import type { BroadcastSummary } from '@commonpub/server';

const toast = useToast();

const subject = ref('');
const bodyText = ref('');
const ctaLabel = ref('');
const ctaUrl = ref('');

const audienceKind = ref<'all' | 'role' | 'specific'>('all');
const role = ref<'member' | 'pro' | 'verified' | 'staff' | 'admin'>('member');
const selected = ref<Array<{ id: string; username: string }>>([]);

const search = ref('');
const results = ref<Array<{ id: string; username: string }>>([]);

const recipientCount = ref<number | null>(null);
const sending = ref(false);
const confirming = ref(false);

function audiencePayload(): 'all' | { role: string } | { userIds: string[] } {
  if (audienceKind.value === 'all') return 'all';
  if (audienceKind.value === 'role') return { role: role.value };
  return { userIds: selected.value.map((u) => u.id) };
}

function bodyPayload(): Record<string, unknown> {
  const p: Record<string, unknown> = {
    subject: subject.value.trim(),
    bodyText: bodyText.value.trim(),
    audience: audiencePayload(),
  };
  if (ctaLabel.value.trim() && ctaUrl.value.trim()) {
    p.ctaLabel = ctaLabel.value.trim();
    p.ctaUrl = ctaUrl.value.trim();
  }
  return p;
}

const ctaValid = computed(() => {
  const l = ctaLabel.value.trim();
  const u = ctaUrl.value.trim();
  if (!l && !u) return true; // neither = fine
  return !!l && /^https?:\/\//i.test(u); // both, url must be http(s)
});
const canSend = computed(
  () => !!subject.value.trim() && !!bodyText.value.trim() && ctaValid.value
    && (audienceKind.value !== 'specific' || selected.value.length > 0),
);

// --- recipient count ---
let countTimer: ReturnType<typeof setTimeout> | null = null;
async function refreshCount(): Promise<void> {
  if (audienceKind.value === 'specific' && selected.value.length === 0) { recipientCount.value = 0; return; }
  try {
    const r = await $fetch<{ count: number }>('/api/admin/broadcast/recipients', { method: 'POST', body: audiencePayload() });
    recipientCount.value = r.count;
  } catch { recipientCount.value = null; }
}
watch([audienceKind, role, selected], () => {
  if (countTimer) clearTimeout(countTimer);
  countTimer = setTimeout(refreshCount, 300);
}, { deep: true, immediate: true });

// --- specific-user search ---
let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, (q) => {
  if (searchTimer) clearTimeout(searchTimer);
  if (!q.trim()) { results.value = []; return; }
  searchTimer = setTimeout(async () => {
    try {
      const r = await $fetch<{ items: Array<{ id: string; username: string }> }>('/api/admin/users', { query: { search: q, limit: 8 } });
      results.value = r.items.map((u) => ({ id: u.id, username: u.username }));
    } catch { results.value = []; }
  }, 250);
});
function addUser(u: { id: string; username: string }): void {
  if (!selected.value.find((x) => x.id === u.id)) selected.value.push(u);
  search.value = '';
  results.value = [];
}
function removeUser(id: string): void {
  selected.value = selected.value.filter((x) => x.id !== id);
}

// --- history ---
const { data: history, refresh: refreshHistory } = useFetch<BroadcastSummary[]>('/api/admin/broadcast');

function startSend(): void {
  if (!canSend.value) { toast.error('Subject, body, and a valid audience are required'); return; }
  confirming.value = true;
}
async function confirmSend(): Promise<void> {
  sending.value = true;
  try {
    const r = await $fetch<{ recipientCount: number }>('/api/admin/broadcast', { method: 'POST', body: bodyPayload() });
    toast.success(`Queued ${r.recipientCount} email(s)`);
    confirming.value = false;
    subject.value = ''; bodyText.value = ''; ctaLabel.value = ''; ctaUrl.value = '';
    selected.value = [];
    await refreshHistory();
  } catch {
    toast.error('Broadcast failed');
  } finally {
    sending.value = false;
  }
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
</script>

<template>
  <div class="cpub-bc">
    <header>
      <h1 class="cpub-bc-title">Broadcast</h1>
      <p class="cpub-bc-sub">Send an announcement email to your users. Only verified users who have not unsubscribed receive it, and every email includes an unsubscribe link.</p>
    </header>

    <form class="cpub-bc-form" @submit.prevent="startSend">
      <div class="cpub-bc-field">
        <label for="bc-subject" class="cpub-bc-label">Subject</label>
        <input id="bc-subject" v-model="subject" type="text" maxlength="200" class="cpub-bc-input" required />
      </div>

      <div class="cpub-bc-field">
        <label for="bc-body" class="cpub-bc-label">Message</label>
        <textarea id="bc-body" v-model="bodyText" rows="7" maxlength="5000" class="cpub-bc-input" required></textarea>
        <p class="cpub-bc-hint">Plain text. Blank lines start new paragraphs.</p>
      </div>

      <div class="cpub-bc-cta">
        <div class="cpub-bc-field">
          <label for="bc-ctalabel" class="cpub-bc-label">Button label (optional)</label>
          <input id="bc-ctalabel" v-model="ctaLabel" type="text" maxlength="60" class="cpub-bc-input" placeholder="Read more" />
        </div>
        <div class="cpub-bc-field">
          <label for="bc-ctaurl" class="cpub-bc-label">Button URL</label>
          <input id="bc-ctaurl" v-model="ctaUrl" type="url" maxlength="500" class="cpub-bc-input" placeholder="https://..." />
        </div>
      </div>
      <p v-if="!ctaValid" class="cpub-bc-err">A button needs both a label and an http(s) URL.</p>

      <div class="cpub-bc-field">
        <span class="cpub-bc-label">Audience</span>
        <div class="cpub-bc-aud">
          <label><input v-model="audienceKind" type="radio" value="all" /> All users</label>
          <label><input v-model="audienceKind" type="radio" value="role" /> By role</label>
          <label><input v-model="audienceKind" type="radio" value="specific" /> Specific users</label>
        </div>
      </div>

      <div v-if="audienceKind === 'role'" class="cpub-bc-field">
        <label for="bc-role" class="cpub-bc-label">Role</label>
        <select id="bc-role" v-model="role" class="cpub-bc-input">
          <option value="member">Member</option>
          <option value="pro">Pro</option>
          <option value="verified">Verified</option>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div v-if="audienceKind === 'specific'" class="cpub-bc-field">
        <label for="bc-usearch" class="cpub-bc-label">Find users</label>
        <input id="bc-usearch" v-model="search" type="text" class="cpub-bc-input" placeholder="Search by username" />
        <ul v-if="results.length" class="cpub-bc-results">
          <li v-for="u in results" :key="u.id"><button type="button" @click="addUser(u)">@{{ u.username }}</button></li>
        </ul>
        <div v-if="selected.length" class="cpub-bc-chips">
          <span v-for="u in selected" :key="u.id" class="cpub-bc-chip">@{{ u.username }} <button type="button" aria-label="Remove" @click="removeUser(u.id)">×</button></span>
        </div>
      </div>

      <div class="cpub-bc-send">
        <span class="cpub-bc-count">{{ recipientCount === null ? '' : `${recipientCount} recipient${recipientCount === 1 ? '' : 's'}` }}</span>
        <button v-if="!confirming" type="submit" class="cpub-btn" :disabled="!canSend">Review &amp; send</button>
        <template v-else>
          <span class="cpub-bc-confirm">Send to {{ recipientCount ?? '?' }} recipient(s)?</span>
          <button type="button" class="cpub-btn" :disabled="sending" @click="confirmSend">{{ sending ? 'Sending...' : 'Confirm send' }}</button>
          <button type="button" class="cpub-btn cpub-btn-ghost" :disabled="sending" @click="confirming = false">Cancel</button>
        </template>
      </div>
    </form>

    <section v-if="history && history.length" class="cpub-bc-history">
      <h2 class="cpub-bc-label">Recent broadcasts</h2>
      <ul>
        <li v-for="b in history" :key="b.id">
          <span class="cpub-bc-hsub">{{ b.subject }}</span>
          <span class="cpub-bc-hmeta">{{ b.recipientCount }} recipients · {{ fmtDate(String(b.createdAt)) }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.cpub-bc { max-width: 720px; margin: 0 auto; padding: 24px; }
.cpub-bc-title { font-size: 20px; font-weight: 700; margin: 0 0 6px; }
.cpub-bc-sub { font-size: 13px; color: var(--text-dim); line-height: 1.6; margin: 0 0 20px; max-width: 60ch; }
.cpub-bc-form { display: flex; flex-direction: column; gap: 16px; }
.cpub-bc-field { display: flex; flex-direction: column; gap: 6px; }
.cpub-bc-label { font-size: 11px; font-weight: 600; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); }
.cpub-bc-input { padding: 8px 12px; border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; font-family: var(--font-sans); width: 100%; }
.cpub-bc-input:focus { border-color: var(--accent); outline: none; box-shadow: var(--shadow-accent); }
.cpub-bc-hint { font-size: 11px; color: var(--text-faint); margin: 0; }
.cpub-bc-err { font-size: 11px; color: var(--red-text); margin: 0; }
.cpub-bc-cta { display: grid; grid-template-columns: 1fr 2fr; gap: 12px; }
.cpub-bc-aud { display: flex; gap: 16px; font-size: 13px; color: var(--text); }
.cpub-bc-aud label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.cpub-bc-results { list-style: none; margin: 4px 0 0; padding: 0; border: var(--border-width-default) solid var(--border); background: var(--surface); }
.cpub-bc-results li button { display: block; width: 100%; text-align: left; padding: 6px 10px; background: none; border: none; color: var(--text); font-size: 13px; cursor: pointer; }
.cpub-bc-results li button:hover { background: var(--surface2); }
.cpub-bc-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.cpub-bc-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 2px 8px; border: var(--border-width-default) solid var(--border2); background: var(--surface2); }
.cpub-bc-chip button { background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 14px; }
.cpub-bc-send { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
.cpub-bc-count { font-size: 12px; color: var(--text-dim); font-family: var(--font-mono); }
.cpub-bc-confirm { font-size: 13px; color: var(--text); }
.cpub-btn-ghost { background: transparent; color: var(--text-dim); }
.cpub-bc-history { margin-top: 28px; }
.cpub-bc-history ul { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.cpub-bc-history li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: var(--border-width-default) solid var(--border); font-size: 13px; }
.cpub-bc-hsub { color: var(--text); }
.cpub-bc-hmeta { color: var(--text-faint); font-size: 11px; font-family: var(--font-mono); white-space: nowrap; }
</style>
