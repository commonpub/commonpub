// HTML sanitization for v-html bindings — defense-in-depth against stored XSS.
// Uses DOMPurify (via isomorphic-dompurify for SSR compatibility).
import DOMPurify from 'isomorphic-dompurify';

// Allow the subset of HTML that TipTap produces for block content
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- DOMPurify.Config is not directly exported
const PURIFY_CONFIG: any = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'img',
    'blockquote', 'figure', 'figcaption',
    'span', 'div', 'sub', 'sup', 'mark',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'hr',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel',
    'style', 'width', 'height', 'loading',
    'colspan', 'rowspan',
  ],
  ALLOW_DATA_ATTR: false,
};

/** Sanitize HTML for safe rendering via v-html */
export function sanitizeBlockHtml(html: string): string {
  return DOMPurify.sanitize(html, PURIFY_CONFIG) as unknown as string;
}

/** Composable wrapper for template use */
export function useSanitize(): { sanitize: (html: string) => string } {
  return { sanitize: sanitizeBlockHtml };
}
