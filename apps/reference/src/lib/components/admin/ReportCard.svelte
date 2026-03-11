<script lang="ts">
  interface Report {
    id: string;
    targetType: string;
    targetId: string;
    reason: string;
    description: string | null;
    status: string;
    reporter: { id: string; username: string };
    createdAt: Date;
  }

  interface Props {
    report: Report;
    class?: string;
    onResolve?: (reportId: string) => void;
    onDismiss?: (reportId: string) => void;
  }

  let { report, class: className = '', onResolve, onDismiss }: Props = $props();
</script>

<article
  class={['admin-report-card', `admin-report-card--${report.status}`, className]
    .filter(Boolean)
    .join(' ')}
  aria-label={`Report: ${report.reason} on ${report.targetType}`}
>
  <div class="admin-report-card__header">
    <span class="admin-report-card__reason">{report.reason}</span>
    <span class="admin-report-card__status">{report.status}</span>
  </div>

  <div class="admin-report-card__meta">
    <span>Target: {report.targetType} ({report.targetId.slice(0, 8)}...)</span>
    <span>Reported by: {report.reporter.username}</span>
    <time datetime={new Date(report.createdAt).toISOString()}>
      {new Date(report.createdAt).toLocaleDateString()}
    </time>
  </div>

  {#if report.description}
    <p class="admin-report-card__description">{report.description}</p>
  {/if}

  {#if report.status === 'pending'}
    <div class="admin-report-card__actions">
      <button
        type="button"
        class="admin-report-card__btn admin-report-card__btn--resolve"
        aria-label={`Resolve report ${report.id}`}
        onclick={() => onResolve?.(report.id)}
      >
        Resolve
      </button>
      <button
        type="button"
        class="admin-report-card__btn admin-report-card__btn--dismiss"
        aria-label={`Dismiss report ${report.id}`}
        onclick={() => onDismiss?.(report.id)}
      >
        Dismiss
      </button>
    </div>
  {/if}
</article>

<style>
  .admin-report-card {
    padding: var(--space-4, 1rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    background: var(--color-surface-alt, #141413);
  }

  .admin-report-card--pending {
    border-left: 3px solid var(--color-warning, #fbbf24);
  }

  .admin-report-card--resolved {
    border-left: 3px solid var(--color-success, #4ade80);
  }

  .admin-report-card--dismissed {
    border-left: 3px solid var(--color-text-muted, #444440);
  }

  .admin-report-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-2, 0.5rem);
  }

  .admin-report-card__reason {
    font-weight: var(--font-weight-semibold, 600);
    color: var(--color-text, #d8d5cf);
    text-transform: capitalize;
  }

  .admin-report-card__status {
    font-family: var(--font-mono, monospace);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-secondary, #888884);
  }

  .admin-report-card__meta {
    display: flex;
    gap: var(--space-3, 0.75rem);
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    color: var(--color-text-muted, #444440);
    margin-bottom: var(--space-2, 0.5rem);
  }

  .admin-report-card__description {
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text-secondary, #888884);
    margin: var(--space-2, 0.5rem) 0;
    line-height: 1.5;
  }

  .admin-report-card__actions {
    display: flex;
    gap: var(--space-2, 0.5rem);
    margin-top: var(--space-3, 0.75rem);
  }

  .admin-report-card__btn {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 4px 12px;
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
  }

  .admin-report-card__btn:focus {
    outline: none;
    border-color: var(--color-accent, #5b9cf6);
  }

  .admin-report-card__btn--resolve {
    background: var(--color-success, #4ade80);
    color: var(--color-bg, #0c0c0b);
    border-color: var(--color-success, #4ade80);
  }

  .admin-report-card__btn--dismiss {
    background: transparent;
    color: var(--color-text-secondary, #888884);
  }

  .admin-report-card__btn--dismiss:hover {
    background: var(--color-surface-hover, #222220);
  }
</style>
