// NodeInfo discovery endpoint
// Returns links to the NodeInfo document

export default defineEventHandler((event) => {
  const origin = getRequestURL(event).origin;

  return {
    links: [
      {
        rel: 'http://nodeinfo.diaspora.software/ns/schema/2.1',
        href: `${origin}/nodeinfo/2.1`,
      },
    ],
  };
});
