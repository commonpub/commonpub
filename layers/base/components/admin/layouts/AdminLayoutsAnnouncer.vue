<script setup lang="ts">
/**
 * <AdminLayoutsAnnouncer> — the visible-to-screen-readers, hidden-to-
 * sighted-users companion to `useLayoutAnnouncer`. Mirrors the
 * singleton `message` ref into a polite-no, ASSERTIVE live region so
 * the user hears drag/drop + Move Up/Down narration immediately.
 *
 * `aria-live="assertive"` (not "polite"): drag operations are
 * time-sensitive — a polite announcement gets queued behind whatever
 * the SR was already saying, which means the user makes a follow-up
 * decision (next arrow press) before hearing the previous result.
 * Assertive interrupts.
 *
 * `aria-atomic="true"` so the whole message is read on every change,
 * not just the diff. (Default false would read only the changed words,
 * which fragments narration like "moved" + "3 of 5" into pieces.)
 *
 * `role="status"` is the WCAG-recommended role for "informational
 * change" announcements; pair with aria-live. Some SRs (notably
 * NVDA + Firefox per the editor a11y memory's testing notes) need
 * BOTH the role + the live attribute.
 *
 * Mount this ONCE per editor page; the singleton design means
 * multiple instances would mirror identical content (harmless but
 * wasteful).
 */
import { useLayoutAnnouncer } from '../../../composables/useLayoutAnnouncer';

const { message } = useLayoutAnnouncer();
</script>

<template>
  <div
    role="status"
    aria-live="assertive"
    aria-atomic="true"
    class="cpub-sr-only"
  >{{ message }}</div>
</template>
