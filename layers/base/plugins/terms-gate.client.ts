import { h, render, type VNode } from 'vue';
import TermsReacceptanceGate from '../components/TermsReacceptanceGate.vue';

/**
 * Mount the terms re-acceptance interstitial GLOBALLY, independent of the layout
 * (session 229). It used to live in the layer's `default.vue`, but a thin app that
 * OVERRIDES the default layout (e.g. deveco) silently dropped it — leaving
 * `requireTermsAcceptance` blocking every write with no way to re-accept. Mounting
 * via a plugin makes it immune to layout/app.vue overrides. The vnode borrows the
 * running app's context so the component's `useAuth`/`$fetch`/`<NuxtLink>` resolve
 * exactly as if it were in the tree. Client-only; idempotent (single host node).
 */
export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.server) return;
  nuxtApp.hook('app:mounted', () => {
    if (document.getElementById('cpub-terms-gate-host')) return;
    const host = document.createElement('div');
    host.id = 'cpub-terms-gate-host';
    document.body.appendChild(host);
    const vnode: VNode = h(TermsReacceptanceGate);
    vnode.appContext = nuxtApp.vueApp._context;
    render(vnode, host);
  });
});
