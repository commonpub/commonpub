<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

import type { Serialized, HubDetail, HubInviteItem } from '@commonpub/server';

const route = useRoute();
const slug = computed(() => route.params.slug as string);
const toast = useToast();
const { extract: extractError } = useApiError();

const { data: hub } = useLazyFetch<Serialized<HubDetail>>(() => `/api/hubs/${slug.value}`);
const { data: invitesData, refresh, error: invitesError } = useLazyFetch<Serialized<HubInviteItem>[]>(
  () => `/api/hubs/${slug.value}/invites`,
  { default: () => [] },
);
const invites = computed(() => invitesData.value ?? []);

const currentUserRole = computed(() => hub.value?.currentUserRole ?? null);
// admin+ only — mirrors the server's manageMembers permission (createInvite/revokeInvite).
const canManage = computed(() =>
  ['owner', 'admin'].includes(currentUserRole.value ?? ''),
);

useSeoMeta({ title: () => `Invites, ${hub.value?.name ?? 'Hub'}, ${useSiteName()}` });

// --- Create form ---
const expiryOptions = [
  { label: 'Never expires', days: 0 },
  { label: 'Expires in 1 day', days: 1 },
  { label: 'Expires in 7 days', days: 7 },
  { label: 'Expires in 30 days', days: 30 },
] as const;

const form = reactive({ maxUses: '', expiryDays: 0 });
const creating = ref(false);

async function createInvite(): Promise<void> {
  creating.value = true;
  try {
    const body: { maxUses?: number; expiresAt?: string } = {};
    const max = Number(form.maxUses);
    if (form.maxUses && Number.isFinite(max) && max > 0) body.maxUses = Math.trunc(max);
    if (form.expiryDays > 0) {
      body.expiresAt = new Date(Date.now() + form.expiryDays * 86_400_000).toISOString();
    }
    await $fetch(`/api/hubs/${slug.value}/invites`, { method: 'POST', body });
    toast.success('Invite created');
    form.maxUses = '';
    form.expiryDays = 0;
    await refresh();
  } catch (err: unknown) {
    toast.error(extractError(err));
  } finally {
    creating.value = false;
  }
}

function inviteLink(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/hubs/${slug.value}?invite=${token}`;
}

async function copyLink(token: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(inviteLink(token));
    toast.success('Invite link copied');
  } catch {
    toast.error('Could not copy link');
  }
}

async function revoke(id: string): Promise<void> {
  if (!confirm('Revoke this invite? The link will stop working.')) return;
  try {
    await $fetch(`/api/hubs/${slug.value}/invites/${id}`, { method: 'DELETE' });
    toast.success('Invite revoked');
    await refresh();
  } catch (err: unknown) {
    toast.error(extractError(err));
  }
}

function usesLabel(invite: Serialized<HubInviteItem>): string {
  return invite.maxUses == null
    ? `${invite.useCount} uses`
    : `${invite.useCount} / ${invite.maxUses} uses`;
}

function isExhausted(invite: Serialized<HubInviteItem>): boolean {
  const expired = invite.expiresAt != null && new Date(invite.expiresAt).getTime() <= Date.now();
  const maxedOut = invite.maxUses != null && invite.useCount >= invite.maxUses;
  return expired || maxedOut;
}

function fmtDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
</script>

<template>
  <div class="cpub-invites-page">
    <div class="cpub-invites-header">
      <NuxtLink :to="`/hubs/${slug}`" class="cpub-back-link">
        <i class="fa-solid fa-arrow-left"></i> {{ hub?.name ?? 'Hub' }}
      </NuxtLink>
      <h1 class="cpub-invites-title">Invites</h1>
      <p class="cpub-invites-subtitle">Share an invite link so people can join this hub.</p>
    </div>

    <div v-if="!hub" class="cpub-loading">Loading...</div>

    <div v-else-if="invitesError || !canManage" class="cpub-empty-state" style="padding: 48px 24px">
      <p class="cpub-empty-state-title">You do not have permission to manage invites.</p>
    </div>

    <template v-else>
      <form class="cpub-invites-create" @submit.prevent="createInvite">
        <div class="cpub-invites-create-fields">
          <div class="cpub-field">
            <label for="invite-max-uses" class="cpub-field-label">Max uses (optional)</label>
            <input
              id="invite-max-uses"
              v-model="form.maxUses"
              type="number"
              min="1"
              inputmode="numeric"
              class="cpub-field-input"
              placeholder="Unlimited"
            />
          </div>
          <div class="cpub-field">
            <label for="invite-expiry" class="cpub-field-label">Expiry</label>
            <select id="invite-expiry" v-model.number="form.expiryDays" class="cpub-field-input">
              <option v-for="opt in expiryOptions" :key="opt.days" :value="opt.days">{{ opt.label }}</option>
            </select>
          </div>
        </div>
        <button type="submit" class="cpub-btn cpub-btn-primary" :disabled="creating">
          <i class="fa-solid fa-plus"></i> {{ creating ? 'Creating...' : 'Create invite' }}
        </button>
      </form>

      <ul v-if="invites.length" class="cpub-invites-list">
        <li v-for="invite in invites" :key="invite.id" class="cpub-invite-card">
          <div class="cpub-invite-info">
            <code class="cpub-invite-token">{{ invite.token.slice(0, 12) }}...</code>
            <div class="cpub-invite-meta">
              <span :class="{ 'cpub-invite-exhausted': isExhausted(invite) }">{{ usesLabel(invite) }}</span>
              <span v-if="invite.expiresAt">Expires {{ fmtDate(invite.expiresAt) }}</span>
              <span v-else>No expiry</span>
              <span>Created {{ fmtDate(invite.createdAt) }}</span>
            </div>
          </div>
          <div class="cpub-invite-actions">
            <button class="cpub-btn cpub-btn-sm" type="button" @click="copyLink(invite.token)">
              <i class="fa-solid fa-link"></i> Copy link
            </button>
            <button class="cpub-btn cpub-btn-sm cpub-invite-revoke" type="button" aria-label="Revoke invite" @click="revoke(invite.id)">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </li>
      </ul>

      <div v-else class="cpub-empty-state" style="padding: 48px 24px">
        <p class="cpub-empty-state-title">No invites yet.</p>
        <p class="cpub-empty-state-text">Create one above to share a join link.</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cpub-invites-page {
  max-width: 640px;
  margin: 0 auto;
  padding: 32px;
}

.cpub-invites-header {
  margin-bottom: 24px;
}

/* cpub-back-link → global components.css */

.cpub-invites-title {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 4px;
}

.cpub-invites-subtitle {
  font-size: 13px;
  color: var(--text-dim);
}

.cpub-invites-create {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  padding: 16px;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  margin-bottom: 24px;
}

.cpub-invites-create-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  flex: 1;
  min-width: 240px;
}

.cpub-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cpub-field-label {
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}

.cpub-field-input {
  padding: 8px 12px;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  font-family: var(--font-sans);
  outline: none;
  transition: border-color 0.15s;
}

.cpub-field-input:focus {
  border-color: var(--accent);
}

select.cpub-field-input {
  cursor: pointer;
}

.cpub-invites-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
}

.cpub-invite-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: var(--border-width-default) solid var(--border2);
}

.cpub-invite-card:last-child {
  border-bottom: none;
}

.cpub-invite-info {
  flex: 1;
  min-width: 0;
}

.cpub-invite-token {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text);
}

.cpub-invite-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 4px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-faint);
}

.cpub-invite-exhausted {
  color: var(--red-text);
}

.cpub-invite-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.cpub-invite-revoke:hover {
  color: var(--red-text);
  border-color: var(--red);
}

@media (max-width: 640px) {
  .cpub-invites-page { padding: 16px; }
  .cpub-invites-create-fields { grid-template-columns: 1fr; }
  .cpub-invite-card { flex-wrap: wrap; }
}
</style>
