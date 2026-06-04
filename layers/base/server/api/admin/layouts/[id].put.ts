/**
 * PUT /api/admin/layouts/[id]
 *
 * Update a layout — auto-save target for the editor. Sends the WHOLE
 * draft (zones → rows → sections); saveLayout diffs against current,
 * renumbers positions, rewrites children in a transaction.
 *
 * Scope CANNOT be changed via PUT (it's immutable per layout). A scope
 * change would mean a new layout — POST instead.
 *
 * Optimistic concurrency (Phase 3a.6): if the request includes an
 * `If-Match` header, it must equal the layout's current `updatedAt`.
 * Mismatch → 412 Precondition Failed (or 409 if we want to match
 * the editor's existing handler — RFC 7232 says 412, but pragmatic
 * web editors use 409. We follow editor convention: 409 conflict).
 * Omit the header (or pass empty string) to force an unconditional
 * write (the "overwrite" path from the conflict modal).
 *
 * Admin + features.admin + features.layoutEngine.
 * Invalidates the layouts-by-route cache on success.
 */
import { layoutCreateSchema } from '@commonpub/schema';
import { getLayoutById, saveLayout } from '@commonpub/server';
import { invalidateLayoutsByRouteCache } from '../../../utils/layoutCache';
import { validateSectionConfigs } from '../../../utils/validateSectionConfigs';

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireFeature('layoutEngine');
  const admin = requirePermission(event, 'layout.manage');
  const db = useDB();

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id param' });
  }

  const existing = await getLayoutById(db, id);
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Layout not found' });
  }

  // Optimistic concurrency check — client sends If-Match: <updatedAt>;
  // mismatch means someone else saved in between. The client's auto-save
  // catches the 409 and pops a conflict modal (3a.6).
  const ifMatch = getHeader(event, 'if-match');
  if (ifMatch && ifMatch.trim() !== '' && ifMatch !== existing.updatedAt) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Layout was modified by another session',
      data: {
        code: 'LAYOUT_CONFLICT',
        clientUpdatedAt: ifMatch,
        serverUpdatedAt: existing.updatedAt,
      },
    });
  }

  // Audit log: client signals deliberate force-save via X-Cpub-Force-Save
  // when the user clicks "Overwrite their changes" in the conflict modal.
  // Forensic trail captures who overwrote what + when (audit P2 from
  // session 160). Structured for greppability — operators can `docker
  // logs ... | grep cpub.audit.layout.force-save`.
  if (getHeader(event, 'x-cpub-force-save') === '1') {
    console.info('cpub.audit.layout.force-save', JSON.stringify({
      at: new Date().toISOString(),
      adminId: admin.id,
      layoutId: id,
      scope: existing.scope,
      previousUpdatedAt: existing.updatedAt,
    }));
  }

  const body = await parseBody(event, layoutCreateSchema);

  // Per-section configSchema enforcement (R2 P1 deferred → wired session 161
  // once schemas moved to @commonpub/schema/sectionConfigs, removing the
  // .vue transitive import that broke the Nitro bundle on the R2 attempt).
  // On failure logs an audit event + re-throws the validator's 400.
  try {
    validateSectionConfigs(body.zones);
  } catch (err) {
    const e = err as { data?: { code?: string; sectionErrors?: unknown[] } };
    if (e?.data?.code === 'SECTION_CONFIG_INVALID') {
      console.info('cpub.audit.layout.config-rejected', JSON.stringify({
        at: new Date().toISOString(),
        adminId: admin.id,
        layoutId: id,
        scope: existing.scope,
        errorCount: e.data.sectionErrors?.length ?? 0,
      }));
    }
    throw err;
  }

  // Scope is immutable — reject if the client tries to change it. This
  // catches an "edit the wrong layout" bug at the API surface rather
  // than silently moving sections to a new route.
  if (
    body.scope.type !== existing.scope.type ||
    ('path' in body.scope ? body.scope.path : body.scope.key) !==
      ('path' in existing.scope ? existing.scope.path : existing.scope.key)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot change layout scope via PUT, POST a new layout instead',
    });
  }

  const saved = await saveLayout(
    db,
    {
      scope: body.scope,
      name: body.name,
      pageMeta: body.pageMeta,
      zones: body.zones,
      state: body.state,
    },
    { id, userId: admin.id },
  );

  // Audit log: every successful update goes through cpub.audit.layout.update.
  // Per session 163 deep audit: the gap between "5 mutations should log
  // (create/update/publish/delete/migrate)" (session 160 R3 plan) and the
  // current implementation (force-save + config-rejected only) was a
  // forensic blind spot — regular auto-saves left zero trail. Operators
  // can grep + filter; the `source` header lets them separate manual saves
  // from auto-saves vs beacons vs force-saves. Default 'auto' for legacy
  // clients that don't send the header.
  const saveSource = getHeader(event, 'x-cpub-save-source') ?? 'auto';
  console.info('cpub.audit.layout.update', JSON.stringify({
    at: new Date().toISOString(),
    adminId: admin.id,
    layoutId: id,
    scope: existing.scope,
    source: saveSource,
    savedUpdatedAt: saved.updatedAt,
  }));

  invalidateLayoutsByRouteCache();
  return saved;
});
