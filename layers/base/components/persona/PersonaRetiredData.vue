<script setup lang="ts">
/**
 * `<PersonaRetiredData>` — "Data from removed fields".
 *
 * Registered as `<PersonaRetiredData>` by Nuxt's pathPrefix (the `persona`
 * directory prefix is deduplicated against the `Persona` filename prefix).
 *
 * When an operator removes a question from the persona schema and chooses to
 * RETAIN what people already answered, that data does not stop being theirs. It
 * has no label left to resolve, so it is shown under its RAW stored key: a
 * removed question with no label is invisible data, and invisible data cannot be
 * corrected (Art. 16) or erased (Art. 17). The per-field Delete is the erasure
 * control, and it is a plain button with no confirmation dialog, because
 * friction belongs on collection, never on deletion.
 *
 * Renders nothing at all when there is nothing retired. No empty scaffolding.
 */
import { computed, onMounted, ref } from 'vue';

/**
 * Mirrors `RetiredPersonaValues` from `@commonpub/server`. Declared structurally
 * here rather than imported because `@commonpub/server` is a server-only package
 * and pulling its types into a client component drags Drizzle into the browser
 * bundle's type graph. The property names are the wire contract of
 * `GET /api/persona`.
 *
 * NOT exported: `<script setup>` forbids ES exports, and a shared `.ts` file in
 * a Nuxt components directory is scanned as a component and breaks `typecheck`
 * on the missing default export. The caller's own server DTO type flows in
 * structurally, which is what makes the duplication safe: a rename on the server
 * side turns the page red, not this file.
 */
interface RetiredPersonaItem {
  fieldKey: string;
  values: string[];
  text: string | null;
  /** ISO timestamp, or null when the removal predates the record. */
  retiredAt: string | null;
}

const props = withDefaults(defineProps<{
  items: readonly RetiredPersonaItem[];
  /** The field key whose delete is in flight, so only that row's button spins. */
  deletingKey?: string | null;
  /** Keeps the heading id unique if a page ever renders two of these. */
  idPrefix?: string;
}>(), { deletingKey: null, idPrefix: 'cpub-persona-retired' });

const titleId = computed(() => `${props.idPrefix}-title`);

const emit = defineEmits<{
  (e: 'delete', fieldKey: string): void;
}>();

const visible = computed(() => props.items.length > 0);

/**
 * SSR TIMEZONE TRAP. `toLocaleDateString` resolves against the RENDERING
 * machine's zone, so a server in UTC and a reader in Tokyo produce different
 * text and hydration mismatches. It never reproduces in dev, where both share
 * one zone. The fix is the house one: render the raw ISO date on the server and
 * on the first client paint, then localise after mount, and keep the machine
 * readable value in `<time datetime>` either way.
 */
const mounted = ref(false);
onMounted(() => { mounted.value = true; });

function displayDate(iso: string): string {
  const day = iso.slice(0, 10);
  if (!mounted.value) return day;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? day : parsed.toLocaleDateString();
}

function joinedValues(item: RetiredPersonaItem): string {
  return item.values.join(', ');
}
</script>

<template>
  <section v-if="visible" class="cpub-persona-retired" :aria-labelledby="titleId">
    <h2 :id="titleId" class="cpub-persona-retired-title">Data from removed fields</h2>

    <p class="cpub-persona-retired-intro">
      This was collected under a question that is no longer part of this profile. You can delete it.
    </p>

    <ul class="cpub-persona-retired-list">
      <li v-for="item in items" :key="item.fieldKey" class="cpub-persona-retired-item">
        <div class="cpub-persona-retired-body">
          <!-- The raw key, verbatim. There is no label to resolve, and inventing
               one would misdescribe a legal record. -->
          <code class="cpub-persona-retired-key">{{ item.fieldKey }}</code>

          <p v-if="item.values.length > 0" class="cpub-persona-retired-value">{{ joinedValues(item) }}</p>
          <p v-if="item.text" class="cpub-persona-retired-value">{{ item.text }}</p>

          <p v-if="item.retiredAt" class="cpub-persona-retired-meta">
            Removed on <time :datetime="item.retiredAt">{{ displayDate(item.retiredAt) }}</time>
          </p>
        </div>

        <!-- Self-descriptive out of context: a screen-reader user pulling up a
             list of controls sees which stored answer each button deletes. -->
        <button
          type="button"
          class="cpub-btn cpub-btn-sm"
          :disabled="deletingKey === item.fieldKey"
          :aria-label="`Delete the saved answer for ${item.fieldKey}`"
          @click="emit('delete', item.fieldKey)"
        >{{ deletingKey === item.fieldKey ? 'Deleting...' : 'Delete' }}</button>
      </li>
    </ul>
  </section>
</template>
