import { parse as parseYaml } from 'yaml';
import type { PageFrontmatter } from '../types.js';

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)---\r?\n?/;

/**
 * Parse YAML frontmatter from markdown content.
 * Returns extracted frontmatter fields and the remaining content.
 */
export function parseFrontmatter(markdown: string): {
  frontmatter: PageFrontmatter;
  content: string;
} {
  const match = markdown.match(FRONTMATTER_REGEX);

  if (!match) {
    return { frontmatter: {}, content: markdown };
  }

  const yamlString = match[1]!;
  const content = markdown.slice(match[0].length).replace(/^\r?\n+/, '');

  let parsed: Record<string, unknown>;
  try {
    parsed = parseYaml(yamlString) as Record<string, unknown>;
  } catch {
    return { frontmatter: {}, content: markdown };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { frontmatter: {}, content };
  }

  const frontmatter: PageFrontmatter = {};

  if (typeof parsed.title === 'string') {
    frontmatter.title = parsed.title;
  }
  if (typeof parsed.description === 'string') {
    frontmatter.description = parsed.description;
  }
  if (typeof parsed.sidebar_label === 'string') {
    frontmatter.sidebarLabel = parsed.sidebar_label;
  }
  if (typeof parsed.sidebar_position === 'number') {
    frontmatter.sidebarPosition = parsed.sidebar_position;
  }

  return { frontmatter, content };
}
