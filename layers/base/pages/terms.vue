<script setup lang="ts">
useSeoMeta({
  title: `Terms of Service — ${useSiteName()}`,
  description: 'Terms and conditions for using this platform.',
});

const siteName = useSiteName();
</script>

<template>
  <div class="cpub-legal">
    <div class="cpub-legal-header">
      <h1 class="cpub-legal-title">Terms of Service</h1>
      <p class="cpub-legal-updated">Last updated: April 2026</p>
    </div>

    <div class="cpub-legal-body">
      <section class="cpub-legal-section">
        <h2>1. Acceptance</h2>
        <p>By creating an account or using {{ siteName }}, you agree to these Terms of Service and our <NuxtLink to="/privacy">Privacy Policy</NuxtLink>. If you do not agree, do not use the service.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>2. Your Account</h2>
        <ul>
          <li>You must provide accurate information when creating an account.</li>
          <li>You are responsible for keeping your login credentials secure.</li>
          <li>You must be at least 16 years old to create an account (or the minimum age required by your jurisdiction).</li>
          <li>One person, one account. Automated or bot accounts require prior approval from the instance administrator.</li>
        </ul>
      </section>

      <section class="cpub-legal-section">
        <h2>3. Your Content</h2>
        <p>You retain ownership of content you create on {{ siteName }}. By publishing content, you grant us a license to display, distribute, and federate it as part of operating the platform.</p>
        <ul>
          <li>You must have the right to publish any content you upload (no plagiarism, no copyright infringement).</li>
          <li>Content you import must be your own original work.</li>
          <li>You may delete your content at any time. Federated copies on remote instances are outside our control.</li>
          <li>We may remove content that violates these terms or applicable law.</li>
        </ul>
      </section>

      <section class="cpub-legal-section">
        <h2>4. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Post illegal content or content that infringes others' rights</li>
          <li>Harass, threaten, or abuse other users</li>
          <li>Spam, phish, or distribute malware</li>
          <li>Attempt to gain unauthorized access to the platform or other users' accounts</li>
          <li>Scrape, crawl, or automatically collect data from the platform beyond what public APIs allow</li>
          <li>Impersonate another person or entity</li>
          <li>Use the platform for commercial advertising without permission</li>
        </ul>
      </section>

      <section class="cpub-legal-section">
        <h2>5. Moderation</h2>
        <p>The instance administrator may, at their discretion:</p>
        <ul>
          <li>Remove content that violates these terms</li>
          <li>Suspend or delete accounts that violate these terms</li>
          <li>Block federation with other instances</li>
        </ul>
        <p>We aim to handle moderation decisions transparently and fairly.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>6. Availability and Changes</h2>
        <p>We provide {{ siteName }} on an "as is" basis. We do not guarantee uninterrupted availability. We may modify or discontinue the service at any time.</p>
        <p>These terms may be updated. Continued use after changes constitutes acceptance.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>7. Limitation of Liability</h2>
        <p>To the fullest extent permitted by law, the instance operator is not liable for any indirect, incidental, or consequential damages arising from your use of the platform. This includes data loss, service interruptions, or actions of other users or federated instances.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>8. Account Deletion</h2>
        <p>You may delete your account at any time from your <NuxtLink to="/settings/account">account settings</NuxtLink>. Account deletion is permanent and removes all your data, content, and activity from this instance. See our <NuxtLink to="/privacy">Privacy Policy</NuxtLink> for details on data retention and federation.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>9. Contact</h2>
        <p>For questions about these terms, contact the administrator of this {{ siteName }} instance.</p>
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
