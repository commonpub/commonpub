<script setup lang="ts">
import { analyticsSpec } from '@commonpub/config/analytics';
import type { AnalyticsConfig } from '@commonpub/config/analytics';
import { PROCESSING_PURPOSES, PROCESSING_PURPOSE_SPECS } from '@commonpub/persona';
import type { ProcessingPurposeId } from '@commonpub/persona';
useSeoMeta({
  title: `Privacy Policy, ${useSiteName()}`,
  description: 'How we collect, use, and protect your personal data.',
});

const siteName = useSiteName();
const {
  federation: federationEnabled,
  analytics: analyticsEnabled,
  dataSharingConsents: sharingEnabled,
} = useFeatures();

// What this instance actually measures, derived from the configured provider so
// the page cannot claim something the code does not do (in either direction).
const runtimeConfig = useRuntimeConfig();
const analytics = computed(() =>
  analyticsEnabled.value
    ? analyticsSpec(runtimeConfig.public.analytics as AnalyticsConfig | undefined)
    : null,
);

/*
 * The sharing choices, RENDERED FROM THE PURPOSE REGISTRY rather than restated.
 *
 * This closes an audit finding: the cookie banner and `/cookies` both link
 * across to Privacy settings, and `/settings/privacy` renders every sentence of
 * consent copy from `@commonpub/persona`, but this page (the one a person reads
 * BEFORE signing up, and the one Art. 13 is actually about) never described the
 * purposes at all. Paraphrasing them here would have created a second copy that
 * drifts from the one members act on, which is precisely what the registry
 * exists to prevent, so nothing below is written in this file.
 *
 * WHAT IS DELIBERATELY NOT RENDERED HERE, and why. `onSummaryTemplate` is a
 * TEMPLATE, not a sentence: `profile_analytics` names the operator's
 * k-anonymity floor, and only the server can resolve it (it lives in
 * `dataSharing.minBucket`, which is not in the public runtime config). A page
 * that substituted a plausible default would state "at least five people" on an
 * instance whose SQL floor is 25, understating a member's own protection by
 * five times, which is the exact defect `renderPurposeOnSummary` was introduced
 * to prevent. So a template carrying a token is not rendered as prose at all;
 * the resolved sentence is shown beside the switch on `/settings/privacy`,
 * where the server renders it, and this page says so. A test asserts no
 * `{token}` ever reaches the DOM.
 *
 * Likewise this page names no RECIPIENTS. Which parties are declared, and which
 * of these choices are therefore offered at all, is instance state resolved
 * server-side (`purposeIsOfferable` over `dataSharing.recipients`), and there is
 * no unauthenticated payload carrying it. Naming a party this instance has not
 * declared would be worse than pointing at the surface that lists them, which is
 * what the lead paragraph does.
 */
const FLOOR_TOKEN = /\{[a-zA-Z]+\}/;

interface PolicyPurpose {
  id: ProcessingPurposeId;
  label: string;
  offSummary: string;
  /** Empty when the registry sentence needs an operator value to be true. */
  onSummary: string;
  revocationEffect: string;
}

const sharingPurposes = computed<PolicyPurpose[]>(() =>
  sharingEnabled.value
    ? PROCESSING_PURPOSES.map((id) => {
        const spec = PROCESSING_PURPOSE_SPECS[id];
        return {
          id,
          label: spec.label,
          offSummary: spec.offSummary,
          onSummary: FLOOR_TOKEN.test(spec.onSummaryTemplate) ? '' : spec.onSummaryTemplate,
          revocationEffect: spec.revocationEffect,
        };
      })
    : [],
);

// Section numbers are DERIVED, not hand-written. Three sections are conditional
// now, and the numbering was previously a chain of `federationEnabled ? '7' : '6'`
// ternaries that every later heading had to repeat: adding one more conditional
// section would have meant editing all of them and getting it right by hand.
const sectionKeys = computed(() => [
  'who', 'data', 'use', 'basis', 'cookies',
  ...(analytics.value ? ['analytics'] : []),
  ...(sharingPurposes.value.length ? ['sharing'] : []),
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

// The cookie list is DERIVED from the same registry that sets the cookies and
// renders the cookie policy. It used to be typed out by hand here, and had
// already drifted: it omitted `cpub-verify-dismissed` entirely and described the
// theme preference as browser local storage when it is a cookie, which this
// page's own section 5 then contradicted. A policy page that lists cookies must
// read them from the thing that defines them.
const { cookies } = useCookieConsent();
const essentialCookies = computed(() => cookies.value.filter((c) => c.category === 'essential'));
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
          <li><strong>Theme preference:</strong> your light/dark mode choice, stored in a cookie on your device and set only when you use the theme toggle</li>
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
        <p>We use a small number of cookies to provide and improve the service. These are strictly necessary and are set whether or not you accept anything else:</p>
        <ul>
          <li v-for="cookie in essentialCookies" :key="cookie.name">
            <code>{{ cookie.name }}</code>: {{ cookie.description }} Kept for {{ cookie.duration.toLowerCase() }}.
          </li>
        </ul>
        <p v-if="analytics">We use analytics cookies, described in section {{ n('analytics') }} below. They are set only if you accept them, and never for advertising. For the full list of cookies and to change your choice, see our <NuxtLink to="/cookies">Cookie Policy</NuxtLink>.</p>
        <p v-else>We do not use any advertising or tracking cookies. For the full list of cookies and to manage your preferences, see our <NuxtLink to="/cookies">Cookie Policy</NuxtLink>.</p>
      </section>

      <section v-if="analytics" class="cpub-legal-section">
        <h2>{{ n('analytics') }}. Analytics</h2>
        <p>We use <strong>{{ analytics.label }}</strong> to understand how this site is used, so we can see which pages people find and which ones they cannot. It runs only if you choose "Accept all" in the cookie banner. If you choose "Essential only", or ignore the banner, nothing is loaded and no analytics cookies are set.</p>

        <h3>What is collected</h3>
        <ul>
          <li>The address and title of each public page you visit, and the order you visit them in. The address is sent without anything after the <code>?</code>, so what you type is removed before it leaves your browser.</li>
          <li>The site or search engine that referred you here, if any</li>
          <li>Approximate location, derived from your IP address and no more precise than a city</li>
          <li>Device type, screen size, browser and operating system</li>
          <li>A randomly generated id stored in a cookie, so a repeat visit is not counted as a new person</li>
          <li>Some interactions on public pages that {{ analytics.processor }} records automatically: how far down a page you scroll, clicks on links that lead off this site, file downloads, and video engagement</li>
        </ul>

        <h3>What is not collected</h3>
        <ul>
          <li>Your name, email address, or anything else from your account. We never send account data to {{ analytics.processor }}, so analytics cannot be linked back to who you are on this site.</li>
          <li>Your full IP address. It is used to derive an approximate location and is not stored by us.</li>
          <li>Anything you type. The part of a web address after the <code>?</code> is removed before it is sent, so a search you run here is recorded as a visit to the search page and never includes what you searched for.</li>
          <li>Anything on a page you need to be logged in to see. Pages that require an account, including your settings, your messages, your notifications and the admin area, send nothing at all, not even their titles.</li>
          <li>We run no advertising, we do not track you across other websites, and we do not sell or share this data with anyone beyond the processor named below.</li>
        </ul>

        <h3>Who processes it, and where</h3>
        <p>{{ analytics.processor }} acts as our processor and may process this data outside your country, including in the United States. Their handling is governed by the <a :href="analytics.policyUrl" target="_blank" rel="noopener">{{ analytics.processor }} privacy policy</a>. Our legal basis is your consent (Art. 6(1)(a)), which you can withdraw at any time from the <NuxtLink to="/cookies">Cookie Policy</NuxtLink> page. Withdrawing deletes the analytics cookies from this device and stops the analytics code storing anything or reporting your visits, so collection stops there and then. If any of those cookies are still present the next time a page loads, they are deleted again.</p>
        <p>If we later change what analytics is used for, or who processes it, your previous answer no longer applies and you will be asked again rather than carried over.</p>

        <h3>Checking this for yourself</h3>
        <p>This site runs on CommonPub, which is open source, so you do not have to take our word for any of the above. The code that loads analytics, including the rule that nothing loads before you accept, is
          <a :href="`${SOURCE_BASE}/layers/base/plugins/analytics.client.ts`" target="_blank" rel="noopener">plugins/analytics.client.ts</a>,
          and the full list of what each provider is allowed to contact and which cookies it sets is
          <a :href="`${SOURCE_BASE}/packages/config/src/analytics.ts`" target="_blank" rel="noopener">packages/config/src/analytics.ts</a>.
          You can also confirm it in your own browser: open developer tools and check that no request to {{ analytics.processor }} is made until you accept.</p>
      </section>

      <!--
        Every sentence in this section comes from the purpose registry in
        `@commonpub/persona`, the same source `/settings/privacy` renders. It is
        not a summary of those choices, because a summary is a second copy and a
        second copy drifts from the behaviour it describes.
      -->
      <section v-if="sharingPurposes.length" class="cpub-legal-section">
        <h2>{{ n('sharing') }}. Choices you make about your own profile</h2>
        <p>These are separate from cookies. Each one is off unless you turn it on, turning one off is one click on the same control that turned it on, and our legal basis for every one of them is your consent (Art. 6(1)(a)). Which of these this site offers, the parties each one names, and the exact wording that applies here are all shown beside the switch in your <NuxtLink to="/settings/privacy">Privacy settings</NuxtLink>.</p>

        <div v-for="purpose in sharingPurposes" :key="purpose.id">
          <h3>{{ purpose.label }}</h3>
          <!-- What is true while it is OFF is read before what would change, on
               this page for the same reason it is on the consent card. -->
          <p>{{ purpose.offSummary }}</p>
          <p v-if="purpose.onSummary">{{ purpose.onSummary }}</p>
          <p v-else>What turning this on does is described in one sentence that names a number the operator of this site chooses, so it is shown beside the switch in your <NuxtLink to="/settings/privacy">Privacy settings</NuxtLink> rather than restated here with a number that might not be this site's.</p>
          <p>{{ purpose.revocationEffect }}</p>
        </div>

        <p>None of these choices shares your email address, and none of them creates a way for anyone to contact you other than the messages any account on this site can already send you.</p>
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
