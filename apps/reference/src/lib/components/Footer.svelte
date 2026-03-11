<footer class="footer">
  <div class="footer-inner page">
    <div class="footer-grid">
      <div class="footer-col">
        <span class="footer-brand">[instance]</span>
        <p class="footer-description">
          Open ActivityPub federation protocol for self-hosted maker communities.
        </p>
        <div class="fed-badge" style="margin-top: 8px;">
          <div class="fed-dot"></div>
          federated
        </div>
      </div>

      <div class="footer-col">
        <h4 class="footer-heading">Product</h4>
        <a href="/projects" class="footer-link">Projects</a>
        <a href="/guides" class="footer-link">Guides</a>
        <a href="/explainers" class="footer-link">Explainers</a>
        <a href="/learn" class="footer-link">Learn</a>
        <a href="/communities" class="footer-link">Communities</a>
      </div>

      <div class="footer-col">
        <h4 class="footer-heading">Editorial</h4>
        <a href="/magazine" class="footer-link">Magazine</a>
        <a href="/feed" class="footer-link">Feed</a>
      </div>

      <div class="footer-col">
        <h4 class="footer-heading">Developers</h4>
        <a href="/docs" class="footer-link">Documentation</a>
        <a href="https://github.com/snaplify" class="footer-link" target="_blank" rel="noopener">GitHub</a>
      </div>
    </div>

    <div class="footer-bottom">
      <span class="footer-copy">powered by <a href="https://snaplify.dev" class="footer-link-inline">snaplify</a></span>
      <span class="footer-version">v1.0.0</span>
    </div>
  </div>
</footer>

<style>
  .footer {
    border-top: 1px solid var(--color-border, #272725);
    background: var(--color-surface, #0c0c0b);
    padding: var(--space-12, 3rem) 0 var(--space-6, 1.5rem);
    margin-top: auto;
  }

  .footer-inner {
    padding-top: 0;
    padding-bottom: 0;
  }

  .footer-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: var(--space-8, 2rem);
    margin-bottom: var(--space-8, 2rem);
  }

  .footer-col {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .footer-brand {
    font-family: var(--font-mono, monospace);
    font-weight: var(--font-weight-bold, 700);
    font-size: 14px;
    color: var(--color-text, #d8d5cf);
    letter-spacing: -0.01em;
  }

  .footer-description {
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text-muted, #444440);
    line-height: var(--leading-normal, 1.6);
    margin: 0;
  }

  .footer-heading {
    font-family: var(--font-mono, monospace);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--color-text-muted, #444440);
    margin: 0 0 var(--space-2, 0.5rem);
    font-weight: var(--font-weight-bold, 700);
  }

  .footer-link {
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text-secondary, #888884);
    text-decoration: none;
    transition: color var(--transition-fast, 0.1s ease);
  }

  .footer-link:hover {
    color: var(--color-text, #d8d5cf);
  }

  .footer-bottom {
    border-top: 1px solid var(--color-border, #272725);
    padding-top: var(--space-4, 1rem);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .footer-copy {
    font-size: 10px;
    font-family: var(--font-mono, monospace);
    color: var(--color-text-muted, #444440);
  }

  .footer-link-inline {
    color: var(--color-accent, #5b9cf6);
    text-decoration: none;
  }

  .footer-version {
    font-size: 10px;
    font-family: var(--font-mono, monospace);
    color: var(--color-text-muted, #444440);
  }

  @media (max-width: 768px) {
    .footer-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 480px) {
    .footer-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
