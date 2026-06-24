<script setup lang="ts">
/**
 * Admin-shell preview. Renders a fake topbar + sidebar + stat dashboard
 * + table so admins can preview what the panel they're using right now
 * will look like with the in-progress theme applied.
 */
</script>

<template>
  <div class="scene-admin">
    <header class="scene-admin-top">
      <span class="scene-admin-brand">{{ '{ Instance Name }' }}</span>
      <span class="scene-admin-badge">Admin</span>
      <span class="scene-admin-back">← Back to site</span>
    </header>

    <div class="scene-admin-body">
      <nav class="scene-admin-side">
        <a class="scene-admin-link"><i class="fa-solid fa-gauge" aria-hidden="true" />Dashboard</a>
        <a class="scene-admin-link"><i class="fa-solid fa-users" aria-hidden="true" />Users</a>
        <a class="scene-admin-link"><i class="fa-solid fa-newspaper" aria-hidden="true" />Content</a>
        <a class="scene-admin-link active"><i class="fa-solid fa-palette" aria-hidden="true" />Theme</a>
        <a class="scene-admin-link"><i class="fa-solid fa-globe" aria-hidden="true" />Federation</a>
        <a class="scene-admin-link"><i class="fa-solid fa-toggle-on" aria-hidden="true" />Features</a>
      </nav>

      <main class="scene-admin-main">
        <h1 class="scene-admin-title">Instance overview</h1>
        <p class="scene-admin-sub">Snapshot of activity across this CommonPub instance.</p>

        <div class="scene-admin-stats">
          <div class="scene-admin-stat">
            <span class="scene-admin-stat-label">Members</span>
            <span class="scene-admin-stat-value">3,124</span>
            <span class="scene-admin-stat-delta">+18 this week</span>
          </div>
          <div class="scene-admin-stat">
            <span class="scene-admin-stat-label">Published</span>
            <span class="scene-admin-stat-value">512</span>
            <span class="scene-admin-stat-delta">+24 this week</span>
          </div>
          <div class="scene-admin-stat">
            <span class="scene-admin-stat-label">Federated</span>
            <span class="scene-admin-stat-value">87 peers</span>
            <span class="scene-admin-stat-delta tone-warn">2 retrying</span>
          </div>
          <div class="scene-admin-stat">
            <span class="scene-admin-stat-label">Storage</span>
            <span class="scene-admin-stat-value">8.2 GB</span>
            <span class="scene-admin-stat-delta">of 50 GB</span>
          </div>
        </div>

        <h2 class="scene-admin-h2">Recent reports</h2>
        <div class="scene-admin-table-wrap">
          <table class="scene-admin-table">
            <thead>
              <tr><th>Target</th><th>Reason</th><th>Reporter</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>@spam-actor@example.fed</strong></td>
                <td>Spam</td>
                <td>moheeb</td>
                <td><span class="scene-admin-pill tone-yellow">Open</span></td>
              </tr>
              <tr>
                <td>Project: "Buy followers fast"</td>
                <td>Spam</td>
                <td>aly</td>
                <td><span class="scene-admin-pill tone-green">Resolved</span></td>
              </tr>
              <tr>
                <td>Comment on "Edge AI nodes"</td>
                <td>Harassment</td>
                <td>kim</td>
                <td><span class="scene-admin-pill tone-red">Escalated</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.scene-admin {
  background: var(--bg);
  border: var(--border-width-default) solid var(--border);
  min-height: 480px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.scene-admin-top {
  height: 44px;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-4);
  background: var(--surface);
  border-bottom: var(--border-width-default) solid var(--border);
}
.scene-admin-brand { font-weight: var(--font-weight-bold); color: var(--text); }
.scene-admin-badge {
  padding: 2px 8px;
  background: var(--accent);
  color: var(--color-on-accent);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
}
.scene-admin-back { margin-left: auto; color: var(--text-dim); font-size: var(--text-sm); }

.scene-admin-body { display: flex; flex: 1; min-height: 0; }
.scene-admin-side {
  width: 180px;
  padding: var(--space-3) var(--space-2);
  background: var(--surface);
  border-right: var(--border-width-default) solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.scene-admin-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px var(--space-3);
  color: var(--text-dim);
  font-size: var(--text-sm);
  cursor: pointer;
  text-decoration: none;
}
.scene-admin-link i { width: 14px; text-align: center; font-size: 11px; }
.scene-admin-link:hover { color: var(--text); background: var(--surface2); }
.scene-admin-link.active { color: var(--accent); background: var(--accent-bg); font-weight: var(--font-weight-semibold); }

.scene-admin-main { flex: 1; padding: var(--space-5); min-width: 0; }
.scene-admin-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); color: var(--text); margin: 0 0 var(--space-1); }
.scene-admin-sub { color: var(--text-dim); margin: 0 0 var(--space-5); }

.scene-admin-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}
.scene-admin-stat {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-shadow: var(--shadow-sm);
}
.scene-admin-stat-label { font-family: var(--font-mono); font-size: var(--text-label); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--text-dim); }
.scene-admin-stat-value { font-size: var(--text-xl); font-weight: var(--font-weight-bold); color: var(--text); }
.scene-admin-stat-delta { font-size: var(--text-sm); color: var(--green-text); }
.scene-admin-stat-delta.tone-warn { color: var(--yellow-text); }

.scene-admin-h2 { font-size: var(--text-md); font-weight: var(--font-weight-semibold); color: var(--text); margin: 0 0 var(--space-2); }
.scene-admin-table-wrap { background: var(--surface); border: var(--border-width-default) solid var(--border); overflow: hidden; }
.scene-admin-table { width: 100%; border-collapse: collapse; }
.scene-admin-table th, .scene-admin-table td { padding: var(--space-2) var(--space-3); border-bottom: var(--border-width-thin) solid var(--border2); text-align: left; font-size: var(--text-sm); color: var(--text); }
.scene-admin-table th { font-family: var(--font-mono); font-size: var(--text-label); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--text-dim); background: var(--surface2); }
.scene-admin-table tr:last-child td { border-bottom: 0; }
.scene-admin-pill {
  display: inline-block;
  padding: 1px 8px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  border: var(--border-width-thin) solid var(--border2);
}
.scene-admin-pill.tone-green { color: var(--green-text); background: var(--green-bg); border-color: var(--green-border); }
.scene-admin-pill.tone-yellow { color: var(--yellow-text); background: var(--yellow-bg); border-color: var(--yellow-border); }
.scene-admin-pill.tone-red { color: var(--red-text); background: var(--red-bg); border-color: var(--red-border); }

@media (max-width: 540px) {
  .scene-admin-side { width: 50px; }
  .scene-admin-link span { display: none; }
}
</style>
