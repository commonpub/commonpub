import '@testing-library/jest-dom/vitest';

// Provide Vue auto-imports that Nuxt normally handles
import { computed, ref, reactive, watch, watchEffect, onMounted, onUnmounted, nextTick, toRef, toRefs, unref, isRef } from 'vue';

// Make them available globally (matching Nuxt auto-import behavior)
Object.assign(globalThis, {
  computed, ref, reactive, watch, watchEffect,
  onMounted, onUnmounted, nextTick, toRef, toRefs, unref, isRef,
});
