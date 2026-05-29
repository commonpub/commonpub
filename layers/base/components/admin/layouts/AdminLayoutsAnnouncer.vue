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
 * `role="status"` + explicit `aria-live="assertive"`: ARIA 1.2 defines
 * `role="status"` with an implicit `aria-live="polite"` default. Setting
 * `aria-live="assertive"` explicitly OVERRIDES the implicit polite —
 * valid combo per the ARIA spec ("Authors MAY override implicit
 * values"). The role+attribute pairing matters because some screen
 * readers (NVDA, JAWS) trigger different announcement queues based on
 * the explicit aria-live value, while others (VoiceOver) read the role
 * directly. Setting both reaches the union.
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
