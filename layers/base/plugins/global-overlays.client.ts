import { h, render, type VNode, type Component } from 'vue';
import CookieConsent from '../components/CookieConsent.vue';
import TermsReacceptanceGate from '../components/TermsReacceptanceGate.vue';

/**
 * Mount the app's GLOBAL overlays — the cookie-consent banner and the terms
 * re-acceptance gate — via a plugin instead of the layout (session 229). A thin
 * app that overrides `layouts/default.vue`/`app.vue` (e.g. deveco) silently drops
 * anything the LAYER mounts there; deveco lost both, so the terms block had no
 * escape and the cookie banner could never appear. Mounting here makes them
 * immune to layout overrides. Each vnode borrows the running app's context so the
 * components' composables / $fetch / <NuxtLink> resolve as if in the tree.
 * Client-only; idempotent per overlay (one host node each). Each overlay decides
 * its own visibility (cookie banner only when non-essential cookies exist; the
 * gate only when re-acceptance is required), so mounting them is inert otherwise.
 */
export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.server) return;
  const ctx = nuxtApp.vueApp._context;
  const mount = (id: string, component: Component): void => {
    if (document.getElementById(id)) return;
    const host = document.createElement('div');
    host.id = id;
    document.body.appendChild(host);
    const vnode: VNode = h(component);
    vnode.appContext = ctx;
    render(vnode, host);
  };
  nuxtApp.hook('app:mounted', () => {
    mount('cpub-cookie-consent-host', CookieConsent);
    mount('cpub-terms-gate-host', TermsReacceptanceGate);
  });
});
