<script setup lang="ts">
import { computed } from 'vue';

/**
 * Registration-link block (edit side). Renders a call-to-action button that
 * points at a sign-up / registration URL, droppable into any BlockTuple[]
 * content (articles, projects, explainers, contests, and the contest email
 * body). Content shape: { label?, url?, ref? }.
 *  - `url` defaults to the instance register page (`/auth/register`) when blank.
 *  - `ref` (optional) is appended as `?ref=<code>` so a referral link can be
 *    attached for signup attribution (session 229 referralLinks); harmless when
 *    that feature is off (the register page just ignores an unknown ref).
 * Href safety is enforced on the VIEW side (URL_LINK_STRICT) — no server route
 * validates block content, so the renderer is the guard.
 */
const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ update: [content: Record<string, unknown>] }>();

const label = computed(() => (props.content.label as string) ?? '');
const url = computed(() => (props.content.url as string) ?? '');
const refCode = computed(() => (props.content.ref as string) ?? '');

type Variant = 'primary' | 'secondary';
const variant = computed<Variant>(() => (props.content.variant === 'secondary' ? 'secondary' : 'primary'));
const variantOptions: Array<{ value: Variant; label: string }> = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
];

function updateField(field: string, value: string): void {
  emit('update', { ...props.content, [field]: value });
}
function setVariant(v: Variant): void {
  emit('update', { ...props.content, variant: v });
}
</script>

<template>
  <div class="cpub-reglink-block">
    <div class="cpub-reglink-header"><i class="fa-solid fa-user-plus"></i> Registration Link</div>
    <label class="cpub-reglink-field">
      <span class="cpub-reglink-flabel">Button label</span>
      <input
        class="cpub-reglink-input"
        type="text"
        :value="label"
        placeholder="Register now"
        @input="updateField('label', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label class="cpub-reglink-field">
      <span class="cpub-reglink-flabel">Link URL</span>
      <input
        class="cpub-reglink-input"
        type="text"
        :value="url"
        placeholder="/auth/register (default)"
        @input="updateField('url', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label class="cpub-reglink-field">
      <span class="cpub-reglink-flabel">Referral code <span class="cpub-reglink-optional">(optional)</span></span>
      <input
        class="cpub-reglink-input"
        type="text"
        :value="refCode"
        placeholder="attach your referral code for attribution"
        @input="updateField('ref', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <div class="cpub-reglink-variant-row" role="group" aria-label="Button style">
      <span class="cpub-reglink-flabel">Style</span>
      <div class="cpub-reglink-variant-options">
        <button
          v-for="opt in variantOptions"
          :key="opt.value"
          type="button"
          class="cpub-reglink-variant-btn"
          :class="{ 'cpub-reglink-variant-btn-active': variant === opt.value }"
          :aria-pressed="variant === opt.value"
          @click="setVariant(opt.value)"
        >{{ opt.label }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-reglink-block { border: var(--border-width-default) solid var(--border2); background: var(--surface); }
.cpub-reglink-header { padding: 8px 12px; font-size: 12px; font-weight: 600; background: var(--surface2); border-bottom: var(--border-width-default) solid var(--border2); display: flex; align-items: center; gap: 8px; }
.cpub-reglink-header i { color: var(--accent); }
.cpub-reglink-field { display: block; padding: 8px 12px; border-bottom: var(--border-width-default) solid var(--border2); }
.cpub-reglink-flabel { display: block; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 4px; }
.cpub-reglink-optional { text-transform: none; letter-spacing: 0; color: var(--text-faint); }
.cpub-reglink-input { width: 100%; padding: 6px 8px; font-size: 13px; background: transparent; border: var(--border-width-default) solid var(--border2); color: var(--text); outline: none; }
.cpub-reglink-input:focus { background: var(--accent-bg); border-color: var(--accent); }
.cpub-reglink-input::placeholder { color: var(--text-faint); }
.cpub-reglink-variant-row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; }
.cpub-reglink-variant-options { display: inline-flex; border: var(--border-width-default) solid var(--border2); }
.cpub-reglink-variant-btn { padding: 4px 11px; background: transparent; border: none; border-right: var(--border-width-default) solid var(--border2); font-family: var(--font-mono); font-size: 11px; color: var(--text-dim); cursor: pointer; }
.cpub-reglink-variant-btn:last-child { border-right: none; }
.cpub-reglink-variant-btn:hover { background: var(--surface2); }
.cpub-reglink-variant-btn-active { background: var(--accent-bg); color: var(--accent); }
</style>
