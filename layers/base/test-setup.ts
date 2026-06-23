import '@testing-library/jest-dom/vitest';

// Provide Vue auto-imports that Nuxt normally handles
import { computed, ref, reactive, watch, watchEffect, onMounted, onUnmounted, nextTick, toRef, toRefs, unref, isRef } from 'vue';

// Make them available globally (matching Nuxt auto-import behavior)
Object.assign(globalThis, {
  computed, ref, reactive, watch, watchEffect,
  onMounted, onUnmounted, nextTick, toRef, toRefs, unref, isRef,
});

/* Phase 3c — PointerEvent shim for jsdom.
 *
 * jsdom (vitest's default DOM environment) ships MouseEvent + TouchEvent
 * but NOT PointerEvent. The resize handle's @pointerdown handler reads
 * `e.pointerType` + `e.pointerId`; tests dispatching `new PointerEvent(...)`
 * would crash with "PointerEvent is not defined" on every layer that
 * touches a resize gesture.
 *
 * The shim subclasses MouseEvent so all browser-realistic mouse-event
 * fields (clientX/Y, button, target, etc.) still work; we tack on the
 * pointer-specific fields handlers care about (pointerId, pointerType,
 * isPrimary). Only loaded in tests — production browsers have the real
 * constructor.
 */
if (typeof window !== 'undefined' && typeof (window as unknown as { PointerEvent?: unknown }).PointerEvent === 'undefined') {
  class PolyfillPointerEvent extends MouseEvent {
    public pointerId: number;
    public pointerType: string;
    public isPrimary: boolean;
    public width: number;
    public height: number;
    public pressure: number;
    public tangentialPressure: number;
    public tiltX: number;
    public tiltY: number;
    public twist: number;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? 'mouse';
      this.isPrimary = params.isPrimary ?? true;
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0;
      this.tangentialPressure = params.tangentialPressure ?? 0;
      this.tiltX = params.tiltX ?? 0;
      this.tiltY = params.tiltY ?? 0;
      this.twist = params.twist ?? 0;
    }
  }
  (window as unknown as { PointerEvent: typeof PolyfillPointerEvent }).PointerEvent = PolyfillPointerEvent;
  (globalThis as unknown as { PointerEvent: typeof PolyfillPointerEvent }).PointerEvent = PolyfillPointerEvent;
}

/* IntersectionObserver shim for jsdom.
 *
 * jsdom ships no IntersectionObserver, so any component that mounts a scroll-spy
 * (useScrollSpy: ProjectView, the docs viewer) would crash with "IntersectionObserver
 * is not defined" the moment it observes a heading. This no-op stub keeps those
 * mounts safe in tests that don't care about scroll-spy. Tests that DO exercise it
 * (useScrollSpy.test.ts) override this with a controllable mock via vi.stubGlobal.
 * Only loaded in tests — production browsers have the real constructor.
 */
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class NoopIntersectionObserver {
    constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] { return []; }
  }
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = NoopIntersectionObserver;
}
