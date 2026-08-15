<script setup lang="ts">
/**
 * `<PersonaCompletenessMeter>` — how much of the persona is filled in.
 *
 * Registered as `<PersonaCompletenessMeter>` by Nuxt's pathPrefix (the `persona`
 * directory prefix is deduplicated against the `Persona` filename prefix).
 *
 * NEVER SEEDED TO `ref(0)`. There is no local state in this component at all:
 * the numbers are derived from the `completeness` prop, which the page hands
 * over from its SSR payload. A client-only `ref(0)` would put "0 of 9 sections
 * filled in" into the first paint and into the HTML a crawler reads, which is a
 * false statement about a real person, not merely a hydration warning. That
 * exact pattern shipped "0 makers registered" in session 253.
 *
 * When the data genuinely is not there yet (the page chose to fetch it
 * client-side), the prop is `null` and this renders a skeleton carrying
 * `aria-busy="true"` and NO number.
 *
 * NO SCORE, NO STREAK, NO LEADERBOARD, NO RED STATE, NO DECAY, and no
 * percentage shaming. The meter is neutral by design: a `role="progressbar"`
 * with a text equivalent and one honest line saying the whole thing is
 * optional. `personaCompleteness` takes no consent argument in any position, so
 * this number provably cannot move when someone flips a sharing toggle.
 */
import { computed } from 'vue';
import type { PersonaCompleteness } from '@commonpub/persona';

const props = withDefaults(defineProps<{
  /**
   * The SSR'd completeness DTO, straight from `personaCompleteness()` on the
   * server. `null` means "not resolved yet"; it never means "zero".
   */
  completeness?: PersonaCompleteness | null;
  /** Accessible name, so two meters on one page are distinguishable. */
  label?: string;
}>(), { completeness: null, label: 'Profile completeness' });

const ready = computed(() => props.completeness != null);

/**
 * Sections, not fields, is what the text equivalent counts, because that is the
 * unit the editor is divided into and the unit the reader can act on.
 *
 * The visible wording says "parts of your profile" rather than "sections", and
 * that is not a synonym chosen for variety. This figure spans every profile tab,
 * so a section the About-you tab draws as "0 of 1" can legitimately be counted
 * here as filled by a name typed during registration. Calling both of them
 * "sections" put two true numbers about different sets on one screen under one
 * word, which reads as a bug. Naming the wider set differently is what makes the
 * page consistent; the count itself was never wrong.
 */
const totalSections = computed(() => props.completeness?.perSection.length ?? 0);
const filledSections = computed(
  () => props.completeness?.perSection.filter((s) => s.filled).length ?? 0,
);

/** Bar width only. The announced value is the section count, not this. */
const percent = computed(() =>
  totalSections.value === 0
    ? 0
    : Math.round((filledSections.value / totalSections.value) * 100),
);

const summary = computed(
  () => `${filledSections.value} of ${totalSections.value} parts of your profile filled in`,
);

</script>

<template>
  <div class="cpub-persona-meter">
    <template v-if="ready">
      <!-- aria-valuenow counts SECTIONS, matching the visible text exactly, so a
           screen reader and a sighted reader are told the same thing. A percent
           here would announce a number that appears nowhere on screen. -->
      <div
        class="cpub-persona-meter-track"
        role="progressbar"
        :aria-label="label"
        :aria-valuenow="filledSections"
        aria-valuemin="0"
        :aria-valuemax="totalSections"
        :aria-valuetext="summary"
      >
        <div class="cpub-persona-meter-fill" :style="{ width: `${percent}%` }"></div>
      </div>

      <p class="cpub-persona-meter-text">{{ summary }}</p>

      <!-- The one honest line. Not "complete your profile", not a nudge.
           It no longer says "what you want people to see": after the
           `showOnProfile` inversion no built-in field is on the profile at all,
           and the page carrying this meter says so two paragraphs above. The
           sentence promised a visibility the feature had stopped providing.
           The "Nothing here yet" empty state deliberately does NOT live here:
           `pages/settings/persona.vue` renders it above the sections, which is
           where a reader looks for it, and printing it in both places would put
           the same sentence on screen twice. -->
      <p class="cpub-persona-meter-note">This is all optional. Answer what you want and leave the rest.</p>
    </template>

    <!-- Not resolved: a shape, never a number. An INDETERMINATE progressbar
         (role, no aria-valuenow) rather than a bare div, because aria-label on
         a roleless element is prohibited and would be dropped by the browser
         and flagged by axe. -->
    <template v-else>
      <div
        class="cpub-persona-meter-skeleton"
        role="progressbar"
        aria-busy="true"
        :aria-label="label"
      ></div>
      <p class="cpub-persona-meter-note">This is all optional. Answer what you want and leave the rest.</p>
    </template>
  </div>
</template>
