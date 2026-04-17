<script setup lang="ts">
import type { AdminApiKeyView } from '@commonpub/server';
import { PUBLIC_API_SCOPES } from '@commonpub/schema';

definePageMeta({ layout: 'admin', middleware: 'auth' });

useSeoMeta({ title: `API Keys — Admin — ${useSiteName()}` });

interface KeyListResponse {
  items: AdminApiKeyView[];
  total: number;
}

interface CreateResponse {
  key: AdminApiKeyView;
  token: string;
}

const includeRevoked = ref(false);
const listUrl = computed(() => `/api/admin/api-keys${includeRevoked.value ? '?includeRevoked=true' : ''}`);
const { data, pending, refresh, error: listError } = await useFetch<KeyListResponse>(listUrl);

// Create-form state
const showCreate = ref(false);
const form = reactive({
  name: '',
  description: '',
  scopes: [] as string[],
  expiresAt: '',
  rateLimitPerMinute: 60,
  allowedOrigins: '',
});
const creating = ref(false);
const createError = ref('');
const createdKey = ref<CreateResponse | null>(null);
const copied = ref(false);

const availableScopes = PUBLIC_API_SCOPES.filter((s) => s !== 'read:*');

function toggleScope(scope: string): void {
  const i = form.scopes.indexOf(scope);
  if (i >= 0) form.scopes.splice(i, 1);
  else form.scopes.push(scope);
}

function resetForm(): void {
  form.name = '';
  form.description = '';
  form.scopes = [];
  form.expiresAt = '';
  form.rateLimitPerMinute = 60;
  form.allowedOrigins = '';
  createError.value = '';
}

async function submitCreate(): Promise<void> {
  createError.value = '';
  if (!form.name.trim()) {
    createError.value = 'Name is required';
    return;
  }
  if (form.scopes.length === 0) {
    createError.value = 'Select at least one scope';
    return;
  }
  creating.value = true;
  try {
    const origins = form.allowedOrigins
      .split(/[\s,]+/)
      .map((o) => o.trim())
      .filter(Boolean);
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      scopes: form.scopes,
      expiresAt: form.expiresAt || null,
      rateLimitPerMinute: form.rateLimitPerMinute,
      allowedOrigins: origins.length ? origins : null,
    };
    const result = await $fetch<CreateResponse>('/api/admin/api-keys', { method: 'POST', body });
    createdKey.value = result;
    showCreate.value = false;
    resetForm();
    await refresh();
  } catch (err) {
    const e = err as { statusMessage?: string; data?: { message?: string } };
    createError.value = e.data?.message || e.statusMessage || 'Failed to create key';
  } finally {
    creating.value = false;
  }
}

async function revoke(id: string, name: string): Promise<void> {
  if (!confirm(`Revoke API key "${name}"? This cannot be undone.`)) return;
  try {
    await $fetch(`/api/admin/api-keys/${id}`, { method: 'DELETE' });
    await refresh();
  } catch {
    // toast would go here
  }
}

async function copyToken(): Promise<void> {
  if (!createdKey.value) return;
  try {
    await navigator.clipboard.writeText(createdKey.value.token);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch {
    // clipboard may be blocked; user can still select the text
  }
}

function dismissCreated(): void {
  createdKey.value = null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}
</script>

<template>
  <div class="cpub-admin-keys">
    <header class="cpub-admin-head">
      <div>
        <h1 class="cpub-admin-title">API Keys</h1>
        <p class="cpub-admin-sub">
          Bearer tokens for <code>/api/public/v1/*</code>. Each key is scoped and rate-limited;
          the raw token is shown once at creation.
        </p>
      </div>
      <div class="cpub-admin-actions">
        <label class="cpub-checkbox-label">
          <input type="checkbox" v-model="includeRevoked" @change="refresh()" />
          Show revoked
        </label>
        <button class="cpub-btn cpub-btn-primary" @click="showCreate = true">
          <i class="fa-solid fa-plus"></i> New key
        </button>
      </div>
    </header>

    <!-- One-time token reveal -->
    <div v-if="createdKey" class="cpub-key-reveal" role="alert">
      <div class="cpub-key-reveal-head">
        <strong>Key created — copy it now.</strong>
        <button class="cpub-btn-link" aria-label="Close" @click="dismissCreated">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <p class="cpub-key-reveal-warn">
        This is the only time the full token will be displayed. Store it somewhere safe before
        leaving this page — the server only keeps a hash.
      </p>
      <div class="cpub-key-reveal-value">
        <code>{{ createdKey.token }}</code>
        <button class="cpub-btn" @click="copyToken" :aria-label="copied ? 'Copied' : 'Copy to clipboard'">
          <i :class="copied ? 'fa-solid fa-check' : 'fa-regular fa-copy'"></i>
          {{ copied ? 'Copied' : 'Copy' }}
        </button>
      </div>
      <div class="cpub-key-reveal-meta">
        <span>Name: <strong>{{ createdKey.key.name }}</strong></span>
        <span>Prefix: <code>{{ createdKey.key.prefix }}</code></span>
        <span>Scopes: <code>{{ createdKey.key.scopes.join(', ') }}</code></span>
      </div>
    </div>

    <!-- Create form -->
    <div v-if="showCreate" class="cpub-key-form" role="dialog" aria-label="Create API key">
      <div class="cpub-key-form-head">
        <h2>New API Key</h2>
        <button class="cpub-btn-link" aria-label="Cancel" @click="showCreate = false; resetForm()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="cpub-form-row">
        <label for="key-name">Name</label>
        <input id="key-name" v-model="form.name" class="cpub-input" placeholder="e.g. Analytics dashboard" required />
      </div>
      <div class="cpub-form-row">
        <label for="key-desc">Description (optional)</label>
        <textarea id="key-desc" v-model="form.description" class="cpub-input" rows="2"
                  placeholder="What is this key used for?" />
      </div>
      <div class="cpub-form-row">
        <label>Scopes</label>
        <div class="cpub-scope-grid">
          <label v-for="scope in availableScopes" :key="scope" class="cpub-scope-chip">
            <input type="checkbox" :checked="form.scopes.includes(scope)" @change="toggleScope(scope)" />
            <code>{{ scope }}</code>
          </label>
        </div>
      </div>
      <div class="cpub-form-row cpub-form-grid">
        <div>
          <label for="key-expires">Expires (optional)</label>
          <input id="key-expires" v-model="form.expiresAt" type="datetime-local" class="cpub-input" />
        </div>
        <div>
          <label for="key-rate">Rate limit (req/min)</label>
          <input id="key-rate" v-model.number="form.rateLimitPerMinute" type="number" min="1" max="10000" class="cpub-input" />
        </div>
      </div>
      <div class="cpub-form-row">
        <label for="key-origins">Allowed CORS origins (comma or whitespace separated, optional)</label>
        <input id="key-origins" v-model="form.allowedOrigins" class="cpub-input" placeholder="https://app.example.com" />
        <small>Leave blank for server-to-server only (default, recommended).</small>
      </div>
      <p v-if="createError" class="cpub-form-error" role="alert">{{ createError }}</p>
      <div class="cpub-form-actions">
        <button class="cpub-btn" @click="showCreate = false; resetForm()" :disabled="creating">Cancel</button>
        <button class="cpub-btn cpub-btn-primary" @click="submitCreate" :disabled="creating">
          {{ creating ? 'Creating...' : 'Create key' }}
        </button>
      </div>
    </div>

    <!-- List -->
    <div v-if="pending" class="cpub-loading">Loading keys...</div>
    <p v-else-if="listError" class="cpub-form-error">Failed to load keys.</p>
    <p v-else-if="!data?.items?.length" class="cpub-empty">
      No API keys yet. Create one to start consuming <code>/api/public/v1/*</code>.
    </p>
    <table v-else class="cpub-key-table" aria-label="API keys">
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Prefix</th>
          <th scope="col">Scopes</th>
          <th scope="col">Last used</th>
          <th scope="col">Created</th>
          <th scope="col">Status</th>
          <th scope="col"><span class="cpub-sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="k in data.items" :key="k.id" :class="{ 'cpub-key-revoked': !!k.revokedAt }">
          <td>
            <strong>{{ k.name }}</strong>
            <div v-if="k.description" class="cpub-key-desc">{{ k.description }}</div>
          </td>
          <td><code>{{ k.prefix }}...</code></td>
          <td>
            <span v-for="s in k.scopes" :key="s" class="cpub-scope-tag">{{ s }}</span>
          </td>
          <td>{{ fmtDate(k.lastUsedAt) }}</td>
          <td>{{ fmtDate(k.createdAt) }}</td>
          <td>
            <span v-if="k.revokedAt" class="cpub-key-badge cpub-key-badge-red">Revoked</span>
            <span v-else-if="k.expiresAt && new Date(k.expiresAt) < new Date()" class="cpub-key-badge cpub-key-badge-yellow">Expired</span>
            <span v-else class="cpub-key-badge cpub-key-badge-green">Active</span>
          </td>
          <td>
            <button
              v-if="!k.revokedAt"
              class="cpub-btn-link cpub-btn-danger"
              @click="revoke(k.id, k.name)"
              :aria-label="`Revoke ${k.name}`"
            >
              Revoke
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.cpub-admin-keys { padding: 24px; max-width: 1200px; margin: 0 auto; }

.cpub-admin-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 24px; }
.cpub-admin-title { font-size: 22px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
.cpub-admin-sub { font-size: 13px; color: var(--text-dim); max-width: 620px; }
.cpub-admin-sub code { font-family: var(--font-mono); font-size: 12px; background: var(--surface2); padding: 1px 6px; }

.cpub-admin-actions { display: flex; gap: 10px; align-items: center; }
.cpub-checkbox-label { display: flex; gap: 6px; align-items: center; font-size: 12px; color: var(--text-dim); cursor: pointer; }

.cpub-key-reveal {
  background: var(--accent-bg); border: var(--border-width-default) solid var(--accent-border);
  padding: 16px 18px; margin-bottom: 20px;
}
.cpub-key-reveal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.cpub-key-reveal-warn { font-size: 12px; color: var(--text-dim); margin-bottom: 10px; }
.cpub-key-reveal-value {
  display: flex; gap: 10px; align-items: center;
  background: var(--surface); border: var(--border-width-default) solid var(--border);
  padding: 10px; font-family: var(--font-mono); font-size: 13px;
}
.cpub-key-reveal-value code { flex: 1; overflow-wrap: break-word; word-break: break-all; }
.cpub-key-reveal-meta { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 12px; font-size: 12px; color: var(--text-dim); }
.cpub-key-reveal-meta code { font-family: var(--font-mono); }

.cpub-key-form {
  background: var(--surface); border: var(--border-width-default) solid var(--border);
  padding: 20px; margin-bottom: 24px; box-shadow: var(--shadow-md);
}
.cpub-key-form-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.cpub-key-form-head h2 { font-size: 16px; font-weight: 600; color: var(--text); }
.cpub-form-row { margin-bottom: 14px; }
.cpub-form-row label { display: block; font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
.cpub-form-row small { font-size: 11px; color: var(--text-faint); display: block; margin-top: 2px; }
.cpub-input {
  width: 100%; padding: 8px 10px; font-size: 13px;
  background: var(--surface); color: var(--text);
  border: var(--border-width-default) solid var(--border); font-family: inherit;
}
.cpub-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.cpub-form-error { color: var(--red); font-size: 12px; margin: 8px 0; }
.cpub-form-actions { display: flex; justify-content: flex-end; gap: 10px; }

.cpub-scope-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px; }
.cpub-scope-chip {
  display: flex; align-items: center; gap: 6px; padding: 6px 10px;
  background: var(--surface2); border: var(--border-width-default) solid var(--border);
  font-size: 12px; cursor: pointer;
}
.cpub-scope-chip code { font-family: var(--font-mono); font-size: 11px; color: var(--text); }

.cpub-btn {
  padding: 6px 14px; font-size: 12px; font-weight: 500;
  background: var(--surface); color: var(--text);
  border: var(--border-width-default) solid var(--border);
  cursor: pointer; font-family: inherit;
}
.cpub-btn:hover { box-shadow: var(--shadow-sm); }
.cpub-btn-primary { background: var(--accent); color: var(--color-text-inverse); border-color: var(--accent); }
.cpub-btn-link { background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 4px 8px; font-size: 12px; }
.cpub-btn-link:hover { color: var(--text); }
.cpub-btn-danger { color: var(--red); }

.cpub-key-table {
  width: 100%; border-collapse: collapse;
  background: var(--surface); border: var(--border-width-default) solid var(--border);
}
.cpub-key-table th, .cpub-key-table td {
  padding: 10px 12px; text-align: left; font-size: 12px;
  border-bottom: var(--border-width-default) solid var(--border2);
}
.cpub-key-table th { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-faint); background: var(--surface2); }
.cpub-key-desc { font-size: 11px; color: var(--text-dim); margin-top: 2px; }
.cpub-key-revoked { opacity: 0.5; }

.cpub-scope-tag {
  display: inline-block; padding: 2px 6px; margin: 1px;
  background: var(--surface2); border: var(--border-width-default) solid var(--border);
  font-family: var(--font-mono); font-size: 10px;
}

.cpub-key-badge { font-family: var(--font-mono); font-size: 10px; padding: 2px 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.cpub-key-badge-green { background: var(--green-bg); color: var(--green); border: var(--border-width-default) solid var(--green); }
.cpub-key-badge-yellow { background: var(--yellow-bg); color: var(--yellow); border: var(--border-width-default) solid var(--yellow); }
.cpub-key-badge-red { background: var(--red-bg); color: var(--red); border: var(--border-width-default) solid var(--red); }

.cpub-loading { padding: 40px; text-align: center; color: var(--text-dim); }
.cpub-empty { padding: 40px; text-align: center; color: var(--text-dim); background: var(--surface); border: var(--border-width-default) solid var(--border); }
.cpub-empty code { font-family: var(--font-mono); background: var(--surface2); padding: 1px 6px; }
.cpub-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
</style>
