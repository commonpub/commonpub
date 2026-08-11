<script setup lang="ts">
import { analyticsSpec } from '@commonpub/config/analytics';
import type { AnalyticsConfig } from '@commonpub/config/analytics';
useSeoMeta({
  title: `Privacy Policy, ${useSiteName()}`,
  description: 'How we collect, use, and protect your personal data.',
});

const siteName = useSiteName();
const { federation: federationEnabled, analytics: analyticsEnabled } = useFeatures();

// What this instance actually measures, derived from the configured provider so
// the page cannot claim something the code does not do (in either direction).
const runtimeConfig = useRuntimeConfig();
const analytics = computed(() =>
  analyticsEnabled.value
    ? analyticsSpec(runtimeConfig.public.analytics as AnalyticsConfig | undefined)
    : null,
);

// Section numbers are DERIVED, not hand-written. Two sections are conditional,
// and the numbering was previously a chain of `federationEnabled ? '7' : '6'`
// ternaries that every later heading had to repeat: adding one more conditional
// section would have meant editing all of them and getting it right by hand.
const sectionKeys = computed(() => [
  'who', 'data', 'use', 'basis', 'cookies',
  ...(analytics.value ? ['analytics'] : []),
  ...(federationEnabled.value ? ['federation'] : []),
  'third-party', 'retention', 'rights', 'contact',
]);
function n(key: string): number {
  return sectionKeys.value.indexOf(key) + 1;
}

// Deep-links into the source that implements the behaviour this page claims.
// A privacy policy on an open-source product can be checked rather than
// trusted, which is worth more than another paragraph of assurance.
const SOURCE_BASE = 'https://github.com/commonpub/commonpub/blob/main';
</script>

<template>
  <div class="cpub-legal">
    <div class="cpub-legal-header">
      <h1 class="cpub-legal-title">Privacy Policy</h1>
      <p class="cpub-legal-updated">Last updated: April 2026</p>
    </div>

    <div class="cpub-legal-body">
      <section class="cpub-legal-section">
        <h2>{{ n('who') }}. Who We Are</h2>
        <p>
          This {{ siteName }} instance is operated by its administrator (the "data controller").
          {{ siteName }} is powered by <a href="https://commonpub.io" target="_blank" rel="noopener">CommonPub</a>,
          an open-source, self-hosted platform. Each instance is independently operated and responsible for its own data processing.
        </p>
      </section>

      <section class="cpub-legal-section">
        <h2>{{ n('data') }}. What Data We Collect</h2>
        <p>When you create an account, we collect:</p>
        <ul>
          <li><strong>Account data:</strong> email address, username, password (stored as a secure hash)</li>
          <li><strong>Profile data:</strong> display name, bio, headline, location, website, avatar, banner image, social links, skills, pronouns, timezone (all optional)</li>
          <li><strong>Content:</strong> projects, articles, comments, and other content you create</li>
          <li><strong>Activity data:</strong> likes, follows, bookmarks, hub memberships, learning path enrollments</li>
          <li><strong>Messages:</strong> direct messages you send to other users on this instance</li>
        </ul>
        <p>We also automatically collect:</p>
        <ul>
          <li><strong>Session data:</strong> IP address and browser user agent when you log in, stored for the duration of your session (up to 7 days)</li>
          <li><strong>Theme preference:</strong> your light/dark mode choice, stored in your browser's local storage</li>
        </ul>
      </section>

      <section class="cpub-legal-section">
        <h2>{{ n('use') }}. How We Use Your Data</h2>
        <ul>
          <li><strong>Providing the service:</strong> displaying your profile, publishing your content, delivering notifications</li>
          <li><strong>Authentication:</strong> verifying your identity when you log in</li>
          <li><strong>Security:</strong> protecting against unauthorized access, abuse, and spam</li>
          <li><strong>Email notifications:</strong> sending notification digests and alerts you've opted into (configurable in settings)</li>
        </ul>
      </section>

      <section class="cpub-legal-section">
        <h2>{{ n('basis') }}. Legal Basis for Processing</h2>
        <p>We process your data under the following legal bases (GDPR Article 6):</p>
        <ul>
          <li><strong>Contract performance (Art. 6(1)(b)):</strong> processing necessary to provide you with the service you signed up for</li>
          <li><strong>Legitimate interest (Art. 6(1)(f)):</strong> session security, rate limiting, and preventing abuse</li>
        </ul>
      </section>

      <section class="cpub-legal-section">
        <h2>{{ n('cookies') }}. Cookies</h2>
        <p>We use a small number of cookies to provide and improve the service:</p>
        <ul>
          <li><strong>Session cookie</strong> (<code>better-auth.session_token</code>): strictly necessary, authenticates your login session. HttpOnly, secure, 7-day expiry.</li>
          <li><strong>Consent cookie</strong> (<code>cpub-consent</code>): strictly necessary, stores your cookie consent choice.</li>
          <li><strong>Color scheme</strong> (<code>cpub-color-scheme</code>): strictly necessary preference, remembers your light/dark mode choice. Set only when you use the theme toggle. No identifier, no tracking.</li>
        </ul>
        <p v-if="analytics">We use analytics cookies, described in section {{ n('analytics') }} below. They are set only if you accept them, and never for advertising. For the full list of cookies and to change your choice, see our <NuxtLink to="/cookies">Cookie Policy</NuxtLink>.</p>
        <p v-else>We do not use any advertising or tracking cookies. For the full list of cookies and to manage your preferences, see our <NuxtLink to="/cookies">Cookie Policy</NuxtLink>.</p>
      </section>

      <section v-if="analytics" class="cpub-legal-section">
        <h2>{{ n('analytics') }}. Analytics</h2>
        <p>We use <strong>{{ analytics.label }}</strong> to understand how this site is used, so we can see which pages people find and which ones they cannot. It runs only if you choose "Accept all" in the cookie banner. If you choose "Essential only", or ignore the banner, nothing is loaded and no analytics cookies are set.</p>

        <h3>What is collected</h3>
        <ul>
          <li>The pages you visit on this site, and the order you visit them in</li>
          <li>The site or search engine that referred you here, if any</li>
          <li>Approximate location, derived from your IP address and no more precise than a city</li>
          <li>Device type, screen size, browser and operating system</li>
          <li>A randomly generated id stored in a cookie, so a repeat visit is not counted as a new person</li>
        </ul>

        <h3>What is not collected</h3>
        <ul>
          <li>Your name, email address, or anything else from your account. We never send account data to {{ analytics.processor }}, so analytics cannot be linked back to who you are on this site.</li>
          <li>Your full IP address. It is used to derive an approximate location and is not stored by us.</li>
          <li>Anything you type into a form, and anything on a page you need to be logged in to see.</li>
          <li>We run no advertising, we do not track you across other websites, and we do not sell or share this data with anyone beyond the processor named below.</li>
        </ul>

        <h3>Who processes it, and where</h3>
        <p>{{ analytics.processor }} acts as our processor and may process this data outside your country, including in the United States. Their handling is governed by the <a :href="analytics.policyUrl" target="_blank" rel="noopener">{{ analytics.processor }} privacy policy</a>. Our legal basis is your consent (Art. 6(1)(a)), which you can withdraw at any time from the <NuxtLink to="/cookies">Cookie Policy</NuxtLink> page. Withdrawing stops any further collection.</p>

        <h3>Checking this for yourself</h3>
        <p>This site runs on CommonPub, which is open source, so you do not have to take our word for any of the above. The code that loads analytics, including the rule that nothing loads before you accept, is
          <a :href="`${SOURCE_BASE}/layers/base/plugins/analytics.client.ts`" target="_blank" rel="noopener">plugins/analytics.client.ts</a>,
          and the full list of what each provider is allowed to contact and which cookies it sets is
          <a :href="`${SOURCE_BASE}/packages/config/src/analytics.ts`" target="_blank" rel="noopener">packages/config/src/analytics.ts</a>.
          You can also confirm it in your own browser: open developer tools and check that no request to {{ analytics.processor }} is made until you accept.</p>
      </section>

      <section v-if="federationEnabled" class="cpub-legal-section">
        <h2>{{ n('federation') }}. Federation and ActivityPub</h2>
        <p>This instance participates in the <a href="https://activitypub.rocks" target="_blank" rel="noopener">ActivityPub</a> federation protocol. When you publish content or interact publicly, the following data may be shared with remote instances:</p>
        <ul>
          <li>Your username, display name, avatar, and bio</li>
          <li>Your published content (projects, articles, explainers)</li>
          <li>Your public interactions (likes, follows, comments on federated content)</li>
        </ul>
        <p>Your email address, location, social links, timezone, and other private profile fields are <strong>never</strong> shared via federation.</p>
        <p><strong>Important:</strong> Once your data is federated to remote instances, this instance cannot guarantee its deletion on those servers. Remote instances operate independently and may retain cached copies of your public data even after you delete your account here.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>{{ n('third-party') }}. Third-Party Services</h2>
        <p>We load icon fonts from <strong>Font Awesome</strong> via the Cloudflare CDN (<code>cdnjs.cloudflare.com</code>). This means your browser makes requests to Cloudflare's servers, which are subject to <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">Cloudflare's privacy policy</a>.</p>
        <p v-if="analytics">We use {{ analytics.label }} for visitor analytics, described in section {{ n('analytics') }}. We do not use advertising networks, and we do not track you across other websites.</p>
        <p v-else>We do not use any analytics services, advertising networks, or tracking technologies.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>{{ n('retention') }}. Data Retention</h2>
        <ul>
          <li><strong>Account data:</strong> retained until you delete your account</li>
          <li><strong>Session data:</strong> automatically expires after 7 days of inactivity</li>
          <li><strong>Content:</strong> retained until you delete it or delete your account</li>
          <li><strong>Audit logs:</strong> retained per the instance operator's policy</li>
        </ul>
      </section>

      <section class="cpub-legal-section">
        <h2>{{ n('rights') }}. Your Rights</h2>
        <p>Under the GDPR and similar data protection laws, you have the right to:</p>
        <ul>
          <li><strong>Access:</strong> view the data we hold about you (via your profile and settings)</li>
          <li><strong>Rectification:</strong> update or correct your data (via your profile settings)</li>
          <li><strong>Erasure:</strong> delete your account and all associated data (via account settings)</li>
          <li><strong>Portability:</strong> download your data in a machine-readable format (via account settings)</li>
          <li><strong>Restriction and objection:</strong> contact the instance administrator</li>
        </ul>
        <p>To exercise these rights, visit your <NuxtLink to="/settings/account">account settings</NuxtLink> or contact the instance administrator.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>{{ n('contact') }}. Contact</h2>
        <p>For privacy-related inquiries, contact the administrator of this {{ siteName }} instance.</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.cpub-legal {
  max-width: 740px;
  margin: 0 auto;
  padding: 48px 24px 80px;
}

.cpub-legal-header {
  margin-bottom: 40px;
}

.cpub-legal-title {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
}

.cpub-legal-updated {
  font-size: 12px;
  color: var(--text-faint);
  font-family: var(--font-mono);
}

.cpub-legal-body {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.cpub-legal-section h2 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

/* Sub-headings inside a section. The analytics disclosure is long enough that
   one wall of prose would not be read; breaking it into what-is / what-is-not /
   who / how-to-check is the point of the section. */
.cpub-legal-section h3 {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-family: var(--font-mono);
  color: var(--text);
  margin: 20px 0 8px;
}
.cpub-legal-section h3:first-of-type {
  margin-top: 16px;
}

.cpub-legal-section p {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-dim);
  margin-bottom: 8px;
}

.cpub-legal-section ul {
  padding-left: 20px;
  margin: 8px 0;
}

.cpub-legal-section li {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-dim);
  margin-bottom: 4px;
}

.cpub-legal-section strong {
  color: var(--text);
}

.cpub-legal-section code {
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 1px 5px;
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border);
}

.cpub-legal-section a {
  color: var(--accent);
  text-decoration: none;
}

.cpub-legal-section a:hover {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .cpub-legal {
    padding: 24px 16px 60px;
  }
  .cpub-legal-title {
    font-size: 22px;
  }
}
</style>
