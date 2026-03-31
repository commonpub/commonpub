import { getCertificateByCode } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const { code } = parseParams(event, { code: 'string' });

  const result = await getCertificateByCode(db, code);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Certificate not found' });
  }

  return result;
});
