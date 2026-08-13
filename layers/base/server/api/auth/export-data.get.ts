import { effectivePersonaSchema, exportUserData } from '@commonpub/server';
import type { UserDataExport } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<UserDataExport> => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();

  // The EFFECTIVE persona schema, not the built-ins: a subject access request
  // must name each answer the way the person was asked for it, and an operator
  // who relabelled a question would otherwise see the built-in wording printed
  // next to their own field. `exportUserData` has no default for exactly that
  // reason, and every row exports with its raw key regardless, so a retired or
  // renamed field is never invisible.
  //
  // Not gated on `features.persona`. A subject access request is a legal
  // obligation about data already held, and switching the feature off does not
  // delete the rows; withholding their labels would only make the export harder
  // to read. When there are no persona rows this resolves an unused schema and
  // the export carries empty arrays.
  const { sections } = await effectivePersonaSchema(db, config);

  const data = await exportUserData(db, user.id, { personaSections: sections });

  const filename = `commonpub-export-${user.username}-${new Date().toISOString().split('T')[0]}.json`;

  setHeader(event, 'Content-Type', 'application/json');
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);

  return data;
});
