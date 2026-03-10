<script lang="ts">
  let {
    title,
    description = '',
    type = 'article',
    url = '',
    image = null,
    authorName = '',
    publishedAt = null,
    updatedAt = null,
  }: {
    title: string;
    description?: string;
    type?: string;
    url?: string;
    image?: string | null;
    authorName?: string;
    publishedAt?: string | null;
    updatedAt?: string | null;
  } = $props();

  const pageTitle = `${title} — Snaplify`;
  const jsonLdType = type === 'project' ? 'HowTo' : 'Article';

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': jsonLdType,
    ...(jsonLdType === 'Article'
      ? {
          headline: title,
          author: { '@type': 'Person', name: authorName },
          ...(publishedAt ? { datePublished: publishedAt } : {}),
          ...(updatedAt ? { dateModified: updatedAt } : {}),
          description,
          ...(image ? { image } : {}),
        }
      : {
          name: title,
          description,
          ...(image ? { image } : {}),
        }),
  });
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={description} />

  <!-- Open Graph -->
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:type" content="article" />
  {#if url}<meta property="og:url" content={url} />{/if}
  {#if image}<meta property="og:image" content={image} />{/if}

  <!-- Twitter Card -->
  <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  {#if image}<meta name="twitter:image" content={image} />{/if}

  <!-- Canonical -->
  {#if url}<link rel="canonical" href={url} />{/if}

  <!-- JSON-LD -->
  {@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>
