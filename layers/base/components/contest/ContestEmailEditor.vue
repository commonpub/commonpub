<script setup lang="ts">
/**
 * ContestEmailEditor — the Emails body tab of the contest editor (session 232).
 * Lets an organizer customize the subject + plain-text intro of the two contest
 * participation emails per contest, with a live server-rendered preview. Organizers
 * supply PLAIN TEXT + a fixed token allow-list only (never HTML): the server escapes
 * + interpolates tokens and owns all other chrome (unsubscribe, CTA, deadline line).
 *
 * Copy is loaded via the organizer-gated GET (the public contest DTO never carries
 * it) and saved through the normal whole-contest save (the parent's buildPayload
 * includes `emailCopy` once loaded). Empty field = built-in default, mirroring the
 * admin email-branding editor. Preview uses a sandboxed iframe srcdoc (never v-html).
 */
import { useBlockEditor, BlockCanvas, type BlockTypeGroup } from '@commonpub/editor/vue';
import type { ContestEmailCopy } from '@commonpub/schema';
import type { ContestEmailCopyForm } from '../../composables/useContestEditor';
import { seedEmailBlocks } from '../../utils/contestEmailDefaults';

const props = defineProps<{ slug: string; modelValue: ContestEmailCopyForm }>();
const emit = defineEmits<{ 'update:modelValue': [v: ContestEmailCopyForm]; load: [c: ContestEmailCopy] }>();

type TemplateKey = 'confirmation' | 'reminder';
const TEMPLATES: { key: TemplateKey; label: string; tokens: string[] }[] = [
  { key: 'confirmation', label: 'Registration confirmation', tokens: ['contestTitle', 'deadline', 'username', 'contestUrl'] },
  { key: 'reminder', label: 'Deadline reminder', tokens: ['contestTitle', 'deadline', 'username', 'timeRemaining', 'contestUrl'] },
];
const active = ref<TemplateKey>('confirmation');
const activeTokens = computed(() => TEMPLATES.find((t) => t.key === active.value)!.tokens);

// Writable bindings onto the active template's two fields; every change emits a
// fresh form object so the parent ref (and its dirty watcher) sees the update.
function patch(part: Partial<ContestEmailCopyForm>): void {
  emit('update:modelValue', { ...props.modelValue, ...part });
}
const subject = computed<string>({
  get: () => (active.value === 'confirmation' ? props.modelValue.confirmationSubject : props.modelValue.reminderSubject),
  set: (v) => patch(active.value === 'confirmation' ? { confirmationSubject: v } : { reminderSubject: v }),
});
// Legacy plain-text intro (session 232) — no longer an editable field (the block
// body supersedes it), but still read from the loaded copy to seed the editor +
// as a preview fallback until the organizer edits.
const intro = computed<string>(() =>
  active.value === 'confirmation' ? props.modelValue.confirmationIntro : props.modelValue.reminderIntro,
);

// --- Block-editor email BODY (M3). Two editors (one per template), each seeded
// ONCE from the loaded copy under a `hydrating` guard. Sync is strictly one-way
// editor -> form (patch), so a genuine block edit marks the form dirty + refreshes
// the preview, while the initial seed + parent echo never loop back into the editor
// (we NEVER watch modelValue to re-seed). ---
const confirmationEditor = useBlockEditor();
const reminderEditor = useBlockEditor();
const activeEditor = computed(() => (active.value === 'confirmation' ? confirmationEditor : reminderEditor));
let hydrating = false;

// Email-safe palette — ONLY the block types renderEmailBlocks supports; any other
// type would render in the editor but be silently dropped from the sent email.
const emailBlockGroups: BlockTypeGroup[] = [
  {
    name: 'Text',
    blocks: [
      { type: 'paragraph', label: 'Text', icon: 'fa-align-left', description: 'Body text' },
      { type: 'heading', label: 'Heading', icon: 'fa-heading', description: 'Section heading' },
      { type: 'blockquote', label: 'Quote', icon: 'fa-quote-left', description: 'Quotation' },
    ],
  },
  {
    name: 'Blocks',
    blocks: [
      { type: 'callout', label: 'Callout', icon: 'fa-circle-info', description: 'Highlighted note', attrs: { variant: 'info' } },
      { type: 'image', label: 'Image', icon: 'fa-image', description: 'Upload or link an image' },
      { type: 'horizontal_rule', label: 'Divider', icon: 'fa-minus', description: 'Horizontal rule' },
      { type: 'registrationLink', label: 'Registration Link', icon: 'fa-user-plus', description: 'Sign-up CTA button' },
    ],
  },
];

// One-way editor -> form. When blocks exist they supersede the legacy intro, so
// clear the form's intro too (single source of truth in state, not just in the
// saved payload) — otherwise a later clear-all would resurrect a stale intro
// instead of falling back to the built-in default.
watch(() => confirmationEditor.blocks.value, () => {
  if (hydrating) return;
  const b = confirmationEditor.toBlockTuples();
  patch(b.length ? { confirmationBlocks: b, confirmationIntro: '' } : { confirmationBlocks: b });
}, { deep: true });
watch(() => reminderEditor.blocks.value, () => {
  if (hydrating) return;
  const b = reminderEditor.toBlockTuples();
  patch(b.length ? { reminderBlocks: b, reminderIntro: '' } : { reminderBlocks: b });
}, { deep: true });

// --- Live preview (debounced, server-rendered, sandboxed iframe) ---
const previewHtml = ref('');
let previewTimer: ReturnType<typeof setTimeout> | undefined;

async function refreshPreview(): Promise<void> {
  try {
    const blocks = activeEditor.value.toBlockTuples();
    const res = await $fetch<{ html: string; subject: string }>(`/api/contests/${props.slug}/email-preview`, {
      method: 'POST',
      body: {
        template: active.value,
        copy: {
          subject: subject.value.trim() || undefined,
          intro: intro.value.trim() || undefined,
          bodyBlocks: blocks.length ? blocks : undefined,
        },
      },
    });
    previewHtml.value = res.html;
  } catch {
    // Keep the last good preview on a transient error (matches the branding editor).
  }
}

watch([active, () => props.modelValue], () => {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(refreshPreview, 400);
});

onMounted(async () => {
  let stored: ContestEmailCopy | undefined;
  try {
    stored = await $fetch<ContestEmailCopy>(`/api/contests/${props.slug}/email-copy`);
    emit('load', stored);
  } catch {
    // No stored override (or transient error) — seed from built-in defaults.
  }
  // Seed both block editors ONCE from the loaded copy (blocks > intro > defaults),
  // under `hydrating` so the seed does not emit a form change / mark it dirty.
  hydrating = true;
  confirmationEditor.fromBlockTuples(seedEmailBlocks(stored?.confirmation?.bodyBlocks, stored?.confirmation?.intro, 'confirmation'));
  reminderEditor.fromBlockTuples(seedEmailBlocks(stored?.reminder?.bodyBlocks, stored?.reminder?.intro, 'reminder'));
  await nextTick();
  hydrating = false;
  void refreshPreview();
});

// --- Send a test of the ACTIVE template to an arbitrary email or a chosen user ---
type UserHit = { id: string; username: string; displayName: string | null; avatarUrl: string | null };
const toast = useToast();
const testEmail = ref('');
const userQuery = ref('');
const userResults = ref<UserHit[]>([]);
const selectedUser = ref<UserHit | null>(null);
const searching = ref(false);
const sending = ref(false);
let userTimer: ReturnType<typeof setTimeout> | undefined;

const canSendTest = computed(
  () => !sending.value && (!!selectedUser.value || /.+@.+\..+/.test(testEmail.value.trim())),
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
  sending.value = true;
  try {
    const blocks = activeEditor.value.toBlockTuples();
    const copyPayload = {
      subject: subject.value.trim() || undefined,
      intro: intro.value.trim() || undefined,
      bodyBlocks: blocks.length ? blocks : undefined,
    };
    const body = selectedUser.value
      ? { template: active.value, copy: copyPayload, toUserId: selectedUser.value.id }
      : { template: active.value, copy: copyPayload, toEmail: testEmail.value.trim() };
    const res = await $fetch<{ sent: true; to: string }>(`/api/contests/${props.slug}/email-test`, { method: 'POST', body });
    toast.success(`Test ${active.value === 'reminder' ? 'reminder' : 'confirmation'} email sent to ${res.to}`);
  } catch (e: unknown) {
    const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage;
    toast.error(msg || 'Failed to send test email');
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <div class="cpub-cee">
    <p class="cpub-form-hint">
      Customize the two participation emails for this contest. Leave a field blank to use the built-in default.
      You write the subject and a plain-text intro; the unsubscribe link, the button, and the deadline line are added
      automatically. Use the tokens below to drop in contest details.
    </p>

    <div class="cpub-cee-templates" role="group" aria-label="Email template">
      <button
        v-for="t in TEMPLATES"
        :key="t.key"
        type="button"
        :aria-pressed="active === t.key"
        class="cpub-cee-tpl"
        :class="{ 'cpub-cee-tpl-active': active === t.key }"
        @click="active = t.key"
      >
        <i class="fa-solid" :class="t.key === 'reminder' ? 'fa-bell' : 'fa-circle-check'"></i> {{ t.label }}
      </button>
    </div>

    <div class="cpub-cee-cols">
      <div class="cpub-cee-form">
        <label class="cpub-cee-field">
          <span class="cpub-form-label">Subject</span>
          <input v-model="subject" type="text" maxlength="200" class="cpub-form-input" placeholder="Use the built-in default subject" />
        </label>

        <div class="cpub-cee-field">
          <span class="cpub-form-label">Body</span>
          <p class="cpub-form-hint">Compose the email body with blocks. Add a <strong>Registration Link</strong> block for a sign-up button. It opens with the built-in default message you can edit.</p>
          <div class="cpub-cee-body">
            <BlockCanvas :key="active" :block-editor="activeEditor" :block-types="emailBlockGroups" />
          </div>
        </div>

        <div class="cpub-cee-tokens">
          <span class="cpub-form-label">Available tokens</span>
          <ul class="cpub-cee-token-list">
            <li v-for="tok in activeTokens" :key="tok"><code>{{ '{' + tok + '}' }}</code></li>
          </ul>
          <p class="cpub-form-hint">Tokens are replaced when the email is sent. Unknown tokens are left as-is.</p>
        </div>
      </div>

      <div class="cpub-cee-preview">
        <div class="cpub-cee-preview-head">
          <span class="cpub-form-label">Live preview</span>
          <span class="cpub-cee-preview-tag">What recipients see</span>
        </div>
        <iframe
          v-if="previewHtml"
          :srcdoc="previewHtml"
          sandbox=""
          class="cpub-cee-frame"
          title="Email preview"
        ></iframe>
        <div v-else class="cpub-cee-frame-empty">Preview unavailable</div>
      </div>
    </div>

    <div class="cpub-cee-test">
      <span class="cpub-form-label">Send a test</span>
      <p class="cpub-form-hint">
        Send the {{ active === 'reminder' ? 'deadline reminder' : 'registration confirmation' }} (with your current
        draft) to any email address, or search for a user to send it to their address.
      </p>
      <div class="cpub-cee-test-row">
        <span v-if="selectedUser" class="cpub-cee-chip">
          <i class="fa-solid fa-user"></i> {{ selectedUser.displayName || selectedUser.username }}
          <button type="button" class="cpub-cee-chip-x" aria-label="Clear recipient" @click="clearUser">×</button>
        </span>
        <template v-else>
          <input
            v-model="testEmail"
            type="email"
            class="cpub-form-input cpub-cee-test-email"
            placeholder="name@example.com"
            aria-label="Test recipient email"
          />
          <div class="cpub-cee-usersearch">
            <input
              v-model="userQuery"
              type="text"
              class="cpub-form-input"
              placeholder="or search a user…"
              aria-label="Search users"
              @input="onUserSearch"
            />
            <div v-if="userResults.length" class="cpub-cee-userdrop">
              <button
                v-for="u in userResults"
                :key="u.id"
                type="button"
                class="cpub-cee-userdrop-item"
                @click="pickUser(u)"
              >
                <span class="cpub-cee-userdrop-name">{{ u.displayName || u.username }}</span>
                <span class="cpub-cee-userdrop-handle">@{{ u.username }}</span>
              </button>
            </div>
            <div v-else-if="searching" class="cpub-cee-userdrop">
              <span class="cpub-cee-userdrop-empty">Searching…</span>
            </div>
            <div v-else-if="userQuery.length >= 2" class="cpub-cee-userdrop">
              <span class="cpub-cee-userdrop-empty">No users found</span>
            </div>
          </div>
        </template>
        <button
          type="button"
          class="cpub-btn cpub-btn-primary cpub-cee-test-send"
          :disabled="!canSendTest"
          @click="sendTest"
        >
          {{ sending ? 'Sending…' : 'Send test' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-cee { display: flex; flex-direction: column; gap: var(--space-3); }
.cpub-cee-templates { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.cpub-cee-tpl {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3); background: transparent; cursor: pointer;
  border: var(--border-width-default) solid var(--border);
  font-size: var(--text-sm); font-weight: var(--font-weight-semibold); color: var(--text-dim);
}
.cpub-cee-tpl:hover { color: var(--text); }
.cpub-cee-tpl-active { background: var(--accent-bg); color: var(--accent); border-color: var(--accent); }

.cpub-cee-cols { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); align-items: start; }
.cpub-cee-form { display: flex; flex-direction: column; gap: var(--space-3); }
.cpub-cee-field { display: flex; flex-direction: column; gap: var(--space-1); }
.cpub-cee-body {
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  min-height: clamp(200px, 30vh, 280px);
  padding: var(--space-2);
}

.cpub-cee-tokens { display: flex; flex-direction: column; gap: var(--space-2); }
.cpub-cee-token-list { display: flex; flex-wrap: wrap; gap: var(--space-2); list-style: none; margin: 0; padding: 0; }
.cpub-cee-token-list code {
  font-family: var(--font-mono); font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2); background: var(--surface2); color: var(--text-dim);
  border: var(--border-width-default) solid var(--border);
}

.cpub-cee-preview { position: sticky; top: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); }
.cpub-cee-preview-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2); }
.cpub-cee-preview-head .cpub-form-label { margin: 0; }
.cpub-cee-preview-tag { font-size: var(--text-label); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: var(--tracking-wide); color: var(--text-faint); }
/* #fff frame: the preview is a REAL email (server-rendered, inline-styled) whose
   client is white — CSS vars don't exist inside the sandboxed srcdoc. Intentional. */
.cpub-cee-frame { width: 100%; height: clamp(420px, 60vh, 560px); border: var(--border-width-default) solid var(--border); background: #fff; }
.cpub-cee-frame-empty {
  width: 100%; height: clamp(420px, 60vh, 560px); display: flex; align-items: center; justify-content: center;
  border: var(--border-width-default) solid var(--border); background: var(--surface2); color: var(--text-faint); font-size: var(--text-sm);
}

@media (max-width: 760px) {
  .cpub-cee-cols { grid-template-columns: 1fr; }
  .cpub-cee-preview { position: static; }
}

/* --- Send a test --- */
.cpub-cee-test {
  display: flex; flex-direction: column; gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: var(--border-width-default) solid var(--border);
}
.cpub-cee-test-row { display: flex; flex-wrap: wrap; align-items: flex-start; gap: var(--space-2); }
.cpub-cee-test-email { flex: 1 1 220px; min-width: 180px; }
.cpub-cee-usersearch { position: relative; flex: 1 1 220px; min-width: 180px; }
.cpub-cee-userdrop {
  position: absolute; top: calc(100% + var(--space-1)); left: 0; right: 0; z-index: var(--z-dropdown);
  background: var(--surface); border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-md); max-height: 240px; overflow-y: auto;
}
.cpub-cee-userdrop-item {
  display: flex; align-items: baseline; gap: var(--space-2); width: 100%;
  padding: var(--space-2) var(--space-3); background: transparent; border: none; cursor: pointer; text-align: left;
}
.cpub-cee-userdrop-item:hover { background: var(--surface2); }
.cpub-cee-userdrop-name { color: var(--text); font-size: var(--text-sm); }
.cpub-cee-userdrop-handle { color: var(--text-dim); font-family: var(--font-mono); font-size: var(--text-xs); }
.cpub-cee-userdrop-empty { display: block; padding: var(--space-2) var(--space-3); color: var(--text-dim); font-size: var(--text-sm); }
.cpub-cee-chip {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3); background: var(--accent-bg); color: var(--accent-text);
  border: var(--border-width-default) solid var(--accent);
}
.cpub-cee-chip i { color: var(--accent); }
.cpub-cee-chip-x {
  background: transparent; border: none; color: var(--accent-text); cursor: pointer;
  font-size: var(--text-lg); line-height: 1; padding: 0;
}
.cpub-cee-test-send { flex: 0 0 auto; align-self: flex-start; }
</style>
