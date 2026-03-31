/** Composable for adding JSON-LD structured data to pages */

interface JsonLdArticle {
  type: 'article';
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  authorName: string;
  authorUrl: string;
  publishedAt: string;
  updatedAt: string;
}

interface JsonLdHowTo {
  type: 'howto';
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  authorName: string;
  authorUrl: string;
  difficulty?: string;
  estimatedTime?: string;
  estimatedCost?: string;
  steps?: Array<{ name: string; text: string }>;
}

interface JsonLdCourse {
  type: 'course';
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  providerName: string;
  providerUrl: string;
}

interface JsonLdVideo {
  type: 'video';
  title: string;
  description: string;
  url: string;
  thumbnailUrl?: string;
  uploadDate: string;
  duration?: string;
}

interface JsonLdPerson {
  type: 'person';
  name: string;
  url: string;
  imageUrl?: string;
  description?: string;
  jobTitle?: string;
}

interface JsonLdOrganization {
  type: 'organization';
  name: string;
  url: string;
  logoUrl?: string;
  description?: string;
}

type JsonLdInput =
  | JsonLdArticle
  | JsonLdHowTo
  | JsonLdCourse
  | JsonLdVideo
  | JsonLdPerson
  | JsonLdOrganization;

function buildJsonLd(input: JsonLdInput): Record<string, unknown> {
  switch (input.type) {
    case 'article':
      return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: input.title,
        description: input.description,
        url: input.url,
        ...(input.imageUrl ? { image: input.imageUrl } : {}),
        author: {
          '@type': 'Person',
          name: input.authorName,
          url: input.authorUrl,
        },
        datePublished: input.publishedAt,
        dateModified: input.updatedAt,
      };

    case 'howto':
      return {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: input.title,
        description: input.description,
        url: input.url,
        ...(input.imageUrl ? { image: input.imageUrl } : {}),
        author: {
          '@type': 'Person',
          name: input.authorName,
          url: input.authorUrl,
        },
        ...(input.estimatedTime ? { totalTime: input.estimatedTime } : {}),
        ...(input.estimatedCost
          ? { estimatedCost: { '@type': 'MonetaryAmount', value: input.estimatedCost, currency: 'USD' } }
          : {}),
        ...(input.steps?.length
          ? {
              step: input.steps.map((s, i) => ({
                '@type': 'HowToStep',
                position: i + 1,
                name: s.name,
                text: s.text,
              })),
            }
          : {}),
      };

    case 'course':
      return {
        '@context': 'https://schema.org',
        '@type': 'Course',
        name: input.title,
        description: input.description,
        url: input.url,
        ...(input.imageUrl ? { image: input.imageUrl } : {}),
        provider: {
          '@type': 'Organization',
          name: input.providerName,
          sameAs: input.providerUrl,
        },
      };

    case 'video':
      return {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: input.title,
        description: input.description,
        url: input.url,
        ...(input.thumbnailUrl ? { thumbnailUrl: input.thumbnailUrl } : {}),
        uploadDate: input.uploadDate,
        ...(input.duration ? { duration: input.duration } : {}),
      };

    case 'person':
      return {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: input.name,
        url: input.url,
        ...(input.imageUrl ? { image: input.imageUrl } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.jobTitle ? { jobTitle: input.jobTitle } : {}),
      };

    case 'organization':
      return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: input.name,
        url: input.url,
        ...(input.logoUrl ? { logo: input.logoUrl } : {}),
        ...(input.description ? { description: input.description } : {}),
      };
  }
}

export function useJsonLd(input: JsonLdInput): void {
  const jsonLd = buildJsonLd(input);

  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(jsonLd),
      },
    ],
  });
}
