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
    border: var(--border-width-thin, 1px) solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-lg, 0.5rem);
    background: var(--color-surface-raised, #fff);
    font-family: var(--font-body, sans-serif);
  }

  .admin-report-card--pending {
    border-left: 3px solid var(--color-warning, #f59e0b);
  }

  .admin-report-card--resolved {
    border-left: 3px solid var(--color-success, #22c55e);
  }

  .admin-report-card--dismissed {
    border-left: 3px solid var(--color-text-muted, #888);
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
    font-size: var(--text-xs, 0.6875rem);
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text-secondary, #555);
    text-transform: uppercase;
  }

  .admin-report-card__meta {
    display: flex;
    gap: var(--space-3, 0.75rem);
    font-size: var(--text-xs, 0.6875rem);
    color: var(--color-text-muted, #888);
    margin-bottom: var(--space-2, 0.5rem);
  }

  .admin-report-card__description {
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text-secondary, #555);
    margin: var(--space-2, 0.5rem) 0;
  }

  .admin-report-card__actions {
    display: flex;
    gap: var(--space-2, 0.5rem);
    margin-top: var(--space-3, 0.75rem);
  }

  .admin-report-card__btn {
    padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
    font-family: var(--font-body, sans-serif);
    font-size: var(--text-sm, 0.75rem);
    font-weight: var(--font-weight-medium, 500);
    border: var(--border-width-thin, 1px) solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-md, 0.25rem);
    cursor: pointer;
    background: var(--color-surface, #fff);
    color: var(--color-text, #d8d5cf);
  }

  .admin-report-card__btn:focus {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .admin-report-card__btn--resolve {
    background: var(--color-success, #22c55e);
    color: var(--color-text-inverse, #fff);
    border-color: var(--color-success, #22c55e);
  }

  .admin-report-card__btn--dismiss {
    background: var(--color-surface-alt, #f8f9fa);
    color: var(--color-text-secondary, #555);
  }
</style>
