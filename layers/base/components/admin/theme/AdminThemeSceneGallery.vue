<script setup lang="ts">
/**
 * Component gallery preview. Renders representative UI primitives —
 * buttons, cards, forms, badges, alerts, code — so every category of
 * token has something visible to land on. Self-contained: all markup
 * uses `var(--*)` only so the parent's inline-style scope drives the look.
 *
 * Designed to be REPLACEABLE later — when the layout-builder lands, this
 * scene becomes one option among many in AdminThemePreviewPane's picker.
 */
</script>

<template>
  <div class="scene-gallery">
    <!-- TYPOGRAPHY -->
    <section class="scene-block">
      <h2 class="scene-section-label">Typography</h2>
      <div class="scene-card">
        <h1 class="scene-h1">Display heading H1</h1>
        <h2 class="scene-h2">Section heading H2</h2>
        <h3 class="scene-h3">Subsection heading H3</h3>
        <p class="scene-body">
          Body copy uses <code class="scene-inline-code">var(--font-body)</code> at
          <code class="scene-inline-code">var(--text-base)</code>. The quick brown fox
          jumps over the lazy dog.
        </p>
        <p class="scene-muted">Secondary text, note the contrast against background.</p>
        <p class="scene-faint">Tertiary text, used for placeholders and faint metadata.</p>
        <p class="scene-mono-label">Mono label, uppercase letter-spaced</p>
      </div>
    </section>

    <!-- BUTTONS -->
    <section class="scene-block">
      <h2 class="scene-section-label">Buttons</h2>
      <div class="scene-card scene-card-row">
        <button class="scene-btn scene-btn-primary">Primary action</button>
        <button class="scene-btn">Secondary</button>
        <button class="scene-btn scene-btn-ghost">Ghost</button>
        <button class="scene-btn scene-btn-danger">Destructive</button>
        <button class="scene-btn" disabled>Disabled</button>
      </div>
    </section>

    <!-- BADGES + SEMANTIC -->
    <section class="scene-block">
      <h2 class="scene-section-label">Badges &amp; semantic colors</h2>
      <div class="scene-card scene-card-row">
        <span class="scene-badge tone-accent">Accent</span>
        <span class="scene-badge tone-green">Success</span>
        <span class="scene-badge tone-yellow">Warning</span>
        <span class="scene-badge tone-red">Error</span>
        <span class="scene-badge tone-purple">Info</span>
        <span class="scene-badge tone-teal">Teal</span>
        <span class="scene-badge tone-pink">Pink</span>
      </div>
    </section>

    <!-- FORMS -->
    <section class="scene-block">
      <h2 class="scene-section-label">Forms</h2>
      <div class="scene-card">
        <label class="scene-field">
          <span class="scene-field-label">Email address</span>
          <input class="scene-input" type="email" placeholder="you@example.com" value="federation@deveco.io" />
        </label>
        <label class="scene-field">
          <span class="scene-field-label">Bio</span>
          <textarea class="scene-input scene-textarea" rows="3">Building open community tooling.</textarea>
        </label>
        <label class="scene-field">
          <span class="scene-field-label">Visibility</span>
          <select class="scene-input">
            <option>Public</option>
            <option>Members only</option>
            <option>Private</option>
          </select>
        </label>
        <div class="scene-checkrow">
          <label class="scene-check"><input type="checkbox" checked /> Allow follows</label>
          <label class="scene-check"><input type="checkbox" /> Email digest</label>
        </div>
      </div>
    </section>

    <!-- CONTENT CARDS -->
    <section class="scene-block">
      <h2 class="scene-section-label">Content cards</h2>
      <div class="scene-card-grid">
        <article class="scene-content-card">
          <div class="scene-content-image" aria-hidden="true">
            <span class="scene-content-type">PROJECT</span>
          </div>
          <div class="scene-content-body">
            <h3 class="scene-content-title">Tiny mesh router for off-grid relays</h3>
            <p class="scene-content-excerpt">Solar-powered LoRa nodes that auto-form a mesh and route AP federation activity over store-and-forward links.</p>
            <div class="scene-content-meta">
              <span class="scene-avatar" aria-hidden="true">M</span>
              <span class="scene-content-author">moheeb</span>
              <span class="scene-content-dot">·</span>
              <span class="scene-content-date">3 days ago</span>
            </div>
          </div>
        </article>
        <article class="scene-content-card">
          <div class="scene-content-image scene-content-image-alt" aria-hidden="true">
            <span class="scene-content-type tone-explainer">EXPLAINER</span>
          </div>
          <div class="scene-content-body">
            <h3 class="scene-content-title">How ActivityPub delivery actually works</h3>
            <p class="scene-content-excerpt">An interactive walkthrough of the inbox / outbox dance, signatures, and the recovery dead-letter queue.</p>
            <div class="scene-content-meta">
              <span class="scene-avatar" aria-hidden="true">C</span>
              <span class="scene-content-author">commonpub</span>
              <span class="scene-content-dot">·</span>
              <span class="scene-content-date">Last week</span>
            </div>
          </div>
        </article>
      </div>
    </section>

    <!-- ALERTS -->
    <section class="scene-block">
      <h2 class="scene-section-label">Alerts</h2>
      <div class="scene-stack">
        <div class="scene-alert tone-accent">
          <i class="fa-solid fa-circle-info" aria-hidden="true" />
          <div>
            <strong>Federation enabled.</strong>
            Your instance is sending and receiving ActivityPub messages with 3 peers.
          </div>
        </div>
        <div class="scene-alert tone-green">
          <i class="fa-solid fa-check" aria-hidden="true" />
          <div><strong>Saved.</strong> Theme tokens are applied to your live site.</div>
        </div>
        <div class="scene-alert tone-yellow">
          <i class="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          <div><strong>Heads up:</strong> two tokens reference colors that fail WCAG AA contrast.</div>
        </div>
      </div>
    </section>

    <!-- CODE -->
    <section class="scene-block">
      <h2 class="scene-section-label">Code block</h2>
      <div class="scene-code">
        <div class="scene-code-header">
          <span>useFederationDigest.ts</span>
          <button class="scene-code-copy" type="button">copy</button>
        </div>
        <pre class="scene-code-body"><code>// Computes the rfc-3230 digest header for an inbox POST.
export function digestFor(body: string): string {
  const buf = new TextEncoder().encode(body);
  const hash = crypto.subtle.digestSync('SHA-256', buf);
  return 'SHA-256=' + base64(hash);
}</code></pre>
      </div>
    </section>

    <!-- SHADOWS / SHAPES -->
    <section class="scene-block">
      <h2 class="scene-section-label">Shadows &amp; shape</h2>
      <div class="scene-shadow-grid">
        <div class="scene-shadow-box" style="box-shadow: var(--shadow-sm)">sm</div>
        <div class="scene-shadow-box" style="box-shadow: var(--shadow-md)">md</div>
        <div class="scene-shadow-box" style="box-shadow: var(--shadow-lg)">lg</div>
        <div class="scene-shadow-box" style="box-shadow: var(--shadow-xl)">xl</div>
        <div class="scene-shadow-box" style="box-shadow: var(--shadow-accent)">accent</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.scene-gallery { display: flex; flex-direction: column; gap: var(--space-6); max-width: 720px; margin: 0 auto; }

.scene-block { display: flex; flex-direction: column; gap: var(--space-2); }

.scene-section-label {
  font-family: var(--font-mono);
  font-size: var(--text-label);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  color: var(--text-dim);
  margin: 0;
}

.scene-card {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.scene-card-row { flex-direction: row; flex-wrap: wrap; align-items: center; }

/* Typography */
.scene-h1 { font-family: var(--font-heading); font-size: var(--text-3xl); font-weight: var(--font-weight-bold); margin: 0; color: var(--text); letter-spacing: var(--tracking-tight); line-height: var(--leading-tight); }
.scene-h2 { font-family: var(--font-heading); font-size: var(--text-xl); font-weight: var(--font-weight-semibold); margin: 0; color: var(--text); }
.scene-h3 { font-family: var(--font-heading); font-size: var(--text-md); font-weight: var(--font-weight-semibold); margin: 0; color: var(--text); }
.scene-body { font-size: var(--text-base); line-height: var(--leading-normal); color: var(--text); margin: 0; }
.scene-muted { font-size: var(--text-sm); color: var(--text-dim); margin: 0; }
.scene-faint { font-size: var(--text-sm); color: var(--text-faint); margin: 0; }
.scene-mono-label { font-family: var(--font-mono); font-size: var(--text-label); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--text-dim); margin: 0; }
.scene-inline-code { font-family: var(--font-mono); font-size: 0.9em; padding: 1px 6px; background: var(--surface2); color: var(--code-inline); border: var(--border-width-thin) solid var(--border2); }

/* Buttons */
.scene-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--tracking-wide);
  background: var(--surface);
  color: var(--text);
  border: var(--border-width-default) solid var(--border);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-fast);
}
.scene-btn:hover { transform: translate(-1px, -1px); box-shadow: var(--shadow-md); }
.scene-btn:active { transform: translate(0, 0); box-shadow: none; }
.scene-btn:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; transform: none; }
.scene-btn-primary { background: var(--accent); color: var(--color-on-accent); border-color: var(--border); }
.scene-btn-ghost { background: transparent; box-shadow: none; }
.scene-btn-danger { background: var(--red); color: var(--color-text-inverse); border-color: var(--border); }

/* Badges */
.scene-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-family: var(--font-mono);
  font-size: var(--text-label);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  border: var(--border-width-thin) solid var(--border2);
}
.tone-accent { color: var(--accent); background: var(--accent-bg); border-color: var(--accent-border); }
.tone-green { color: var(--green); background: var(--green-bg); border-color: var(--green-border); }
.tone-yellow { color: var(--yellow); background: var(--yellow-bg); border-color: var(--yellow-border); }
.tone-red { color: var(--red); background: var(--red-bg); border-color: var(--red-border); }
.tone-purple { color: var(--purple); background: var(--purple-bg); border-color: var(--purple-border); }
.tone-teal { color: var(--teal); background: var(--teal-bg); border-color: var(--teal-border); }
.tone-pink { color: var(--pink); background: var(--pink-bg); border-color: var(--pink-border); }
.tone-explainer { color: var(--teal); background: var(--teal-bg); border-color: var(--teal-border); }

/* Forms */
.scene-field { display: flex; flex-direction: column; gap: 6px; }
.scene-field-label { font-family: var(--font-mono); font-size: var(--text-label); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--text-dim); }
.scene-input {
  background: var(--surface2);
  color: var(--text);
  border: var(--border-width-default) solid var(--border);
  padding: 8px 10px;
  font-size: var(--text-sm);
  font-family: var(--font-body);
  width: 100%;
}
.scene-input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.scene-textarea { resize: vertical; min-height: 60px; font-family: var(--font-body); }
.scene-checkrow { display: flex; gap: var(--space-4); flex-wrap: wrap; }
.scene-check { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-sm); color: var(--text); }

/* Content cards */
.scene-card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-4); }
.scene-content-card { background: var(--surface); border: var(--border-width-default) solid var(--border); display: flex; flex-direction: column; box-shadow: var(--shadow-sm); }
.scene-content-image { position: relative; height: 120px; background: linear-gradient(135deg, var(--accent-bg) 0%, var(--accent-bg-strong, var(--accent-bg)) 100%); border-bottom: var(--border-width-default) solid var(--border); }
.scene-content-image-alt { background: linear-gradient(135deg, var(--teal-bg) 0%, var(--purple-bg) 100%); }
.scene-content-type { position: absolute; top: 8px; left: 8px; font-family: var(--font-mono); font-size: 10px; letter-spacing: var(--tracking-wide); padding: 2px 6px; background: var(--color-badge-overlay, rgba(0,0,0,0.7)); color: #fff; }
.scene-content-body { padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); }
.scene-content-title { font-size: var(--text-md); font-weight: var(--font-weight-semibold); margin: 0; color: var(--text); }
.scene-content-excerpt { font-size: var(--text-sm); color: var(--text-dim); margin: 0; line-height: var(--leading-snug); }
.scene-content-meta { display: flex; align-items: center; gap: 6px; font-size: var(--text-sm); color: var(--text-dim); }
.scene-avatar { width: 22px; height: 22px; border-radius: var(--radius-full); background: var(--accent); color: var(--color-on-accent); display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: var(--font-weight-bold); }
.scene-content-author { color: var(--text); font-weight: var(--font-weight-medium); }
.scene-content-dot { color: var(--text-faint); }

/* Alerts */
.scene-stack { display: flex; flex-direction: column; gap: var(--space-2); }
.scene-alert {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  border-left-width: 4px;
  font-size: var(--text-sm);
  color: var(--text);
}
.scene-alert i { padding-top: 2px; flex-shrink: 0; }
.scene-alert.tone-accent { border-left-color: var(--accent); background: var(--accent-bg); }
.scene-alert.tone-accent i { color: var(--accent); }
.scene-alert.tone-green { border-left-color: var(--green); background: var(--green-bg); }
.scene-alert.tone-green i { color: var(--green); }
.scene-alert.tone-yellow { border-left-color: var(--yellow); background: var(--yellow-bg); }
.scene-alert.tone-yellow i { color: var(--yellow); }

/* Code */
.scene-code {
  border: var(--border-width-default) solid var(--code-border, var(--border));
  background: var(--code-bg);
  color: var(--code-text);
  font-family: var(--font-mono);
  overflow: hidden;
  border-radius: 0;
}
.scene-code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: var(--code-header-bg);
  color: var(--code-muted);
  font-size: var(--text-label);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  border-bottom: var(--border-width-thin) solid var(--code-border, var(--border));
}
.scene-code-copy {
  background: none;
  border: var(--border-width-thin) solid var(--code-border, var(--border));
  color: var(--code-muted);
  font-family: var(--font-mono);
  font-size: var(--text-label);
  padding: 2px 8px;
  cursor: pointer;
}
.scene-code-body { margin: 0; padding: var(--space-3) var(--space-4); font-size: var(--text-sm); white-space: pre-wrap; overflow: auto; }

/* Shadows */
.scene-shadow-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: var(--space-6); padding: var(--space-4); }
.scene-shadow-box {
  height: 60px;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: var(--text-label);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--text-dim);
}
</style>
