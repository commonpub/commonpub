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
import type { ContestEmailCopy } from '@commonpub/schema';
import type { ContestEmailCopyForm } from '../../composables/useContestEditor';

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
const intro = computed<string>({
  get: () => (active.value === 'confirmation' ? props.modelValue.confirmationIntro : props.modelValue.reminderIntro),
  set: (v) => patch(active.value === 'confirmation' ? { confirmationIntro: v } : { reminderIntro: v }),
});

// --- Live preview (debounced, server-rendered, sandboxed iframe) ---
const previewHtml = ref('');
let previewTimer: ReturnType<typeof setTimeout> | undefined;

async function refreshPreview(): Promise<void> {
  try {
    const res = await $fetch<{ html: string; subject: string }>(`/api/contests/${props.slug}/email-preview`, {
      method: 'POST',
      body: { template: active.value, copy: { subject: subject.value.trim() || undefined, intro: intro.value.trim() || undefined } },
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
  try {
    const stored = await $fetch<ContestEmailCopy>(`/api/contests/${props.slug}/email-copy`);
    emit('load', stored);
  } catch {
    // No stored override (or transient error) — the form stays at its defaults.
  }
  void refreshPreview();
});
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
        <label class="cpub-form-field">
          <span class="cpub-form-label">Subject</span>
          <input v-model="subject" type="text" maxlength="200" class="cpub-form-input" placeholder="Use the built-in default subject" />
        </label>

        <label class="cpub-form-field">
          <span class="cpub-form-label">Intro</span>
          <textarea v-model="intro" rows="6" maxlength="2000" class="cpub-form-input cpub-cee-intro" placeholder="Use the built-in default message. Blank lines start new paragraphs."></textarea>
        </label>

        <div class="cpub-cee-tokens">
          <span class="cpub-form-label">Available tokens</span>
          <ul class="cpub-cee-token-list">
            <li v-for="tok in activeTokens" :key="tok"><code>{{ '{' + tok + '}' }}</code></li>
          </ul>
          <p class="cpub-form-hint">Tokens are replaced when the email is sent. Unknown tokens are left as-is.</p>
        </div>
      </div>

      <div class="cpub-cee-preview">
        <span class="cpub-form-label">Live preview</span>
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
  </div>
</template>

<style scoped>
.cpub-cee { display: flex; flex-direction: column; gap: var(--space-3); }
.cpub-cee-templates { display: flex; gap: 6px; flex-wrap: wrap; }
.cpub-cee-tpl {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; background: transparent; cursor: pointer;
  border: var(--border-width-default) solid var(--border);
  font-size: var(--text-sm); font-weight: 600; color: var(--text-dim);
}
.cpub-cee-tpl:hover { color: var(--text); }
.cpub-cee-tpl-active { background: var(--accent-bg); color: var(--accent); border-color: var(--accent); }

.cpub-cee-cols { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); align-items: start; }
.cpub-cee-form { display: flex; flex-direction: column; gap: var(--space-3); }
.cpub-cee-intro { resize: vertical; font-family: inherit; }

.cpub-cee-tokens { display: flex; flex-direction: column; gap: 6px; }
.cpub-cee-token-list { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; margin: 0; padding: 0; }
.cpub-cee-token-list code {
  font-family: var(--font-mono); font-size: var(--text-xs);
  padding: 2px 6px; background: var(--surface2); color: var(--text-dim);
  border: var(--border-width-default) solid var(--border);
}

.cpub-cee-preview { position: sticky; top: 16px; display: flex; flex-direction: column; gap: 6px; }
.cpub-cee-frame { width: 100%; height: 520px; border: var(--border-width-default) solid var(--border); background: #fff; }
.cpub-cee-frame-empty {
  width: 100%; height: 520px; display: flex; align-items: center; justify-content: center;
  border: var(--border-width-default) solid var(--border); background: var(--surface2); color: var(--text-faint); font-size: var(--text-sm);
}

@media (max-width: 760px) { .cpub-cee-cols { grid-template-columns: 1fr; } }
</style>
