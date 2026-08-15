<script setup lang="ts">
/**
 * `<PersonaChipGrid>` — one `multiselect` persona field as a grid of real
 * checkboxes.
 *
 * NAMING: this file is `components/persona/PersonaChipGrid.vue`, so Nuxt's
 * pathPrefix registers it as `<PersonaChipGrid>` (the `Persona` directory
 * prefix is deduplicated against the filename, exactly as
 * `components/admin/theme/AdminThemeFamilyCard.vue` becomes
 * `<AdminThemeFamilyCard>`). A bare `<ChipGrid>` would render EMPTY with no
 * error and no test failure, which this repo has been bitten by twice. Inside
 * the persona tree everything is imported by path anyway, so the prefix only
 * has to be right for pages outside it.
 *
 * WHY REAL CHECKBOXES. A `<fieldset>` with a `<legend>` and real
 * `<input type="checkbox">` elements gives keyboard operation, assistive-tech
 * semantics, form participation and the browser's own checked rendering for
 * free. The rejected alternative was `role="listbox"` with `aria-selected` on
 * divs: `aria-selected` is only valid on an element with an `option`, `tab`,
 * `row`, `gridcell`, `treeitem` or `columnheader` role, none of which a chip
 * would have, so the state would be announced by nothing at all.
 *
 * `role="group"` is stated explicitly even though `<fieldset>` already has it
 * implicitly: the explicit role is what stops a later refactor to a `<div>`
 * from silently dropping the grouping.
 *
 * NOT COLOUR-ALONE (WCAG 1.4.1). Selection shows up three ways: the checkbox's
 * own checked state, a 2px border colour change, and a background token. Turn
 * the page greyscale and the checkbox still says which chips are on.
 */
import { computed } from 'vue';
import type { PersonaField } from '@commonpub/persona';

const props = withDefaults(defineProps<{
  field: PersonaField;
  /**
   * Unique id prefix so two grids on one page (or an editor beside its preview)
   * do not collide on `id`/`for`.
   */
  idPrefix?: string;
  /** Whole-grid disable, e.g. while the section's save is in flight. */
  disabled?: boolean;
}>(), { idPrefix: 'cpub-persona', disabled: false });

/**
 * The selected option values. Always replaced with a new array, never mutated
 * in place, so a parent holding the previous value for dirty-tracking keeps a
 * usable baseline.
 */
const model = defineModel<string[]>({ default: () => [] });

const options = computed(() => props.field.options ?? []);
const fieldId = computed(() => `${props.idPrefix}-${props.field.key}`);
const helpId = computed(() => (props.field.help ? `${fieldId.value}-help` : undefined));
const statusId = computed(() => `${fieldId.value}-status`);

const selected = computed<Set<string>>(() => new Set(model.value ?? []));
const count = computed(() => selected.value.size);

/** `undefined` when the operator set no cap: an uncapped grid never disables. */
const max = computed<number | undefined>(() =>
  typeof props.field.maxSelections === 'number' && props.field.maxSelections > 0
    ? props.field.maxSelections
    : undefined);

const atCap = computed(() => max.value !== undefined && count.value >= max.value);

/**
 * The polite announcement. Rendered into an element that is ALWAYS in the DOM
 * (empty until there is something to say) because a live region created in the
 * same tick as its content is dropped by several screen readers.
 *
 * A click that silently does nothing is worse than a disabled control that
 * explains itself, which is the whole reason the cap message exists.
 */
const statusText = computed<string>(() => {
  if (max.value === undefined) {
    return count.value === 0 ? '' : `${count.value} selected.`;
  }
  const base = `${count.value} of ${max.value} selected.`;
  return atCap.value ? `${base} Clear one to choose another.` : base;
});

function isSelected(value: string): boolean {
  return selected.value.has(value);
}

/** An unchecked box is disabled at the cap; a checked one never is, or the cap would be a trap. */
function isDisabled(value: string): boolean {
  return props.disabled || (atCap.value && !isSelected(value));
}

function toggle(value: string, on: boolean): void {
  const next = (model.value ?? []).filter((v) => v !== value);
  if (on) {
    if (atCap.value) return;
    // Preserve the operator's option order rather than click order, so two users
    // who picked the same set store the same array.
    const order = options.value.map((o) => o.value);
    next.push(value);
    next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }
  model.value = next;
}
</script>

<template>
  <fieldset
    class="cpub-chip-fieldset"
    role="group"
    :aria-describedby="[helpId, statusId].filter(Boolean).join(' ') || undefined"
  >
    <legend class="cpub-chip-legend">{{ field.label }}</legend>

    <p v-if="field.help" :id="helpId" class="cpub-chip-help">{{ field.help }}</p>

    <div class="cpub-chip-grid">
      <label
        v-for="o in options"
        :key="o.value"
        class="cpub-chip"
        :class="{
          'cpub-chip--selected': isSelected(o.value),
          'cpub-chip--disabled': isDisabled(o.value),
        }"
      >
        <input
          class="cpub-chip-input"
          type="checkbox"
          :name="fieldId"
          :value="o.value"
          :checked="isSelected(o.value)"
          :disabled="isDisabled(o.value)"
          @change="toggle(o.value, ($event.target as HTMLInputElement).checked)"
        />
        <span class="cpub-chip-text">{{ o.label }}</span>
      </label>
    </div>

    <!-- role=status carries an implicit polite live region (ARIA 1.2), which is
         the house convention here: an explicit aria-live would be redundant, and
         aria-live="assertive" would interrupt a screen reader mid-sentence for a
         checkbox. -->
    <p :id="statusId" class="cpub-chip-status" role="status">{{ statusText }}</p>
  </fieldset>
</template>
