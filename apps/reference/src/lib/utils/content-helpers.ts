const TYPE_TO_URL: Record<string, string> = {
  project: 'projects',
  article: 'articles',
  guide: 'guides',
  blog: 'blog',
  explainer: 'explainers',
};

const URL_TO_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_TO_URL).map(([k, v]) => [v, k]),
);

export function typeToUrlSegment(type: string): string {
  return TYPE_TO_URL[type] ?? type;
}

export function urlSegmentToType(segment: string): string {
  return URL_TO_TYPE[segment] ?? segment;
}

export function estimateReadingTime(wordCount: number): string {
  const minutes = Math.max(1, Math.ceil(wordCount / 200));
  return `${minutes} min read`;
}
