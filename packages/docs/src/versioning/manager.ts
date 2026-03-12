import type { VersionInfo, DocsPage } from '../types.js';

const SEMVER_REGEX = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-(.+))?$/;
const NAMED_VERSIONS = ['latest', 'main', 'next', 'stable', 'canary'];

/**
 * Validate that a version string is acceptable (semver-like or named).
 */
export function validateVersionString(version: string): boolean {
  if (!version || version.length > 32) return false;
  if (NAMED_VERSIONS.includes(version.toLowerCase())) return true;
  return SEMVER_REGEX.test(version);
}

/**
 * Compare two version strings for sorting. Named versions sort before semver.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
export function compareVersions(a: string, b: string): number {
  const aParts = parseVersion(a);
  const bParts = parseVersion(b);

  // Named versions sort after semver
  if (!aParts && !bParts) return a.localeCompare(b);
  if (!aParts) return 1;
  if (!bParts) return -1;

  for (let i = 0; i < 3; i++) {
    const diff = aParts[i]! - bParts[i]!;
    if (diff !== 0) return diff;
  }

  return 0;
}

function parseVersion(version: string): [number, number, number] | null {
  const match = version.match(SEMVER_REGEX);
  if (!match) return null;
  return [parseInt(match[1]!, 10), parseInt(match[2] ?? '0', 10), parseInt(match[3] ?? '0', 10)];
}

/**
 * Select the default version from a list. Returns the one marked isDefault,
 * or falls back to the latest by version comparison.
 */
export function selectDefaultVersion(versions: VersionInfo[]): VersionInfo | null {
  if (versions.length === 0) return null;

  const defaultVersion = versions.find((v) => v.isDefault);
  if (defaultVersion) return defaultVersion;

  // Fall back to latest by version comparison
  return [...versions].sort((a, b) => compareVersions(b.version, a.version))[0]!;
}

/**
 * Prepare page objects for insertion when copying pages to a new version.
 */
export function prepareVersionCopy(
  sourcePages: DocsPage[],
  newVersionId: string,
): Array<{
  versionId: string;
  title: string;
  slug: string;
  content: string;
  sortOrder: number;
  parentId: string | null;
}> {
  // Build a map from old page IDs to stable indices for parentId remapping
  const oldIdToIndex = new Map<string, number>();
  sourcePages.forEach((page, i) => oldIdToIndex.set(page.id, i));

  // First pass: create pages without parentId
  const newPages = sourcePages.map((page) => ({
    versionId: newVersionId,
    title: page.title,
    slug: page.slug,
    content: page.content,
    sortOrder: page.sortOrder,
    parentId: null as string | null,
  }));

  // parentId remapping happens at the DB layer after insertion
  // We return pages with parentId as null; caller must remap after insert

  return newPages;
}
