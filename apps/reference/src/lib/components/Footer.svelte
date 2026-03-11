<footer class="footer">
  <div class="footer-inner">
    <div class="footer-grid">
      <div class="footer-col">
        <span class="footer-brand">snaplify</span>
        <p class="footer-description">
          Open ActivityPub federation protocol for self-hosted maker communities.
        </p>
      </div>

      <div class="footer-col">
        <h4 class="footer-heading">Product</h4>
        <a href="/projects" class="footer-link">Projects</a>
        <a href="/learn" class="footer-link">Learn</a>
        <a href="/explainers" class="footer-link">Explainers</a>
        <a href="/communities" class="footer-link">Communities</a>
      </div>

      <div class="footer-col">
        <h4 class="footer-heading">Community</h4>
        <a href="/blog" class="footer-link">Blog</a>
        <a href="/articles" class="footer-link">Articles</a>
        <a href="/feed" class="footer-link">Feed</a>
      </div>

      <div class="footer-col">
        <h4 class="footer-heading">Developers</h4>
        <a href="/docs" class="footer-link">Documentation</a>
        <a href="https://github.com/snaplify" class="footer-link" target="_blank" rel="noopener">GitHub</a>
      </div>
    </div>

    <div class="footer-bottom">
      <span class="footer-copy">Powered by <a href="https://snaplify.dev" class="footer-link-inline">Snaplify</a></span>
    </div>
  </div>
</footer>

<style>
  .footer {
    border-top: 1px solid var(--color-border, #272725);
    background: var(--color-surface, #0c0c0b);
    padding: var(--space-12, 3rem) var(--space-4, 1rem) var(--space-6, 1.5rem);
    margin-top: auto;
  }

  .footer-inner {
    max-width: var(--content-max-width, 75rem);
    margin: 0 auto;
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
    font-size: var(--text-md, 1rem);
    color: var(--color-text, #d8d5cf);
    letter-spacing: 0.02em;
  }

  .footer-description {
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text-muted, #444440);
    line-height: var(--leading-normal, 1.6);
    margin: 0;
  }

  .footer-heading {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.6875rem);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-text-secondary, #888884);
    margin: 0 0 var(--space-2, 0.5rem);
    font-weight: var(--font-weight-semibold, 600);
  }

  .footer-link {
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text-muted, #444440);
    text-decoration: none;
    transition: color var(--transition-fast, 0.1s ease);
  }

  .footer-link:hover {
    color: var(--color-text, #d8d5cf);
  }

  .footer-bottom {
    border-top: 1px solid var(--color-border, #272725);
    padding-top: var(--space-4, 1rem);
  }

  .footer-copy {
    font-size: var(--text-xs, 0.6875rem);
    color: var(--color-text-muted, #444440);
  }

  .footer-link-inline {
    color: var(--color-primary, #5b9cf6);
    text-decoration: none;
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
