<script setup lang="ts">
import { buildRegistrationHref, registrationLabel, registrationVariant } from '@commonpub/editor';

/**
 * Registration-link block (public view). Renders a call-to-action button that
 * links to the sign-up URL. Href safety + the default target live in the shared
 * `buildRegistrationHref` (the only guard — no server route validates blocks).
 */
const props = defineProps<{ content: Record<string, unknown> }>();

const href = computed(() => buildRegistrationHref(props.content));
const label = computed(() => registrationLabel(props.content));
const variant = computed(() => registrationVariant(props.content));
</script>

<template>
  <div class="cpub-block-reglink">
    <a
      class="cpub-reglink-cta"
      :class="`cpub-reglink-cta-${variant}`"
      :href="href"
      rel="nofollow"
    >
      <i class="fa-solid fa-user-plus" aria-hidden="true"></i>
      <span>{{ label }}</span>
    </a>
  </div>
</template>

<style scoped>
.cpub-block-reglink {
  display: flex;
  justify-content: center;
  margin: 24px auto;
}
.cpub-reglink-cta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 28px;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-decoration: none;
  border: var(--border-width-thick) solid var(--accent);
  box-shadow: var(--shadow-sm);
  transition: transform 0.08s ease, box-shadow 0.08s ease;
  border-radius: 0;
}
.cpub-reglink-cta-primary {
  background: var(--accent);
  color: var(--color-text-inverse);
}
.cpub-reglink-cta-secondary {
  background: var(--surface);
  color: var(--accent-text);
}
.cpub-reglink-cta:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--shadow-md);
}
.cpub-reglink-cta:focus-visible {
  outline: var(--border-width-thick) solid var(--accent-text);
  outline-offset: 2px;
}
.cpub-reglink-cta i { font-size: 0.9em; }
</style>
