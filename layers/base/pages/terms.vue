<script setup lang="ts">
const config = useRuntimeConfig();
// The instance's own brand name + domain, from config. The terms template was
// authored against the deveco.io reference host; here we substitute this
// instance's identity. On the canonical CommonPub instance we collapse
// "CommonPub and <instance>" to just "CommonPub" (it would otherwise be redundant).
const instanceName = computed(() => (config.public.siteName as string) || 'CommonPub');
const instanceDomain = computed(() => (config.public.domain as string) || 'this instance');
const isCanonical = computed(
  () => instanceName.value.trim().toLowerCase() === 'commonpub' || instanceDomain.value === 'commonpub.io',
);
/** "CommonPub and <name>", or just "CommonPub" on the canonical instance. */
const brandAnd = computed(() => (isCanonical.value ? 'CommonPub' : `CommonPub and ${instanceName.value}`));
/** "CommonPub and <domain>" subtitle form. */
const brandAndDomain = computed(() => (isCanonical.value ? 'CommonPub' : `CommonPub and ${instanceDomain.value}`));
/** "CommonPub or <name>". */
const brandOr = computed(() => (isCanonical.value ? 'CommonPub' : `CommonPub or ${instanceName.value}`));
/** verb suffix so "CommonPub and X exist" becomes "CommonPub exists" when canonical. */
const s = computed(() => (isCanonical.value ? 's' : ''));
const host = instanceDomain;

useSeoMeta({
  title: () => `Community Terms and Code of Conduct, ${instanceName.value}`,
  description: 'Community terms and code of conduct for this CommonPub instance.',
});
</script>

<template>
  <div class="cpub-legal">
    <div class="cpub-legal-header">
      <h1 class="cpub-legal-title">Community Terms and Code of Conduct</h1>
      <p class="cpub-legal-subtitle">{{ brandAndDomain }}</p>
      <p class="cpub-legal-updated">Last updated: March 2026</p>
    </div>

    <div class="cpub-legal-body">
      <p>Welcome to {{ brandAnd }}. CommonPub is an open source, federated publishing platform for maker and hardware communities. {{ host }} is where we host it, where people publish projects, build logs, and guides, and where they talk with each other about the work. These terms cover how you use {{ host }} and the community spaces around it.</p>
      <p>The CommonPub software itself is open source under the AGPL-3.0 license. You are free to read it, change it, and run your own instance. If you self-host, the parts of these terms about our hosted service do not apply to you, but the spirit of the code of conduct and the values below is something we hope you carry forward.</p>
      <p>By using {{ host }}, you agree to these terms and to the code of conduct here. If you do not agree with them, please do not use the service.</p>

      <section class="cpub-legal-section">
        <h2>1. What this covers</h2>
        <p>These terms apply to the {{ host }} hosted service and the community spaces we run, including project pages, discussion threads, and our chat channels. They also cover interactions you start here that reach other servers.</p>
        <p>CommonPub speaks ActivityPub, so the network is federated. When you post in public, your content can be sent to other servers in the network and to the people who follow you from those servers. Once something is public and federated, copies can live on servers we do not control, and we cannot pull those copies back. Keep that in mind when you decide what to publish.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>2. Using {{ brandAnd }}</h2>
        <p>You are welcome to:</p>
        <ul>
          <li>Publish projects, build logs, guides, and writeups for personal, educational, and commercial purposes.</li>
          <li>Run workshops, classes, and training programs that use {{ brandAnd }}.</li>
          <li>Share tutorials, screenshots, and demos of your work anywhere you like.</li>
          <li>Follow, reply to, and collaborate with people on other federated servers.</li>
          <li>Build on the open source code and run your own instance.</li>
        </ul>
        <p>If you share work that features {{ brandOr }}, a credit like "Published on {{ host }}" or a link back is appreciated. It is not required.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>3. Your content and ownership</h2>
        <p>You own your work. We claim no ownership over your projects, posts, files, designs, or anything else you make or upload. We do not sell your content, and we do not train models on it.</p>
        <p>By posting, you give us a limited license to store, display, and federate your content for the single purpose of running the service. That means holding it in our infrastructure, showing it in the interface, and sending your public posts to other servers and followers in the network. The license ends when you delete the content or your account, except for federated copies already sent to servers we do not control.</p>
        <p>You are responsible for having the rights to what you post, and for getting consent when your work involves other people's data, faces, or voices. We encourage you to license your projects openly so others can learn from them and build on them, but that choice is always yours.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>4. An open community</h2>
        <p>CommonPub exists so that the people who build things can share them and own them. We want you to:</p>
        <ul>
          <li>Publish your work freely, here and on any other platform.</li>
          <li>Write tutorials and teach what you know.</li>
          <li>Document the messy parts of a project, the dead ends and the rebuilds, not just the clean result.</li>
          <li>Use the platform in classrooms, hackerspaces, and workshops.</li>
          <li>Use it for paid and commercial work.</li>
          <li>Contribute improvements back to the project under our contributor model, with a DCO sign-off, if you want to make the software better.</li>
        </ul>
      </section>

      <section class="cpub-legal-section">
        <h2>5. Code of conduct</h2>
        <p>We want {{ brandAnd }} to be a place where people treat each other with respect.</p>
        <p>Everyone is welcome here regardless of race, ethnicity, national origin, religion, gender, gender identity, sexual orientation, disability, age, or experience level. A beginner asking a basic question deserves the same respect as a veteran shipping their tenth board.</p>
        <p>You agree to:</p>
        <ul>
          <li>Treat other people with respect and assume good faith.</li>
          <li>Keep your criticism aimed at the work, not at the person who made it.</li>
          <li>Respect other people's privacy and their consent.</li>
        </ul>
        <p>You agree not to:</p>
        <ul>
          <li>Harass, threaten, demean, or discriminate against anyone.</li>
          <li>Post hate speech or content that attacks people for who they are.</li>
          <li>Share someone's private information without their consent.</li>
          <li>Impersonate other people or misrepresent who built something.</li>
        </ul>
        <p>How we enforce this: where we reasonably can, we reach out first and try to sort the problem out. Enforcement is proportionate, from a quiet word, to a warning, to suspension, to removal for serious or repeated harm. If you think we got it wrong, you can appeal. These rules apply in our community spaces and to federated interactions that start here.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>6. Acceptable use</h2>
        <p>To keep the platform working and safe for everyone, you agree not to:</p>
        <ul>
          <li>Disrupt, damage, or try to gain unauthorized access to our systems.</li>
          <li>Upload or share content that is illegal or that harms others.</li>
          <li>Infringe anyone else's intellectual property.</li>
          <li>Write, host, or distribute malware.</li>
          <li>Build surveillance of individuals or populations, or track people without their knowledge and consent.</li>
          <li>Collect personal or biometric data without clear consent and real protection.</li>
        </ul>
        <p>We can suspend or end accounts that break these rules.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>7. What we will not work with</h2>
        <p>{{ brandAnd }} exist{{ s }} to help communities. We are clear about the work we will not be part of. These limits apply to us, to the partners and funders we take on, and to how the platform may be used.</p>
        <ul>
          <li>We do not work with defense contractors, and we do not support military or defense applications of our tools. We will not partner with, take funding from, or provide paid services to organizations whose purpose is building or deploying weapons or military systems.</li>
          <li>We do not work with companies that materially support the Israeli military (IDF). This is about complicity in unlawful military operations and violations of international humanitarian law. It follows the call of the BDS movement and the No Tech for Apartheid campaign.</li>
          <li>We will not knowingly platform or provide services for lethal or offensive weapons and targeting systems, for mass or targeted surveillance of people, or for any use meant to harm a community rather than help it.</li>
          <li>We reserve the right to refuse or end service to any organization that uses our tools for these purposes, or that materially supports war crimes.</li>
        </ul>
        <p>To be clear, these limits are about conduct, about military and defense use, and about material support for war crimes. They are not about anyone's nationality, ethnicity, or faith. Individual makers are always welcome here no matter where they are from or what they believe, and section 5 protects them.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>8. Statement of values</h2>
        <p>We are makers, and we believe the tools people build should belong to everyone and should be used to help, not to harm.</p>
        <p>These values shape who we work with and what we build, and they are not up for negotiation.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>9. No warranty and limits on liability</h2>
        <p>{{ host }} is provided as is, without warranties of any kind. We work to keep it reliable, but we cannot promise it will never go down or never lose data.</p>
        <p>To the extent the law allows, we are not liable for indirect, incidental, or consequential damages, including loss of data, projects, or business opportunities, even if we were told such loss was possible.</p>
        <p>Because CommonPub is open source and federated, you can export your work and run your own instance at any time. We still recommend keeping your own backups of anything you cannot afford to lose.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>10. Changes to these terms</h2>
        <p>We may update these terms from time to time. We will tell you about material changes through the service or by email. Using {{ host }} after a change is posted means you accept the updated terms.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>11. Governing law</h2>
        <p>These terms are governed by and read in line with applicable law, and any disputes will be handled through the appropriate legal channels.</p>
      </section>

      <section class="cpub-legal-section">
        <h2>12. Contact</h2>
        <p>Questions about these terms or the code of conduct can come to us through {{ host }} or our community channels, including Discord and GitHub.</p>
      </section>

      <p class="cpub-legal-closer">Made by makers. Built to help, not to harm.</p>
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

.cpub-legal-subtitle {
  font-size: 14px;
  color: var(--text-dim);
  font-family: var(--font-mono);
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

.cpub-legal-body > p {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-dim);
}

.cpub-legal-closer {
  font-style: italic;
  color: var(--text);
  border-top: var(--border-width-default) solid var(--border);
  padding-top: 24px;
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
