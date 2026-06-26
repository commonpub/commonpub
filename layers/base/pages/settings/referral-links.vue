<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: `Referral Links, ${useSiteName()}` });

const toast = useToast();
const runtime = useRuntimeConfig();

type ReferralAction = { type: 'join_hub'; hubId: string } | { type: 'redirect'; path: string };
interface ReferralLink {
  id: string;
  code: string;
  label: string | null;
  actions: ReferralAction[];
  status: 'active' | 'disabled';
  clickCount: number;
  signupCount: number;
  attributionWindowDays: number;
  createdAt: string;
}

const { data, refresh, pending } = await useFetch<{ links: ReferralLink[] }>('/api/referrals');
const links = computed(() => data.value?.links ?? []);

interface HubRef { id: string; name: string; slug: string }
const { data: hubData } = await useFetch<{ items: HubRef[] }>('/api/user/hubs');
const myHubs = computed<HubRef[]>(() => hubData.value?.items ?? []);

const form = reactive({ label: '', code: '', hubIds: [] as string[] });
const creating = ref(false);

const origin = computed(() => {
  if (import.meta.client) return window.location.origin;
  return (runtime.public?.siteUrl as string) || '';
});
function shortUrl(code: string): string {
  return `${origin.value}/r/${code}`;
}

function hubName(id: string): string {
  return myHubs.value.find((h) => h.id === id)?.name ?? 'a hub';
}
function joinHubNames(link: ReferralLink): string[] {
  return link.actions
    .filter((a): a is Extract<ReferralAction, { type: 'join_hub' }> => a.type === 'join_hub')
    .map((a) => hubName(a.hubId));
}

async function createLink(): Promise<void> {
  creating.value = true;
  try {
    const actions: ReferralAction[] = form.hubIds.map((hubId) => ({ type: 'join_hub', hubId }));
    const body: Record<string, unknown> = { actions };
    if (form.label.trim()) body.label = form.label.trim();
    if (form.code.trim()) body.code = form.code.trim();
    await $fetch('/api/referrals', { method: 'POST', body });
    toast.success('Referral link created');
    form.label = '';
    form.code = '';
    form.hubIds = [];
    await refresh();
  } catch (err: unknown) {
    toast.error((err as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Could not create link');
  } finally {
    creating.value = false;
  }
}

const copiedId = ref<string | null>(null);
async function copyLink(link: ReferralLink): Promise<void> {
  try {
    await navigator.clipboard.writeText(shortUrl(link.code));
    copiedId.value = link.id;
    setTimeout(() => { if (copiedId.value === link.id) copiedId.value = null; }, 1500);
  } catch {
    toast.error('Could not copy to clipboard');
  }
}

async function toggleStatus(link: ReferralLink): Promise<void> {
  const status = link.status === 'active' ? 'disabled' : 'active';
  try {
    await $fetch(`/api/referrals/${link.id}`, { method: 'PATCH', body: { status } });
    await refresh();
  } catch {
    toast.error('Could not update link');
  }
}

async function removeLink(link: ReferralLink): Promise<void> {
  if (!window.confirm('Delete this referral link? People you already referred stay attributed.')) return;
  try {
    await $fetch(`/api/referrals/${link.id}`, { method: 'DELETE' });
    toast.success('Link deleted');
    await refresh();
  } catch {
    toast.error('Could not delete link');
  }
}
</script>

<template>
  <div class="cpub-referrals">
    <header class="cpub-referrals-head">
      <h1 class="cpub-referrals-title">Referral Links</h1>
      <p class="cpub-referrals-intro">
        Share a personal link to invite people. We credit you for the signups, and you can have new
        members auto-join a hub when they sign up through your link.
      </p>
    </header>

    <section class="cpub-referrals-create" aria-label="Create a referral link">
      <h2 class="cpub-referrals-subhead">Create a link</h2>
      <div class="cpub-field">
        <label for="ref-label" class="cpub-field-label">Label (optional)</label>
        <input id="ref-label" v-model="form.label" type="text" maxlength="80" class="cpub-input" placeholder="e.g. My newsletter" />
      </div>
      <div class="cpub-field">
        <label for="ref-code" class="cpub-field-label">Custom code (optional)</label>
        <input id="ref-code" v-model="form.code" type="text" maxlength="40" class="cpub-input" placeholder="Leave blank to auto-generate" />
        <p class="cpub-field-hint">Letters, numbers and hyphens. This becomes the end of your link.</p>
      </div>
      <div v-if="myHubs.length" class="cpub-field">
        <span class="cpub-field-label">Auto-join these hubs on signup</span>
        <div class="cpub-hub-options">
          <label v-for="hub in myHubs" :key="hub.id" class="cpub-hub-option">
            <input v-model="form.hubIds" type="checkbox" :value="hub.id" />
            <span>{{ hub.name }}</span>
          </label>
        </div>
        <p class="cpub-field-hint">New members are taken to the first selected hub after signing up.</p>
      </div>
      <button class="cpub-btn-primary" :disabled="creating" @click="createLink">
        {{ creating ? 'Creating...' : 'Create link' }}
      </button>
    </section>

    <section class="cpub-referrals-list" aria-label="Your referral links">
      <h2 class="cpub-referrals-subhead">Your links</h2>
      <p v-if="pending" class="cpub-referrals-empty">Loading...</p>
      <p v-else-if="!links.length" class="cpub-referrals-empty">You have no referral links yet.</p>
      <ul v-else class="cpub-referrals-cards">
        <li v-for="link in links" :key="link.id" class="cpub-referral-card" :class="{ 'is-disabled': link.status === 'disabled' }">
          <div class="cpub-referral-top">
            <div class="cpub-referral-url">
              <code class="cpub-referral-code">{{ shortUrl(link.code) }}</code>
              <button class="cpub-copy-btn" :aria-label="`Copy link for ${link.label || link.code}`" @click="copyLink(link)">
                <i :class="copiedId === link.id ? 'fa-solid fa-check' : 'fa-regular fa-copy'" aria-hidden="true"></i>
                {{ copiedId === link.id ? 'Copied' : 'Copy' }}
              </button>
            </div>
            <span class="cpub-referral-status" :class="`is-${link.status}`">{{ link.status }}</span>
          </div>

          <p v-if="link.label" class="cpub-referral-label">{{ link.label }}</p>

          <div class="cpub-referral-stats">
            <span><strong>{{ link.clickCount }}</strong> clicks</span>
            <span><strong>{{ link.signupCount }}</strong> signups</span>
            <span v-if="joinHubNames(link).length" class="cpub-referral-joins">
              <i class="fa-solid fa-people-group" aria-hidden="true"></i> Joins {{ joinHubNames(link).join(', ') }}
            </span>
          </div>

          <div class="cpub-referral-actions">
            <button class="cpub-btn-ghost" @click="toggleStatus(link)">
              {{ link.status === 'active' ? 'Disable' : 'Enable' }}
            </button>
            <button class="cpub-btn-ghost is-danger" @click="removeLink(link)">Delete</button>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.cpub-referrals {
  display: flex;
  flex-direction: column;
  gap: 28px;
  max-width: 640px;
}

.cpub-referrals-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 6px;
}

.cpub-referrals-intro {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.6;
}

.cpub-referrals-subhead {
  font-size: 12px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-dim);
  margin-bottom: 14px;
}

.cpub-referrals-create {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
}

.cpub-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.cpub-field-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
}

.cpub-field-hint {
  font-size: 11px;
  color: var(--text-faint);
}

.cpub-input {
  padding: 8px 12px;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface2);
  color: var(--text);
  font-size: 13px;
  outline: none;
  width: 100%;
}

.cpub-input:focus {
  border-color: var(--accent);
  box-shadow: var(--shadow-accent);
}

.cpub-hub-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.cpub-hub-option {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
}

.cpub-hub-option input {
  accent-color: var(--accent);
}

.cpub-btn-primary {
  align-self: flex-start;
  padding: 7px 16px;
  background: var(--accent);
  color: var(--color-text-inverse);
  border: var(--border-width-default) solid var(--accent);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.cpub-btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.cpub-referrals-empty {
  font-size: 13px;
  color: var(--text-dim);
}

.cpub-referrals-cards {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cpub-referral-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
}

.cpub-referral-card.is-disabled {
  opacity: 0.6;
}

.cpub-referral-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.cpub-referral-url {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.cpub-referral-code {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cpub-copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface2);
  color: var(--text-dim);
  font-size: 11px;
  cursor: pointer;
  flex-shrink: 0;
}

.cpub-copy-btn:hover {
  color: var(--text);
  border-color: var(--accent-border);
}

.cpub-referral-status {
  font-size: 10px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 7px;
  border: var(--border-width-default) solid var(--border);
  color: var(--text-dim);
  flex-shrink: 0;
}

.cpub-referral-status.is-active {
  color: var(--green-text);
  border-color: var(--green-border, var(--border));
}

.cpub-referral-label {
  font-size: 13px;
  color: var(--text);
}

.cpub-referral-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  font-size: 12px;
  color: var(--text-dim);
}

.cpub-referral-stats strong {
  color: var(--text);
}

.cpub-referral-joins {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.cpub-referral-actions {
  display: flex;
  gap: 8px;
}

.cpub-btn-ghost {
  padding: 4px 10px;
  border: var(--border-width-default) solid var(--border);
  background: transparent;
  color: var(--text-dim);
  font-size: 12px;
  cursor: pointer;
}

.cpub-btn-ghost:hover {
  color: var(--text);
  border-color: var(--accent-border);
}

.cpub-btn-ghost.is-danger:hover {
  color: var(--red-text);
  border-color: var(--red);
}
</style>
