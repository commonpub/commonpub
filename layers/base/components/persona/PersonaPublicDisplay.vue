<script setup lang="ts">
/**
 * `<PersonaPublicDisplay>` — one member's persona answers, as a visitor sees
 * them on `/u/:username` (plan section 8.5).
 *
 * NAMING: this file is `components/persona/PersonaPublicDisplay.vue`, so Nuxt's
 * pathPrefix registers it as `<PersonaPublicDisplay>` (the `persona` directory
 * prefix is deduplicated against the `Persona` filename prefix). A bare
 * `<PublicDisplay>` renders EMPTY with no error and no test failure, which is
 * why the mounting page uses the full name.
 *
 * READ-ONLY, AND STRUCTURALLY SO. The chips here are `<span>`s, not checkboxes
 * and not links: a visitor cannot toggle another person's answer, and a chip
 * that looks clickable but is not is a worse lie than a plain label. The editor's
 * `<PersonaChipGrid>` is the interactive one and stays that way.
 *
 * RENDERS NOTHING WHEN THERE IS NOTHING. A visitor looking at a profile with no
 * persona answers sees no heading, no empty box and no "this person has not
 * filled anything in": an empty state on someone else's profile is pressure
 * applied to the wrong person, by a stranger. The owner is the one exception and
 * gets a single quiet line pointing at their own editor.
 *
 * THERE IS NO `:href` IN THIS COMPONENT, AND THAT IS THE POINT. Persona `link`
 * fields live in `users.social_links` and the profile hero already renders them
 * as its icon row, so `GET /api/users/:username/persona` excludes them and no
 * URL from that column ever reaches this template. That is strictly stronger
 * than sanitising one here: `social_links` holds rows written long before the
 * current URL validators, and a `javascript:` value there is stored XSS on click
 * (this repo has shipped exactly that twice). If links are ever re-added to the
 * payload, this component needs `safeHref` on every `:href` before it renders one.
 */
import { computed } from 'vue';

/**
 * Mirrors `PublicPersonaField` / `PublicPersonaSection` from
 * `server/api/users/[username]/persona.get.ts`. Declared structurally rather
 * than imported because a Nitro route module cannot be pulled into a client
 * bundle; the page that mounts this component imports the route's own types, so
 * a rename on the server turns the PAGE red rather than silently drifting here.
 *
 * NOT exported: `<script setup>` forbids ES exports.
 */
interface PublicPersonaFieldItem {
  key: string;
  label: string;
  /** Resolved server-side, so this component performs no schema resolution. */
  display: 'chips' | 'text';
  values: string[];
}

interface PublicPersonaSectionItem {
  key: string;
  label: string;
  fields: PublicPersonaFieldItem[];
}

const props = withDefaults(defineProps<{
  sections: readonly PublicPersonaSectionItem[];
  /** True when the viewer is the person this profile belongs to. */
  isOwner?: boolean;
  /** Keeps heading ids unique if a page ever renders two of these. */
  idPrefix?: string;
}>(), { isOwner: false, idPrefix: 'cpub-persona-public' });

/** Only sections that carry at least one field with at least one value. */
const visibleSections = computed<PublicPersonaSectionItem[]>(() =>
  props.sections.filter((s) => s.fields.some((f) => f.values.length > 0)),
);

const hasAnswers = computed(() => visibleSections.value.length > 0);

/** The owner, and only the owner, is told where to go when there is nothing here. */
const showOwnerPrompt = computed(() => !hasAnswers.value && props.isOwner);

function sectionTitleId(key: string): string {
  return `${props.idPrefix}-${key}`;
}
</script>

<template>
  <div v-if="hasAnswers" class="cpub-persona-public">
    <section
      v-for="section in visibleSections"
      :key="section.key"
      class="cpub-persona-public-section"
      :aria-labelledby="sectionTitleId(section.key)"
    >
      <div class="cpub-sec-head">
        <h2 :id="sectionTitleId(section.key)">
          <i class="fa-solid fa-id-card" aria-hidden="true"></i>
          {{ section.label }}
        </h2>
      </div>

      <dl class="cpub-persona-public-list">
        <template v-for="field in section.fields" :key="field.key">
          <div v-if="field.values.length > 0" class="cpub-persona-public-field">
            <dt class="cpub-persona-public-label">{{ field.label }}</dt>
            <dd class="cpub-persona-public-value">
              <!-- Non-interactive by construction: spans, not inputs and not
                   anchors. A visitor cannot change another person's answer. -->
              <div v-if="field.display === 'chips'" class="cpub-tag-row">
                <span v-for="value in field.values" :key="value" class="cpub-tag">{{ value }}</span>
              </div>

              <p v-else class="cpub-persona-public-text">{{ field.values.join(', ') }}</p>
            </dd>
          </div>
        </template>
      </dl>
    </section>
  </div>

  <!-- The one owner-only line. No count, no meter, no percentage: this is a
       pointer, not a scoreboard. -->
  <p v-else-if="showOwnerPrompt" class="cpub-persona-public-owner-note">
    You have not filled in your profile details yet.
    <NuxtLink to="/settings/persona">Add your interests and tech stack</NuxtLink>.
  </p>
</template>

<style scoped>
/* No colour, no font family and no radius here: the tokens in
   `packages/ui/theme/components.css` own all three, and `.cpub-tag`,
   `.cpub-tag-row` and `.cpub-sec-head` are global rules from that file. This
   block is layout only. */
.cpub-persona-public-section {
  margin-bottom: var(--space-6, 32px);
}

.cpub-persona-public-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
  margin: 0;
}

.cpub-persona-public-label {
  font-family: var(--font-mono);
  font-size: var(--text-xs, 12px);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-bottom: var(--space-1, 4px);
}

.cpub-persona-public-value {
  margin: 0;
  font-size: var(--text-sm, 14px);
  color: var(--text);
  line-height: 1.7;
}

.cpub-persona-public-text {
  margin: 0;
  /* Author-supplied free text: a single unbroken token must wrap rather than
     push the profile page sideways at 390px. */
  overflow-wrap: anywhere;
}

.cpub-persona-public-owner-note {
  font-size: var(--text-sm, 14px);
  color: var(--text-dim);
  margin: 0 0 var(--space-6, 32px);
}
</style>
