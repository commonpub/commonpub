<script setup lang="ts">
/**
 * <AdminLayoutsAnnouncer> — the visible-to-screen-readers, hidden-to-
 * sighted-users companion to `useLayoutAnnouncer`. Mirrors the
 * singleton refs into TWO live regions: one ASSERTIVE for drag/drop +
 * Move Up/Down (time-critical), one POLITE for undo/redo (informational).
 *
 * Why two regions? The assertive region INTERRUPTS whatever the SR was
 * announcing, which is right for drag — the user's next arrow press
 * lands on the new state, so they need the prior result NOW. But undo
 * is the user telling the editor what to do; the editor's
 * acknowledgement shouldn't interrupt — it should queue politely. ARIA
 * 1.2 explicitly supports this kind of dual-channel design (a single
 * page can have multiple live regions).
 *
 * Each region carries its own `role` + `aria-live` pairing:
 *   - assertive: `role="status"` + explicit `aria-live="assertive"`.
 *     ARIA 1.2 defines status's implicit aria-live as "polite"; the
 *     explicit attribute overrides per the spec ("Authors MAY override
 *     implicit values"). The pair reaches both screen reader families
 *     (NVDA/JAWS read the explicit aria-live; VoiceOver reads the role).
 *   - polite: `role="status"` with no explicit aria-live, so the
 *     implicit "polite" applies. Cleaner than `aria-live="polite"` on
 *     `role="status"` (redundant by spec).
 *
 * `aria-atomic="true"` on BOTH so the whole message is read on change,
 * not just the diff — drag narration like "moved" + "3 of 5" needs to
 * land as one phrase, and undo's "Undid: <label>" needs the label.
 *
 * Mount this ONCE per editor page; the singleton design means
 * multiple instances would mirror identical content (harmless but
 * wasteful).
 */
import { useLayoutAnnouncer } from '../../../composables/useLayoutAnnouncer';

const { message, politeMessage } = useLayoutAnnouncer();
</script>

<template>
  <!-- Assertive: drag/drop + Move Up/Down state changes. -->
  <div
    role="status"
    aria-live="assertive"
    aria-atomic="true"
    class="cpub-sr-only"
  >{{ message }}</div>
  <!-- Polite: undo/redo + non-time-critical confirmations. -->
  <div
    role="status"
    aria-atomic="true"
    class="cpub-sr-only"
  >{{ politeMessage }}</div>
</template>
