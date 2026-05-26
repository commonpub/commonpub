<script setup lang="ts">
/**
 * Article-style preview. Mimics the long-form prose layout used by
 * blogs, projects, explainers, and docs pages. Useful for tuning
 * typography, link colors, blockquote, list, table, and prose code.
 */
</script>

<template>
  <article class="scene-prose">
    <header class="scene-prose-header">
      <span class="scene-prose-eyebrow">PROJECT · OPEN</span>
      <h1 class="scene-prose-title">Building a federated maker community without a platform</h1>
      <p class="scene-prose-deck">
        How CommonPub instances stay sovereign while still talking to Mastodon, Lemmy,
        and each other — and what we learned shipping the first three live sites.
      </p>
      <div class="scene-prose-byline">
        <span class="scene-prose-avatar">M</span>
        <span><strong>moheeb</strong> · <a href="#" class="scene-prose-link">deveco.io</a></span>
        <span class="scene-prose-dot">·</span>
        <span>8 min read</span>
      </div>
    </header>

    <p>
      Most maker communities live on someone else's platform. The platform owns the
      identity, the content, the moderation, and the moment the platform changes
      direction, the community goes with it. That's the failure mode CommonPub is
      built around — every instance is a complete site, federation is opt-in, and
      moving your community is a database export, not a migration ticket.
    </p>

    <h2 class="scene-prose-h2">Three sites, one codebase</h2>
    <p>
      The reference deployment runs <a href="#" class="scene-prose-link">commonpub.io</a>,
      <a href="#" class="scene-prose-link">deveco.io</a>, and
      <a href="#" class="scene-prose-link">heatsynclabs.io</a> off the same Nuxt layer.
      Each one extends <code class="scene-prose-code-inline">@commonpub/layer</code> and
      overrides only what's specific to the community.
    </p>

    <blockquote class="scene-prose-quote">
      The schema is the work — everything else follows from it.
    </blockquote>

    <h3 class="scene-prose-h3">What the layer ships</h3>
    <ul class="scene-prose-list">
      <li>Content types: project, blog, explainer, video, doc page</li>
      <li>Federation: ActivityPub via Fedify, instance + actor signing</li>
      <li>Hubs: local-first groups, with a Group-actor escape hatch</li>
      <li>Admin panel: feature flags, theme picker, audit log, mirror config</li>
    </ul>

    <h3 class="scene-prose-h3">Sample query</h3>
    <p>The hub feed is built from this Drizzle query:</p>
    <pre class="scene-prose-pre"><code>const items = await db
  .select()
  .from(content)
  .where(eq(content.hubId, hub.id))
  .orderBy(desc(content.publishedAt))
  .limit(20);</code></pre>

    <h3 class="scene-prose-h3">Deploy targets</h3>
    <table class="scene-prose-table">
      <thead>
        <tr>
          <th>Site</th>
          <th>Federation</th>
          <th>Custom theme</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>commonpub.io</td><td>Yes</td><td>Classic</td></tr>
        <tr><td>deveco.io</td><td>Yes</td><td>devEco brand</td></tr>
        <tr><td>heatsynclabs.io</td><td>Soon</td><td>Hacker green</td></tr>
      </tbody>
    </table>

    <hr class="scene-prose-hr" />
    <p class="scene-prose-foot">Last updated 2026-05-26 · 8-minute read · Tagged <a href="#" class="scene-prose-link">#federation</a> <a href="#" class="scene-prose-link">#open</a></p>
  </article>
</template>

<style scoped>
.scene-prose {
  max-width: 640px;
  margin: 0 auto;
  font-family: var(--font-body);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--text);
}
.scene-prose-header { margin-bottom: var(--space-8); }
.scene-prose-eyebrow {
  font-family: var(--font-mono);
  font-size: var(--text-label);
  letter-spacing: var(--tracking-widest);
  text-transform: uppercase;
  color: var(--accent);
}
.scene-prose-title { font-family: var(--font-heading); font-size: var(--text-3xl); font-weight: var(--font-weight-bold); letter-spacing: var(--tracking-tight); line-height: var(--leading-tight); color: var(--text); margin: var(--space-3) 0 var(--space-3); }
.scene-prose-deck { font-size: var(--text-md); color: var(--text-dim); line-height: var(--leading-snug); margin: 0 0 var(--space-4); }
.scene-prose-byline { display: flex; align-items: center; gap: 8px; color: var(--text-dim); font-size: var(--text-sm); }
.scene-prose-avatar { width: 28px; height: 28px; border-radius: var(--radius-full); background: var(--accent); color: var(--color-on-accent); display: inline-flex; align-items: center; justify-content: center; font-weight: var(--font-weight-bold); font-size: 12px; }
.scene-prose-dot { color: var(--text-faint); }
.scene-prose-h2 { font-family: var(--font-heading); font-size: var(--text-2xl); font-weight: var(--font-weight-semibold); color: var(--text); margin: var(--space-8) 0 var(--space-3); letter-spacing: var(--tracking-tight); }
.scene-prose-h3 { font-family: var(--font-heading); font-size: var(--text-lg); font-weight: var(--font-weight-semibold); color: var(--text); margin: var(--space-6) 0 var(--space-2); }
.scene-prose p { margin: 0 0 var(--space-4); }
.scene-prose-link { color: var(--color-link); text-decoration: underline; text-underline-offset: 2px; }
.scene-prose-link:hover { color: var(--color-link-hover); }
.scene-prose-quote {
  border-left: 4px solid var(--accent);
  margin: var(--space-6) 0;
  padding: var(--space-2) var(--space-5);
  font-family: var(--font-heading);
  font-size: var(--text-lg);
  font-style: italic;
  color: var(--text-dim);
  background: var(--accent-bg);
}
.scene-prose-code-inline { font-family: var(--font-mono); font-size: 0.9em; padding: 1px 6px; background: var(--surface2); border: var(--border-width-thin) solid var(--border2); color: var(--accent); }
.scene-prose-pre {
  background: var(--code-bg);
  color: var(--code-text);
  padding: var(--space-4);
  margin: var(--space-4) 0 var(--space-6);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  overflow: auto;
  border: var(--border-width-thin) solid var(--code-border);
}
.scene-prose-list { padding-left: var(--space-5); margin: 0 0 var(--space-4); }
.scene-prose-list li { margin-bottom: var(--space-2); }
.scene-prose-table { width: 100%; border-collapse: collapse; margin: var(--space-4) 0 var(--space-6); }
.scene-prose-table th, .scene-prose-table td { padding: var(--space-2) var(--space-3); border-bottom: var(--border-width-thin) solid var(--border2); text-align: left; font-size: var(--text-sm); }
.scene-prose-table th { font-family: var(--font-mono); font-size: var(--text-label); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--text-dim); background: var(--surface2); border-bottom: var(--border-width-default) solid var(--border); }
.scene-prose-hr { border: 0; border-top: var(--border-width-default) solid var(--border2); margin: var(--space-8) 0; }
.scene-prose-foot { color: var(--text-faint); font-size: var(--text-sm); }
</style>
