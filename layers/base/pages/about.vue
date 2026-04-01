<script setup lang="ts">
useSeoMeta({
  title: `About — ${useSiteName()}`,
  description: 'CommonPub is an open-source, federated platform for maker communities.',
});

const { hubs: hubsEnabled, learning: learningEnabled, contests: contestsEnabled, federation: federationEnabled, docs: docsEnabled } = useFeatures();
</script>

<template>
  <div class="cpub-about">
    <div class="cpub-about-hero">
      <div class="cpub-about-hero-grid" />
      <div class="cpub-about-hero-inner">
        <span class="cpub-about-badge"><i class="fa-solid fa-code-branch"></i> Open Source</span>
        <h1 class="cpub-about-title">CommonPub</h1>
        <p class="cpub-about-subtitle">An open ActivityPub federation protocol and platform for self-hosted maker communities.</p>
      </div>
    </div>

    <div class="cpub-about-body">
      <div class="cpub-about-grid">
        <div class="cpub-about-card">
          <div class="cpub-about-card-icon"><i class="fa-solid fa-microchip"></i></div>
          <h3>For Makers</h3>
          <p>Document your builds with rich block editors. Parts lists, wiring diagrams, build steps, and code blocks — everything you need to share how you built it.</p>
        </div>
        <div v-if="hubsEnabled" class="cpub-about-card">
          <div class="cpub-about-card-icon"><i class="fa-solid fa-users"></i></div>
          <h3>Community Hubs</h3>
          <p>Create spaces for your community, product, or company. Discussions, content galleries, learning paths, and contests — all in one place.</p>
        </div>
        <div v-if="federationEnabled" class="cpub-about-card">
          <div class="cpub-about-card-icon"><i class="fa-solid fa-globe"></i></div>
          <h3>Federated</h3>
          <p>Built on ActivityPub. Your instance, your data. Follow makers across instances. No single point of failure, no platform lock-in.</p>
        </div>
        <div v-if="learningEnabled" class="cpub-about-card">
          <div class="cpub-about-card-icon"><i class="fa-solid fa-graduation-cap"></i></div>
          <h3>Learning Paths</h3>
          <p>Structured learning with modules, lessons, quizzes, and certificates. Track your progress and earn credentials.</p>
        </div>
        <div v-if="contestsEnabled" class="cpub-about-card">
          <div class="cpub-about-card-icon"><i class="fa-solid fa-trophy"></i></div>
          <h3>Contests</h3>
          <p>Run build contests with prizes, judges, and community voting. From small jams to sponsored competitions.</p>
        </div>
        <div class="cpub-about-card">
          <div class="cpub-about-card-icon"><i class="fa-solid fa-server"></i></div>
          <h3>Self-Hosted</h3>
          <p>Deploy with Docker. PostgreSQL, Redis, and your choice of S3-compatible storage. Full control over your data.</p>
        </div>
      </div>

      <div class="cpub-about-cta">
        <h2>Start Building</h2>
        <p>CommonPub is free and open source. Set up your own instance or join an existing one.</p>
        <div class="cpub-about-cta-actions">
          <NuxtLink to="/auth/register" class="cpub-btn cpub-btn-primary"><i class="fa-solid fa-user-plus"></i> Create Account</NuxtLink>
          <NuxtLink v-if="docsEnabled" to="/docs" class="cpub-btn"><i class="fa-solid fa-book"></i> Documentation</NuxtLink>
          <a href="https://github.com/commonpub" target="_blank" rel="noopener" class="cpub-btn"><i class="fa-brands fa-github"></i> GitHub</a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-about-hero {
  position: relative;
  background: var(--surface2);
  border-bottom: var(--border-width-default) solid var(--border);
  padding: 64px 32px;
  text-align: center;
  overflow: hidden;
}
.cpub-about-hero-grid {
  position: absolute; inset: 0;
  background-image: linear-gradient(var(--border2) 1px, transparent 1px), linear-gradient(90deg, var(--border2) 1px, transparent 1px);
  background-size: 32px 32px; opacity: 0.2;
}
.cpub-about-hero-inner { position: relative; z-index: 1; max-width: 600px; margin: 0 auto; }
.cpub-about-badge { font-family: var(--font-mono); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; padding: 4px 12px; border: var(--border-width-default) solid var(--green); background: var(--green-bg); color: var(--green); display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px; }
.cpub-about-title { font-size: 36px; font-weight: 700; margin-bottom: 12px; letter-spacing: -0.02em; }
.cpub-about-subtitle { font-size: 15px; color: var(--text-dim); line-height: 1.6; }

.cpub-about-body { max-width: 1000px; margin: 0 auto; padding: 48px 32px; }
.cpub-about-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 48px; }
.cpub-about-card { background: var(--surface); border: var(--border-width-default) solid var(--border); padding: 24px; box-shadow: var(--shadow-md); }
.cpub-about-card-icon { font-size: 24px; color: var(--accent); margin-bottom: 12px; }
.cpub-about-card h3 { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.cpub-about-card p { font-size: 12px; color: var(--text-dim); line-height: 1.6; }

.cpub-about-cta { text-align: center; padding: 32px; background: var(--surface2); border: var(--border-width-default) solid var(--border); }
.cpub-about-cta h2 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
.cpub-about-cta p { font-size: 13px; color: var(--text-dim); margin-bottom: 20px; }
.cpub-about-cta-actions { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }

@media (max-width: 768px) { .cpub-about-grid { grid-template-columns: 1fr; } }
</style>
