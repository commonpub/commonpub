<script setup lang="ts">
/**
 * ContestAnnouncementComposer — the Announcements body tab of the contest editor
 * (session 259). An organizer writes an arbitrary email to this contest's
 * participants: subject + a block body with {tokens}, an audience, a live
 * recipient count, a server-rendered preview, a test send, then the real send.
 *
 * Safety model, inherited from ContestEmailEditor:
 *  - The organizer supplies BLOCKS and plain text, never HTML. The server escapes
 *    everything through renderEmailBlocks, the single choke point.
 *  - The preview is a sandboxed iframe srcdoc, never v-html.
 *  - The recipient count is a number. Addresses never come back to the client.
 *
 * This composer does NOT ride the whole-contest save: an announcement is an
 * action, not a field, so nothing here is persisted until Send.
 */
// `provide` explicitly rather than via auto-import: the layer's bare component
// test harness has no auto-imports, and a missing one is a hard ReferenceError.
import { provide } from 'vue';
import { useBlockEditor, BlockCanvas } from '@commonpub/editor/vue';
import { emailBlockGroups } from '../../utils/contestEmailBlocks';
import { ANNOUNCEMENT_TOKEN_NAMES, ANNOUNCEMENT_TOKEN_HINTS } from '../../utils/contestEmailTokens';

const props = defineProps<{ slug: string }>();

// A blank registration-link block in a contest email resolves to THIS contest's
// registration page, not the instance account-signup page. Tell the block's URL
// field so, so the placeholder matches what the send actually does.
provide('cpubRegistrationLinkDefault', 'this contest’s registration page (default)');

const toast = useToast();
const { features } = useFeatures();

// An organizer on an instance with email delivery OFF can still compose and
// preview, but the send route refuses (the outbox worker never drains, so an
// "sent" announcement would sit queued forever). Say so up front rather than
// letting them write an email and meet a 409 at the end.
const deliveryOn = computed(() => features.value.emailNotifications === true);

// --- Composition ---
const subject = ref('');
const editor = useBlockEditor();

type Tier = 'all' | 'full' | 'reminders';
const TIERS: { key: Tier; label: string; hint: string }[] = [
  { key: 'all', label: 'Everyone registered', hint: 'Both full participants and people who only asked for reminders' },
  { key: 'full', label: 'Full participants only', hint: 'People who registered to take part' },
  { key: 'reminders', label: 'Reminders-only signups', hint: 'People who asked for deadline reminders but did not register to take part' },
];
const tier = ref<Tier>('all');
const audience = computed(() => ({ kind: 'registrants' as const, tier: tier.value }));

// One key per compose session. The server returns the first announcement instead
// of mailing everyone again if this key repeats, so a double-clicked Send (or a
// client retry after a timeout) cannot blast the audience twice. Rotated after a
// successful send, so the NEXT announcement is genuinely new.
const idempotencyKey = ref(newKey());
function newKey(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2)}`).slice(0, 64);
}

const hasBody = computed(() => editor.blocks.value.length > 0);
const canSend = computed(() => deliveryOn.value && !!subject.value.trim() && hasBody.value && !sending.value);

// --- Recipient count (debounced; the number the organizer approves) ---
const recipientCount = ref<number | null>(null);
const counting = ref(false);
let countTimer: ReturnType<typeof setTimeout> | undefined;

async function refreshCount(): Promise<void> {
  counting.value = true;
  try {
    const res = await $fetch<{ count: number }>(`/api/contests/${props.slug}/announcements/recipients`, {
      method: 'POST',
      body: audience.value,
    });
    recipientCount.value = res.count;
  } catch {
    recipientCount.value = null;
  } finally {
    counting.value = false;
  }
}

watch(tier, () => {
  if (countTimer) clearTimeout(countTimer);
  countTimer = setTimeout(refreshCount, 200);
});

// --- Live preview (debounced, server-rendered, sandboxed iframe) ---
const previewHtml = ref('');
let previewTimer: ReturnType<typeof setTimeout> | undefined;

async function refreshPreview(): Promise<void> {
  try {
    const res = await $fetch<{ html: string; subject: string }>(`/api/contests/${props.slug}/announcements/preview`, {
      method: 'POST',
      body: { subject: subject.value.trim() || 'Subject', bodyBlocks: editor.toBlockTuples() },
    });
    previewHtml.value = res.html;
  } catch {
    previewHtml.value = '';
  }
}

watch([subject, () => editor.blocks.value], () => {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(refreshPreview, 400);
}, { deep: true });

onMounted(() => {
  // Open with a working starter rather than a blank canvas.
  editor.fromBlockTuples([
    ['heading', { text: 'Hi {username},', level: 2 }],
    ['paragraph', { html: '' }],
  ]);
  void refreshCount();
  void refreshPreview();
});

// --- Send a test to yourself or anyone ---
type UserHit = { id: string; username: string; displayName: string | null; avatarUrl: string | null };
const testEmail = ref('');
const userQuery = ref('');
const userResults = ref<UserHit[]>([]);
const selectedUser = ref<UserHit | null>(null);
const searching = ref(false);
const testing = ref(false);
let userTimer: ReturnType<typeof setTimeout> | undefined;

const canSendTest = computed(
  () => !testing.value && hasBody.value && !!subject.value.trim()
    && (!!selectedUser.value || /.+@.+\..+/.test(testEmail.value.trim())),
);

function onUserSearch(): void {
  if (userTimer) clearTimeout(userTimer);
  const q = userQuery.value.trim();
  if (q.length < 2) { userResults.value = []; searching.value = false; return; }
  searching.value = true;
  userTimer = setTimeout(async () => {
    try {
      userResults.value = await $fetch<UserHit[]>(`/api/contests/${props.slug}/user-search`, { query: { q, limit: 8 } });
    } catch { userResults.value = []; }
    finally { searching.value = false; }
  }, 250);
}
function pickUser(u: UserHit): void {
  selectedUser.value = u;
  userQuery.value = '';
  userResults.value = [];
  testEmail.value = '';
}
function clearUser(): void { selectedUser.value = null; }

async function sendTest(): Promise<void> {
  if (!canSendTest.value) return;
  testing.value = true;
  try {
    const base = { subject: subject.value.trim(), bodyBlocks: editor.toBlockTuples() };
    const body = selectedUser.value
      ? { ...base, toUserId: selectedUser.value.id }
      : { ...base, toEmail: testEmail.value.trim() };
    const res = await $fetch<{ sent: true; to: string }>(`/api/contests/${props.slug}/announcements/test`, { method: 'POST', body });
    toast.success(`Test announcement sent to ${res.to}`);
  } catch (e: unknown) {
    toast.error(errMessage(e) || 'Failed to send the test email');
  } finally {
    testing.value = false;
  }
}

// --- The real send, behind an explicit confirm step ---
const confirming = ref(false);
const sending = ref(false);

function errMessage(e: unknown): string | undefined {
  return (e as { data?: { statusMessage?: string }; statusMessage?: string })?.data?.statusMessage
    ?? (e as { statusMessage?: string })?.statusMessage;
}

async function send(): Promise<void> {
  if (!canSend.value) return;
  sending.value = true;
  try {
    const res = await $fetch<{ announcementId: string; recipientCount: number; duplicate: boolean }>(
      `/api/contests/${props.slug}/announcements`,
      {
        method: 'POST',
        body: {
          subject: subject.value.trim(),
          bodyBlocks: editor.toBlockTuples(),
          audience: audience.value,
          idempotencyKey: idempotencyKey.value,
        },
      },
    );
    if (res.duplicate) {
      toast.show('That announcement was already sent. Nobody was emailed twice.', 'info');
    } else {
      toast.success(`Announcement sent to ${res.recipientCount} ${res.recipientCount === 1 ? 'person' : 'people'}.`);
    }
    confirming.value = false;
    // A fresh key, so the next announcement is not mistaken for a retry of this one.
    idempotencyKey.value = newKey();
    await loadHistory();
  } catch (e: unknown) {
    toast.error(errMessage(e) || 'Failed to send the announcement');
  } finally {
    sending.value = false;
  }
}

// --- History ---
type Summary = {
  id: string; subject: string; recipientCount: number; status: string;
  audience: { kind: string; tier?: string }; sentAt: string | null; createdAt: string;
};
const history = ref<Summary[]>([]);

async function loadHistory(): Promise<void> {
  try {
    history.value = await $fetch<Summary[]>(`/api/contests/${props.slug}/announcements`);
  } catch {
    history.value = [];
  }
}
onMounted(loadHistory);

// Dates render on the client only: a server-rendered locale date mismatches the
// browser's timezone and shows up as a hydration error only in production.
const mounted = ref(false);
onMounted(() => { mounted.value = true; });
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString();
}
</script>

<template>
  <div class="cpub-cac">
    <p class="cpub-form-hint">
      Write an email to the people registered for this contest. You write the subject and the body; the
      unsubscribe link, the button back to the contest, and the branded frame are added automatically.
      Every recipient gets their own copy, with the tokens below filled in for them.
    </p>

    <div class="cpub-cac-cols">
      <div class="cpub-cac-form">
        <div class="cpub-cac-field">
          <span id="cpub-cac-aud-label" class="cpub-form-label">Who gets this</span>
          <div class="cpub-cac-tiers" role="radiogroup" aria-labelledby="cpub-cac-aud-label">
            <button
              v-for="t in TIERS"
              :key="t.key"
              type="button"
              role="radio"
              :aria-checked="tier === t.key"
              class="cpub-cac-tier"
              :class="{ 'cpub-cac-tier-active': tier === t.key }"
              @click="tier = t.key"
            >
              <span class="cpub-cac-tier-label">{{ t.label }}</span>
              <span class="cpub-cac-tier-hint">{{ t.hint }}</span>
            </button>
          </div>
          <p class="cpub-form-hint" aria-live="polite">
            <template v-if="counting">Counting recipients…</template>
            <template v-else-if="recipientCount === null">Recipient count unavailable.</template>
            <template v-else>
              <strong>{{ recipientCount }}</strong>
              {{ recipientCount === 1 ? 'person' : 'people' }} will receive this.
              People who unsubscribed, or whose address is not confirmed, are never included.
            </template>
          </p>
        </div>

        <label class="cpub-cac-field">
          <span class="cpub-form-label">Subject</span>
          <input
            v-model="subject"
            type="text"
            maxlength="200"
            class="cpub-form-input"
            placeholder="An update on {contestTitle}"
          />
        </label>

        <div class="cpub-cac-field">
          <span class="cpub-form-label">Body</span>
          <p class="cpub-form-hint">
            Compose with blocks. A <strong>Registration Link</strong> block adds a button to this contest's
            registration page; set its Link URL to send people somewhere else instead.
          </p>
          <div class="cpub-cac-body">
            <BlockCanvas :block-editor="editor" :block-types="emailBlockGroups" />
          </div>
        </div>

        <div class="cpub-cac-tokens">
          <span class="cpub-form-label">Available tokens</span>
          <ul class="cpub-cac-token-list">
            <li v-for="tok in ANNOUNCEMENT_TOKEN_NAMES" :key="tok">
              <code>{{ '{' + tok + '}' }}</code>
              <span class="cpub-cac-token-hint">{{ ANNOUNCEMENT_TOKEN_HINTS[tok] }}</span>
            </li>
          </ul>
          <p class="cpub-form-hint">Tokens are replaced for each recipient when the email is sent. Unknown tokens are left as-is.</p>
        </div>
      </div>

      <div class="cpub-cac-preview">
        <div class="cpub-cac-preview-head">
          <span class="cpub-form-label">Live preview</span>
          <span class="cpub-cac-preview-tag">What recipients see</span>
        </div>
        <iframe
          v-if="previewHtml"
          :srcdoc="previewHtml"
          sandbox=""
          class="cpub-cac-frame"
          title="Announcement preview"
        ></iframe>
        <div v-else class="cpub-cac-frame-empty">Preview unavailable</div>
      </div>
    </div>

    <div class="cpub-cac-test">
      <span class="cpub-form-label">Send a test first</span>
      <p class="cpub-form-hint">
        Read it in a real inbox before anyone else does. Send it to any address, or search for a user to send it
        to theirs. The subject is marked with [TEST].
      </p>
      <div class="cpub-cac-test-row">
        <span v-if="selectedUser" class="cpub-cac-chip">
          <i class="fa-solid fa-user"></i> {{ selectedUser.displayName || selectedUser.username }}
          <button type="button" class="cpub-cac-chip-x" aria-label="Clear test recipient" @click="clearUser">×</button>
        </span>
        <template v-else>
          <input
            v-model="testEmail"
            type="email"
            class="cpub-form-input cpub-cac-test-email"
            placeholder="name@example.com"
            aria-label="Test recipient email"
          />
          <div class="cpub-cac-usersearch">
            <input
              v-model="userQuery"
              type="text"
              class="cpub-form-input"
              placeholder="or search a user…"
              aria-label="Search users"
              @input="onUserSearch"
            />
            <div v-if="userResults.length" class="cpub-cac-userdrop">
              <button
                v-for="u in userResults"
                :key="u.id"
                type="button"
                class="cpub-cac-userdrop-item"
                @click="pickUser(u)"
              >
                <span class="cpub-cac-userdrop-name">{{ u.displayName || u.username }}</span>
                <span class="cpub-cac-userdrop-handle">@{{ u.username }}</span>
              </button>
            </div>
            <div v-else-if="searching" class="cpub-cac-userdrop">
              <span class="cpub-cac-userdrop-empty">Searching…</span>
            </div>
            <div v-else-if="userQuery.length >= 2" class="cpub-cac-userdrop">
              <span class="cpub-cac-userdrop-empty">No users found</span>
            </div>
          </div>
        </template>
        <button
          type="button"
          class="cpub-btn cpub-btn-secondary cpub-cac-test-send"
          :disabled="!canSendTest"
          @click="sendTest"
        >
          {{ testing ? 'Sending…' : 'Send test' }}
        </button>
      </div>
    </div>

    <div class="cpub-cac-send">
      <p v-if="!deliveryOn" class="cpub-cac-blocked" role="status">
        <i class="fa-solid fa-triangle-exclamation"></i>
        Email delivery is turned off on this instance, so an announcement cannot be sent yet. You can still write it
        and check the preview. Ask an operator to turn on Email Notifications.
      </p>
      <template v-if="!confirming">
        <button
          type="button"
          class="cpub-btn cpub-btn-primary"
          :disabled="!canSend"
          @click="confirming = true"
        >
          Send to participants
        </button>
        <span v-if="!canSend && deliveryOn" class="cpub-form-hint">Add a subject and a body first.</span>
      </template>
      <div v-else class="cpub-cac-confirm" role="alertdialog" aria-labelledby="cpub-cac-confirm-title">
        <p id="cpub-cac-confirm-title" class="cpub-cac-confirm-title">
          Email
          <strong>{{ recipientCount === null ? 'the selected' : recipientCount }}</strong>
          {{ recipientCount === 1 ? 'person' : 'people' }}?
        </p>
        <p class="cpub-form-hint">This sends straight away and cannot be undone.</p>
        <div class="cpub-cac-confirm-row">
          <button type="button" class="cpub-btn cpub-btn-primary" :disabled="sending" @click="send">
            {{ sending ? 'Sending…' : 'Yes, send it' }}
          </button>
          <button type="button" class="cpub-btn cpub-btn-secondary" :disabled="sending" @click="confirming = false">
            Cancel
          </button>
        </div>
      </div>
    </div>

    <div v-if="history.length" class="cpub-cac-history">
      <span class="cpub-form-label">Sent before</span>
      <ul class="cpub-cac-history-list">
        <li v-for="h in history" :key="h.id" class="cpub-cac-history-item">
          <span class="cpub-cac-history-subject">{{ h.subject }}</span>
          <span class="cpub-cac-history-meta">
            {{ h.recipientCount }} {{ h.recipientCount === 1 ? 'recipient' : 'recipients' }}
            <template v-if="h.sentAt">
              ·
              <time :datetime="h.sentAt">{{ mounted ? formatWhen(h.sentAt) : '' }}</time>
            </template>
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.cpub-cac { display: flex; flex-direction: column; gap: var(--space-3); }

.cpub-cac-cols { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); align-items: start; }
.cpub-cac-form { display: flex; flex-direction: column; gap: var(--space-3); }
.cpub-cac-field { display: flex; flex-direction: column; gap: var(--space-1); }

.cpub-cac-tiers { display: flex; flex-direction: column; gap: var(--space-2); }
.cpub-cac-tier {
  display: flex; flex-direction: column; gap: var(--space-1); text-align: left; cursor: pointer;
  padding: var(--space-2) var(--space-3); background: transparent;
  border: var(--border-width-default) solid var(--border);
}
.cpub-cac-tier:hover { border-color: var(--accent); }
.cpub-cac-tier-active { background: var(--accent-bg); border-color: var(--accent); }
.cpub-cac-tier-label { font-size: var(--text-sm); font-weight: var(--font-weight-semibold); color: var(--text); }
.cpub-cac-tier-active .cpub-cac-tier-label { color: var(--accent-text); }
.cpub-cac-tier-hint { font-size: var(--text-xs); color: var(--text-dim); }

.cpub-cac-body {
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  min-height: clamp(200px, 30vh, 280px);
  padding: var(--space-2);
}

.cpub-cac-tokens { display: flex; flex-direction: column; gap: var(--space-2); }
.cpub-cac-token-list { display: flex; flex-wrap: wrap; gap: var(--space-2); list-style: none; margin: 0; padding: 0; }
.cpub-cac-token-list code {
  font-family: var(--font-mono); font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2); background: var(--surface2); color: var(--text-dim);
  border: var(--border-width-default) solid var(--border);
}

.cpub-cac-preview { position: sticky; top: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); }
.cpub-cac-preview-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2); }
.cpub-cac-preview-head .cpub-form-label { margin: 0; }
.cpub-cac-preview-tag {
  font-size: var(--text-label); font-family: var(--font-mono); text-transform: uppercase;
  letter-spacing: var(--tracking-wide); color: var(--text-faint);
}
/* #fff frame: the preview is a REAL email (server-rendered, inline-styled) whose
   client is white. CSS vars do not exist inside the sandboxed srcdoc. Intentional. */
.cpub-cac-frame { width: 100%; height: clamp(420px, 60vh, 560px); border: var(--border-width-default) solid var(--border); background: #fff; }
.cpub-cac-frame-empty {
  width: 100%; height: clamp(420px, 60vh, 560px); display: flex; align-items: center; justify-content: center;
  border: var(--border-width-default) solid var(--border); background: var(--surface2);
  color: var(--text-faint); font-size: var(--text-sm);
}

.cpub-cac-test, .cpub-cac-send, .cpub-cac-history {
  display: flex; flex-direction: column; gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: var(--border-width-default) solid var(--border);
}
.cpub-cac-send { align-items: flex-start; }
.cpub-cac-test-row { display: flex; flex-wrap: wrap; align-items: flex-start; gap: var(--space-2); }
.cpub-cac-test-email { flex: 1 1 220px; min-width: 180px; }
.cpub-cac-usersearch { position: relative; flex: 1 1 220px; min-width: 180px; }
.cpub-cac-userdrop {
  position: absolute; top: calc(100% + var(--space-1)); left: 0; right: 0; z-index: var(--z-dropdown);
  background: var(--surface); border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-md); max-height: 240px; overflow-y: auto;
}
.cpub-cac-userdrop-item {
  display: flex; align-items: baseline; gap: var(--space-2); width: 100%;
  padding: var(--space-2) var(--space-3); background: transparent; border: none; cursor: pointer; text-align: left;
}
.cpub-cac-userdrop-item:hover { background: var(--surface2); }
.cpub-cac-userdrop-name { color: var(--text); font-size: var(--text-sm); }
.cpub-cac-userdrop-handle { color: var(--text-dim); font-family: var(--font-mono); font-size: var(--text-xs); }
.cpub-cac-userdrop-empty { display: block; padding: var(--space-2) var(--space-3); color: var(--text-dim); font-size: var(--text-sm); }
.cpub-cac-chip {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3); background: var(--accent-bg); color: var(--accent-text);
  border: var(--border-width-default) solid var(--accent);
}
.cpub-cac-chip i { color: var(--accent); }
.cpub-cac-chip-x {
  background: transparent; border: none; color: var(--accent-text); cursor: pointer;
  font-size: var(--text-lg); line-height: 1; padding: 0;
}
.cpub-cac-test-send { flex: 0 0 auto; align-self: flex-start; }

.cpub-cac-confirm {
  display: flex; flex-direction: column; gap: var(--space-2);
  padding: var(--space-3); background: var(--surface2);
  border: var(--border-width-default) solid var(--accent);
}
.cpub-cac-confirm-title { margin: 0; color: var(--text); font-size: var(--text-base); }
.cpub-cac-confirm-row { display: flex; flex-wrap: wrap; gap: var(--space-2); }

.cpub-cac-token-hint { color: var(--text-faint); font-size: var(--text-xs); margin-left: var(--space-2); }
.cpub-cac-blocked {
  display: flex; align-items: flex-start; gap: var(--space-2); margin: 0;
  padding: var(--space-2) var(--space-3);
  border: var(--border-width-default) solid var(--border);
  background: var(--surface2); color: var(--text-dim); font-size: var(--text-sm);
}
.cpub-cac-blocked i { color: var(--text-dim); margin-top: 2px; }
.cpub-cac-history-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.cpub-cac-history-item {
  display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: var(--border-width-default) solid var(--border);
}
.cpub-cac-history-subject { color: var(--text); font-size: var(--text-sm); }
.cpub-cac-history-meta { color: var(--text-dim); font-family: var(--font-mono); font-size: var(--text-xs); }

@media (max-width: 760px) {
  .cpub-cac-cols { grid-template-columns: 1fr; }
  .cpub-cac-preview { position: static; }
}
</style>
