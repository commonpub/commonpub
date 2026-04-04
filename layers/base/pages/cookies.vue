<script setup lang="ts">
const runtimeConfig = useRuntimeConfig();
const siteName = computed(() => (runtimeConfig.public.siteName as string) || 'CommonPub');

useSeoMeta({ title: `Cookie Policy — ${siteName.value}` });

const { cookies, consentLevel, acceptAll, acceptEssential, resetConsent, hasConsented } = useCookieConsent();

const essentialCookies = computed(() => cookies.value.filter((c) => c.category === 'essential'));
const functionalCookies = computed(() => cookies.value.filter((c) => c.category === 'functional'));
const analyticsCookies = computed(() => cookies.value.filter((c) => c.category === 'analytics'));
</script>

<template>
  <div class="cpub-legal">
    <div class="cpub-legal-header">
      <h1 class="cpub-legal-title">Cookie Policy</h1>
      <p class="cpub-legal-updated">Last updated: {{ new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}</p>
    </div>

    <div class="cpub-legal-body">
      <section class="cpub-legal-section">
        <h2>What are cookies?</h2>
        <p>Cookies are small text files stored on your device when you visit a website. They help the site remember your preferences and provide essential functionality.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>Your consent</h2>
        <p v-if="hasConsented">
          You have accepted <strong>{{ consentLevel === 'all' ? 'all cookies' : 'essential cookies only' }}</strong>.
          You can change this at any time.
        </p>
        <p v-else>You have not yet made a cookie choice.</p>
        <div class="cpub-cookie-consent-actions">
          <button class="cpub-btn cpub-btn-sm" @click="acceptEssential">Essential only</button>
          <button class="cpub-btn cpub-btn-sm cpub-btn-primary" @click="acceptAll">Accept all</button>
          <button v-if="hasConsented" class="cpub-btn cpub-btn-sm" @click="resetConsent">Reset choice</button>
        </div>
      </section>

      <!-- Essential Cookies -->
      <section class="cpub-legal-section">
        <h2>Essential cookies</h2>
        <p>These are strictly necessary for the site to function. They cannot be disabled.</p>
        <table class="cpub-cookie-table" v-if="essentialCookies.length > 0">
          <thead>
            <tr>
              <th>Cookie</th>
              <th>Purpose</th>
              <th>Duration</th>
              <th v-if="essentialCookies.some(c => c.provider)">Provider</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cookie in essentialCookies" :key="cookie.name">
              <td><code>{{ cookie.name }}</code></td>
              <td>{{ cookie.description }}</td>
              <td>{{ cookie.duration }}</td>
              <td v-if="essentialCookies.some(c => c.provider)">{{ cookie.provider ?? siteName }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Functional Cookies -->
      <section v-if="functionalCookies.length > 0" class="cpub-legal-section">
        <h2>Functional cookies</h2>
        <p>These remember your preferences (like dark mode) to improve your experience. They are set only with your consent.</p>
        <table class="cpub-cookie-table">
          <thead>
            <tr>
              <th>Cookie</th>
              <th>Purpose</th>
              <th>Duration</th>
              <th v-if="functionalCookies.some(c => c.provider)">Provider</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cookie in functionalCookies" :key="cookie.name">
              <td><code>{{ cookie.name }}</code></td>
              <td>{{ cookie.description }}</td>
              <td>{{ cookie.duration }}</td>
              <td v-if="functionalCookies.some(c => c.provider)">{{ cookie.provider ?? siteName }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Analytics Cookies -->
      <section v-if="analyticsCookies.length > 0" class="cpub-legal-section">
        <h2>Analytics cookies</h2>
        <p>These help the instance operator understand how the site is used. They are set only with your consent.</p>
        <table class="cpub-cookie-table">
          <thead>
            <tr>
              <th>Cookie</th>
              <th>Purpose</th>
              <th>Duration</th>
              <th>Provider</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cookie in analyticsCookies" :key="cookie.name">
              <td><code>{{ cookie.name }}</code></td>
              <td>{{ cookie.description }}</td>
              <td>{{ cookie.duration }}</td>
              <td>{{ cookie.provider ?? siteName }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="cpub-legal-section">
        <h2>Managing cookies</h2>
        <p>You can change your cookie preferences at any time using the buttons above or by clearing your browser cookies. Most browsers also allow you to control cookies through their settings.</p>
        <p>For more information about how we handle your data, see our <NuxtLink to="/privacy">Privacy Policy</NuxtLink>.</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.cpub-legal {
  max-width: 740px;
  margin: 0 auto;
  padding: var(--space-12) var(--space-6) var(--space-20);
}

.cpub-legal-header { margin-bottom: var(--space-10); }
.cpub-legal-title { font-size: var(--text-3xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-2); }
.cpub-legal-updated { font-size: var(--text-sm); color: var(--text-faint); }

.cpub-legal-section { margin-bottom: var(--space-8); }
.cpub-legal-section h2 { font-size: var(--text-lg); font-weight: var(--font-weight-bold); margin-bottom: var(--space-3); }
.cpub-legal-section p { font-size: var(--text-base); line-height: var(--leading-normal); color: var(--text-dim); margin-bottom: var(--space-3); }
.cpub-legal-section a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }

.cpub-cookie-consent-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.cpub-cookie-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
  border: var(--border-width-default) solid var(--border);
  margin-top: var(--space-3);
}

.cpub-cookie-table th,
.cpub-cookie-table td {
  padding: var(--space-2) var(--space-3);
  text-align: left;
  border-bottom: var(--border-width-default) solid var(--border2);
}

.cpub-cookie-table th {
  font-family: var(--font-mono);
  font-size: var(--text-label);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--text-faint);
  background: var(--surface2);
}

.cpub-cookie-table td {
  color: var(--text-dim);
  line-height: var(--leading-snug);
}

.cpub-cookie-table code {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--accent);
}

.cpub-cookie-table tr:last-child td { border-bottom: none; }

@media (max-width: 640px) {
  .cpub-legal { padding: var(--space-6) var(--space-4) var(--space-12); }
  .cpub-cookie-table { font-size: var(--text-xs); }
  .cpub-cookie-table th, .cpub-cookie-table td { padding: var(--space-1) var(--space-2); }
}
</style>
