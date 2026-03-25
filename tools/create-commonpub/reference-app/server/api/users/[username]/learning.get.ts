import { getUserByUsername, getUserEnrollments, getUserCertificates } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const { username } = parseParams(event, { username: 'string' });

  const profile = await getUserByUsername(db, username);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  const [enrollments, certificates] = await Promise.all([
    getUserEnrollments(db, profile.id),
    getUserCertificates(db, profile.id),
  ]);

  return { enrollments, certificates };
});
