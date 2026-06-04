<script setup lang="ts">
/**
 * /admin/layouts — list page.
 *
 * Phase 3a.2. Lists all layouts via GET /api/admin/layouts (gated on
 * admin + layoutEngine). Rows: scope label, name, state pill, last
 * updated, actions (edit, delete). Click a row → /admin/layouts/[id].
 *
 * Creation flow lives on the editor page; this page is read + delete
 * only for v1. New layouts come from:
 *   - the homepage migration (POST /api/admin/layouts/migrate-homepage)
 *   - the custom-page wizard (Phase 2 catch-all — POST /api/admin/layouts)
 * Both already exist server-side; the editor pages 3a.3+ will surface them.
 */
import type { LayoutRecord } from '@commonpub/server';

definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin-layouts'],
});
useSeoMeta({ title: `Layouts, Admin, ${useSiteName()}` });

const toast = useToast();
const { data: layouts, refresh, pending } = await useFetch<LayoutRecord[]>(
  '/api/admin/layouts',
);

function scopeLabel(scope: LayoutRecord['scope']): string {
  if (scope.type === 'route') return scope.path;
  if (scope.type === 'custom-page') return scope.path;
  return `virtual:${scope.key}`;
}

function scopeKind(scope: LayoutRecord['scope']): string {
  if (scope.type === 'route') return 'Route';
  if (scope.type === 'custom-page') return 'Custom page';
  return 'Virtual';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

// Round-3 audit fix: real migration trigger (was a misleading link to
// the legacy editor). Wires POST /api/admin/layouts/migrate-homepage.
const migrating = ref<boolean>(false);

async function migrateHomepage(): Promise<void> {
  if (migrating.value) return;
  migrating.value = true;
  try {
    const result = await $fetch<{ migrated: boolean; reason?: string; layoutId?: string }>(
      '/api/admin/layouts/migrate-homepage',
      { method: 'POST', body: {} },
    );
    if (result.migrated) {
      toast.success('Homepage migrated to layout engine');
      await refresh();
    } else if (result.reason === 'layout-already-exists') {
      toast.show('A homepage layout already exists, opening it');
      await refresh();
    } else {
      toast.show(result.reason ?? 'Migration finished');
      await refresh();
    }
  } catch (err) {
    const e = err as { statusMessage?: string; message?: string };
    toast.error(e.statusMessage ?? e.message ?? 'Migration failed');
  } finally {
    migrating.value = false;
  }
}

async function deleteLayout(layout: LayoutRecord): Promise<void> {
  if (
    !confirm(
      `Delete layout "${layout.name}" (${scopeLabel(layout.scope)})?\n\nThis cannot be undone. If a route, the page falls back to its legacy renderer.`,
    )
  ) {
    return;
  }
  // R4 audit P1 fix: homepage scope gets an extra confirm + the special
  // X-Cpub-Confirm-Homepage-Delete header (the API refuses without it).
  // Two prompts is intentional — deleting the homepage layout nukes
  // its entire publish history.
  const isHomepage =
    layout.scope.type === 'route' && layout.scope.path === '/';
  const headers: Record<string, string> = {};
  if (isHomepage) {
    if (
      !confirm(
        'You are deleting the HOMEPAGE layout. This destroys all publish history. The homepage will fall back to the legacy renderer until re-migrated. Continue?',
      )
    ) {
      return;
    }
    headers['X-Cpub-Confirm-Homepage-Delete'] = '1';
  }
  try {
    await $fetch(`/api/admin/layouts/${layout.id}`, { method: 'DELETE', headers });
    toast.success('Layout deleted');
    await refresh();
  } catch (err) {
    const e = err as { statusMessage?: string; message?: string };
    toast.error(e.statusMessage ?? e.message ?? 'Failed to delete layout');
  }
}

// Sort: routes first (by path), then custom-pages, then virtuals.
const sortedLayouts = computed<LayoutRecord[]>(() => {
  if (!layouts.value) return [];
  const buckets: Record<'route' | 'custom-page' | 'virtual', LayoutRecord[]> = {
    'route': [],
    'custom-page': [],
    'virtual': [],
  };
  for (const l of layouts.value) buckets[l.scope.type].push(l);
  for (const arr of Object.values(buckets)) {
    arr.sort((a, b) => scopeLabel(a.scope).localeCompare(scopeLabel(b.scope)));
  }
  return [...buckets.route, ...buckets['custom-page'], ...buckets.virtual];
});
</script>

<template>
  <div class="cpub-admin-layouts">
    <header class="cpub-admin-layouts-header">
      <div>
        <h1 class="cpub-admin-layouts-title">Layouts</h1>
        <p class="cpub-admin-layouts-subtitle">
          Visual editor for every route, custom page, and virtual zone on this instance.
        </p>
      </div>
    </header>

    <div v-if="pending" class="cpub-admin-layouts-loading">
      <i class="fa-solid fa-circle-notch fa-spin"></i> Loading layouts…
    </div>

    <template v-else-if="sortedLayouts.length === 0">
      <!--
        Empty state, single icon + headline + one-line description +
        single primary action, per Carbon + Mobbin SaaS empty-state
        synthesis. Skipping illustration on purpose: the sharp-corner +
        mono UI label aesthetic reads as intentional with just text.

        Round-3 audit fix: the primary CTA now actually fires the
        migration endpoint (POST /api/admin/layouts/migrate-homepage)
        instead of misleading-linking to the legacy /admin/homepage editor.
      -->
      <div class="cpub-admin-layouts-empty">
        <i class="fa-regular fa-folder-open cpub-admin-layouts-empty-icon" aria-hidden="true"></i>
        <h2 class="cpub-admin-layouts-empty-text">No layouts yet</h2>
        <p class="cpub-admin-layouts-empty-hint">
          Layouts arrange sections, hero, feed, blocks, into reusable page templates.
          Start by migrating your existing homepage from the legacy editor.
        </p>
        <button
          type="button"
          class="cpub-admin-layouts-empty-cta"
          :disabled="migrating"
          @click="migrateHomepage"
        >
          <i
            :class="migrating
              ? 'fa-solid fa-circle-notch fa-spin'
              : 'fa-solid fa-house-circle-check'"
            aria-hidden="true"
          ></i>
          <span>{{ migrating ? 'Migrating…' : 'Migrate homepage to layout' }}</span>
        </button>
        <p class="cpub-admin-layouts-empty-secondary">
          Or
          <NuxtLink to="/admin/homepage" class="cpub-admin-layouts-empty-link">edit the legacy homepage</NuxtLink>
          first.
        </p>
      </div>
    </template>

    <template v-else>
      <table class="cpub-admin-layouts-table">
        <thead>
          <tr>
            <th>Scope</th>
            <th>Name</th>
            <th>State</th>
            <th>Last updated</th>
            <th class="cpub-admin-layouts-actions-col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="layout in sortedLayouts" :key="layout.id">
            <td>
              <span class="cpub-admin-layouts-scope-kind">{{ scopeKind(layout.scope) }}</span>
              <code class="cpub-admin-layouts-scope-label">{{ scopeLabel(layout.scope) }}</code>
            </td>
            <td>{{ layout.name }}</td>
            <td>
              <span
                class="cpub-admin-layouts-state"
                :data-state="layout.state"
              >{{ layout.state }}</span>
            </td>
            <td>{{ formatDate(layout.updatedAt) }}</td>
            <td>
              <div class="cpub-admin-layouts-actions">
                <NuxtLink
                  :to="`/admin/layouts/${layout.id}`"
                  class="cpub-admin-layouts-btn"
                  :aria-label="`Edit layout ${layout.name}`"
                >
                  <i class="fa-solid fa-pen"></i>
                  <span>Edit</span>
                </NuxtLink>
                <button
                  type="button"
                  class="cpub-admin-layouts-btn cpub-admin-layouts-btn--danger"
                  :aria-label="`Delete layout ${layout.name}`"
                  @click="deleteLayout(layout)"
                >
                  <i class="fa-solid fa-trash"></i>
                  <span>Delete</span>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<style scoped>
.cpub-admin-layouts { display: flex; flex-direction: column; gap: var(--space-6); }
.cpub-admin-layouts-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-4); flex-wrap: wrap; }
.cpub-admin-layouts-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); margin: 0 0 var(--space-2) 0; }
.cpub-admin-layouts-subtitle { color: var(--text-dim); margin: 0; }

.cpub-admin-layouts-loading {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-8); color: var(--text-faint);
}

.cpub-admin-layouts-empty {
  display: flex; flex-direction: column; align-items: center;
  gap: var(--space-3); padding: var(--space-10) var(--space-6);
  background: var(--surface2); border: var(--border-width-default) solid var(--border2);
  max-width: 560px;
  margin: 0 auto;
  text-align: center;
}
.cpub-admin-layouts-empty-icon { font-size: var(--text-3xl); color: var(--text-faint); }
.cpub-admin-layouts-empty-text {
  font-size: var(--text-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text);
  margin: 0;
}
.cpub-admin-layouts-empty-hint { color: var(--text-dim); margin: 0 0 var(--space-2) 0; max-width: 44ch; }
.cpub-admin-layouts-empty-cta {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--accent);
  border: var(--border-width-default) solid var(--accent);
  color: var(--surface);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  text-decoration: none;
  margin-top: var(--space-2);
}
.cpub-admin-layouts-empty-cta:hover:not(:disabled) { filter: brightness(1.1); }
.cpub-admin-layouts-empty-cta:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cpub-admin-layouts-empty-cta:disabled { opacity: 0.6; cursor: not-allowed; }

.cpub-admin-layouts-empty-secondary {
  margin: var(--space-2) 0 0 0;
  font-size: var(--text-sm);
  color: var(--text-faint);
}
.cpub-admin-layouts-empty-link { color: var(--accent); text-decoration: underline; }

.cpub-admin-layouts-table {
  width: 100%; border-collapse: collapse;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
}
.cpub-admin-layouts-table th,
.cpub-admin-layouts-table td {
  padding: var(--space-3) var(--space-4);
  text-align: left;
  border-bottom: 1px solid var(--border2);
  vertical-align: middle;
}
.cpub-admin-layouts-table th {
  background: var(--surface2);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--text-dim);
  font-weight: var(--font-weight-semibold);
}
.cpub-admin-layouts-table tbody tr:hover { background: var(--surface2); }
.cpub-admin-layouts-table tbody tr:last-child td { border-bottom: 0; }

.cpub-admin-layouts-scope-kind {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--text-faint);
  margin-right: var(--space-2);
}
.cpub-admin-layouts-scope-label {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text);
}

.cpub-admin-layouts-state {
  display: inline-block;
  padding: 2px var(--space-2);
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  border: 1px solid var(--border2);
}
.cpub-admin-layouts-state[data-state='published'] { color: var(--accent); border-color: var(--accent); }
.cpub-admin-layouts-state[data-state='draft'] { color: var(--text-dim); }

.cpub-admin-layouts-actions-col { width: 220px; }
.cpub-admin-layouts-actions { display: flex; gap: var(--space-2); }

.cpub-admin-layouts-btn {
  display: inline-flex; align-items: center; gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  text-decoration: none;
  cursor: pointer;
}
.cpub-admin-layouts-btn:hover { background: var(--surface2); }
.cpub-admin-layouts-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cpub-admin-layouts-btn--danger:hover { color: var(--red); border-color: var(--red); }
</style>
