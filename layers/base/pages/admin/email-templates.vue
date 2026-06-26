<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: `Email Branding, Admin, ${useSiteName()}` });

import type { EmailBranding } from '@commonpub/server';

const toast = useToast();
const siteName = useSiteName();

const form = reactive({ accentColor: '', headerText: '', logoUrl: '', footerText: '' });

// Non-blocking load; populate the form once it resolves (keeps setup sync so the
// page is straightforward to test and doesn't need a Suspense boundary).
const { data: loaded } = useFetch<EmailBranding>('/api/admin/email-branding');
watch(loaded, (v) => {
  if (!v) return;
  form.accentColor = v.accentColor ?? '';
  form.headerText = v.headerText ?? '';
  form.logoUrl = v.logoUrl ?? '';
  form.footerText = v.footerText ?? '';
}, { immediate: true });

// Only send non-empty fields; an empty field means "use the built-in default".
function buildPayload(): EmailBranding {
  const p: EmailBranding = {};
  if (form.accentColor.trim()) p.accentColor = form.accentColor.trim();
  if (form.headerText.trim()) p.headerText = form.headerText.trim();
  if (form.logoUrl.trim()) p.logoUrl = form.logoUrl.trim();
  if (form.footerText.trim()) p.footerText = form.footerText.trim();
  return p;
}

const validAccent = computed(() => !form.accentColor.trim() || /^#[0-9a-fA-F]{6}$/.test(form.accentColor.trim()));

// --- Live preview (server-rendered with the unsaved branding) ---
const previewHtml = ref('');
let previewTimer: ReturnType<typeof setTimeout> | null = null;
async function refreshPreview(): Promise<void> {
  if (!validAccent.value) return;
  try {
    const res = await $fetch<{ html: string }>('/api/admin/email-preview', { method: 'POST', body: buildPayload() });
    previewHtml.value = res.html;
  } catch {
    // leave the last good preview in place
  }
}
watch(form, () => {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(refreshPreview, 400);
});
onMounted(refreshPreview);

const saving = ref(false);
async function save(): Promise<void> {
  if (!validAccent.value) {
    toast.error('Accent color must be a hex value like #5b9cf6');
    return;
  }
  saving.value = true;
  try {
    await $fetch('/api/admin/email-branding', { method: 'PUT', body: buildPayload() });
    toast.success('Email branding saved');
  } catch {
    toast.error('Could not save email branding');
  } finally {
    saving.value = false;
  }
}

function resetDefaults(): void {
  form.accentColor = '';
  form.headerText = '';
  form.logoUrl = '';
  form.footerText = '';
}
</script>

<template>
  <div class="cpub-eb">
    <header class="cpub-eb-head">
      <h1 class="cpub-eb-title">Email Branding</h1>
      <p class="cpub-eb-sub">Customize how this instance's emails look. Empty fields use the defaults. Applies to all emails (verification, password reset, notifications, digests).</p>
    </header>

    <div class="cpub-eb-cols">
      <form class="cpub-eb-form" @submit.prevent="save">
        <div class="cpub-eb-field">
          <label for="eb-accent" class="cpub-eb-label">Accent color</label>
          <div class="cpub-eb-accentrow">
            <input id="eb-accent" v-model="form.accentColor" type="text" class="cpub-eb-input" placeholder="#5b9cf6" />
            <span class="cpub-eb-swatch" :style="{ background: validAccent && form.accentColor.trim() ? form.accentColor.trim() : '#5b9cf6' }" aria-hidden="true"></span>
          </div>
          <p v-if="!validAccent" class="cpub-eb-err">Must be a hex color like #5b9cf6.</p>
        </div>

        <div class="cpub-eb-field">
          <label for="eb-header" class="cpub-eb-label">Header text</label>
          <input id="eb-header" v-model="form.headerText" type="text" maxlength="80" class="cpub-eb-input" :placeholder="siteName" />
        </div>

        <div class="cpub-eb-field">
          <label for="eb-logo" class="cpub-eb-label">Logo URL</label>
          <input id="eb-logo" v-model="form.logoUrl" type="url" maxlength="500" class="cpub-eb-input" placeholder="https://example.com/logo.png" />
          <p class="cpub-eb-hint">Shown in the header instead of the text. Must be an https URL.</p>
        </div>

        <div class="cpub-eb-field">
          <label for="eb-footer" class="cpub-eb-label">Footer note</label>
          <textarea id="eb-footer" v-model="form.footerText" maxlength="300" rows="2" class="cpub-eb-input"></textarea>
        </div>

        <div class="cpub-eb-actions">
          <button type="submit" class="cpub-btn" :disabled="saving || !validAccent">{{ saving ? 'Saving...' : 'Save branding' }}</button>
          <button type="button" class="cpub-btn cpub-btn-ghost" @click="resetDefaults">Reset to defaults</button>
        </div>
      </form>

      <div class="cpub-eb-preview">
        <span class="cpub-eb-label">Live preview</span>
        <iframe v-if="previewHtml" :srcdoc="previewHtml" class="cpub-eb-frame" title="Email preview"></iframe>
        <div v-else class="cpub-eb-frame cpub-eb-frame-empty">Preview unavailable</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-eb { max-width: 1000px; margin: 0 auto; padding: 24px; }
.cpub-eb-title { font-size: 20px; font-weight: 700; margin: 0 0 6px; }
.cpub-eb-sub { font-size: 13px; color: var(--text-dim); line-height: 1.6; margin: 0 0 20px; max-width: 60ch; }
.cpub-eb-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
.cpub-eb-form { display: flex; flex-direction: column; gap: 16px; }
.cpub-eb-field { display: flex; flex-direction: column; gap: 6px; }
.cpub-eb-label { font-size: 11px; font-weight: 600; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); }
.cpub-eb-input { padding: 8px 12px; border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; font-family: var(--font-sans); width: 100%; }
.cpub-eb-input:focus { border-color: var(--accent); outline: none; box-shadow: var(--shadow-accent); }
.cpub-eb-accentrow { display: flex; align-items: center; gap: 10px; }
.cpub-eb-swatch { width: 28px; height: 28px; flex-shrink: 0; border: var(--border-width-default) solid var(--border); }
.cpub-eb-hint { font-size: 11px; color: var(--text-faint); margin: 0; }
.cpub-eb-err { font-size: 11px; color: var(--red-text); margin: 0; }
.cpub-eb-actions { display: flex; gap: 10px; margin-top: 4px; }
.cpub-btn-ghost { background: transparent; color: var(--text-dim); }
.cpub-eb-preview { display: flex; flex-direction: column; gap: 6px; position: sticky; top: 16px; }
.cpub-eb-frame { width: 100%; height: 520px; border: var(--border-width-default) solid var(--border); background: #fff; }
.cpub-eb-frame-empty { display: flex; align-items: center; justify-content: center; color: var(--text-faint); font-size: 13px; }
@media (max-width: 760px) { .cpub-eb-cols { grid-template-columns: 1fr; } }
</style>
