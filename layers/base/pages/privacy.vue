<script setup lang="ts">
useSeoMeta({
  title: `Privacy Policy — ${useSiteName()}`,
  description: 'How we collect, use, and protect your personal data.',
});

const siteName = useSiteName();
const { federation: federationEnabled } = useFeatures();
</script>

<template>
  <div class="cpub-legal">
    <div class="cpub-legal-header">
      <h1 class="cpub-legal-title">Privacy Policy</h1>
      <p class="cpub-legal-updated">Last updated: April 2026</p>
    </div>

    <div class="cpub-legal-body">
      <section class="cpub-legal-section">
        <h2>1. Who We Are</h2>
        <p>
          This {{ siteName }} instance is operated by its administrator (the "data controller").
          {{ siteName }} is powered by <a href="https://commonpub.io" target="_blank" rel="noopener">CommonPub</a>,
          an open-source, self-hosted platform. Each instance is independently operated and responsible for its own data processing.
        </p>
      </section>

      <section class="cpub-legal-section">
        <h2>2. What Data We Collect</h2>
        <p>When you create an account, we collect:</p>
        <ul>
          <li><strong>Account data:</strong> email address, username, password (stored as a secure hash)</li>
          <li><strong>Profile data:</strong> display name, bio, headline, location, website, avatar, banner image, social links, skills, pronouns, timezone (all optional)</li>
          <li><strong>Content:</strong> projects, articles, blog posts, comments, and other content you create</li>
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
        <h2>3. How We Use Your Data</h2>
        <ul>
          <li><strong>Providing the service:</strong> displaying your profile, publishing your content, delivering notifications</li>
          <li><strong>Authentication:</strong> verifying your identity when you log in</li>
          <li><strong>Security:</strong> protecting against unauthorized access, abuse, and spam</li>
          <li><strong>Email notifications:</strong> sending notification digests and alerts you've opted into (configurable in settings)</li>
        </ul>
      </section>

      <section class="cpub-legal-section">
        <h2>4. Legal Basis for Processing</h2>
        <p>We process your data under the following legal bases (GDPR Article 6):</p>
        <ul>
          <li><strong>Contract performance (Art. 6(1)(b)):</strong> processing necessary to provide you with the service you signed up for</li>
          <li><strong>Legitimate interest (Art. 6(1)(f)):</strong> session security, rate limiting, and preventing abuse</li>
        </ul>
      </section>

      <section class="cpub-legal-section">
        <h2>5. Cookies</h2>
        <p>We use a small number of cookies to provide and improve the service:</p>
        <ul>
          <li><strong>Session cookie</strong> (<code>better-auth.session_token</code>): strictly necessary — authenticates your login session. HttpOnly, secure, 7-day expiry.</li>
          <li><strong>Consent cookie</strong> (<code>cpub-consent</code>): strictly necessary — stores your cookie consent choice.</li>
          <li><strong>Color scheme</strong> (<code>cpub-color-scheme</code>): functional — remembers your light/dark mode preference. Set only with your consent.</li>
        </ul>
        <p>We do not use any advertising or tracking cookies. Your instance operator may add analytics cookies — these require your explicit consent. For the full list of cookies and to manage your preferences, visit our <NuxtLink to="/cookies">Cookie Policy</NuxtLink>.</p>
      </section>

      <section v-if="federationEnabled" class="cpub-legal-section">
        <h2>6. Federation and ActivityPub</h2>
        <p>This instance participates in the <a href="https://activitypub.rocks" target="_blank" rel="noopener">ActivityPub</a> federation protocol. When you publish content or interact publicly, the following data may be shared with remote instances:</p>
        <ul>
          <li>Your username, display name, avatar, and bio</li>
          <li>Your published content (projects, articles, blog posts)</li>
          <li>Your public interactions (likes, follows, comments on federated content)</li>
        </ul>
        <p>Your email address, location, social links, timezone, and other private profile fields are <strong>never</strong> shared via federation.</p>
        <p><strong>Important:</strong> Once your data is federated to remote instances, this instance cannot guarantee its deletion on those servers. Remote instances operate independently and may retain cached copies of your public data even after you delete your account here.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>{{ federationEnabled ? '7' : '6' }}. Third-Party Services</h2>
        <p>We load icon fonts from <strong>Font Awesome</strong> via the Cloudflare CDN (<code>cdnjs.cloudflare.com</code>). This means your browser makes requests to Cloudflare's servers, which are subject to <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">Cloudflare's privacy policy</a>.</p>
        <p>We do not use any analytics services, advertising networks, or tracking technologies.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>{{ federationEnabled ? '8' : '7' }}. Data Retention</h2>
        <ul>
          <li><strong>Account data:</strong> retained until you delete your account</li>
          <li><strong>Session data:</strong> automatically expires after 7 days of inactivity</li>
          <li><strong>Content:</strong> retained until you delete it or delete your account</li>
          <li><strong>Audit logs:</strong> retained per the instance operator's policy</li>
        </ul>
      </section>

      <section class="cpub-legal-section">
        <h2>{{ federationEnabled ? '9' : '8' }}. Your Rights</h2>
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
        <h2>{{ federationEnabled ? '10' : '9' }}. Contact</h2>
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
