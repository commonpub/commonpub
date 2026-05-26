/**
 * Import / export helpers for custom themes. Versioned JSON format so a
 * future breaking change can be detected and either migrated or rejected.
 *
 * Exported files are named `<theme-id>.cpub-theme.json`.
 */
import type { CustomThemeRecord } from '../types/theme';

const EXPORT_FORMAT_VERSION = 1 as const;

export interface ThemeExportFile {
  filename: string;
  content: string;
}

/** Serialize a theme to a downloadable file payload. */
export function buildExportFile(theme: CustomThemeRecord): ThemeExportFile {
  const body = {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    theme,
  };
  return {
    filename: `${theme.id}.cpub-theme.json`,
    content: JSON.stringify(body, null, 2),
  };
}

/**
 * Parse a theme export file. Throws a human-readable error for any
 * recoverable failure (invalid JSON, missing fields, wrong version).
 */
export function parseExportFile(text: string): CustomThemeRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Expected an object');
  const p = parsed as Record<string, unknown>;
  if (p.formatVersion !== EXPORT_FORMAT_VERSION) {
    throw new Error(`Unsupported export format version: ${String(p.formatVersion)}`);
  }
  if (!p.theme || typeof p.theme !== 'object') throw new Error('Missing `theme` payload');
  const t = p.theme as Record<string, unknown>;
  if (typeof t.id !== 'string' || typeof t.name !== 'string' || typeof t.family !== 'string') {
    throw new Error('Theme payload missing required fields');
  }
  return {
    id: String(t.id),
    name: String(t.name),
    description: typeof t.description === 'string' ? t.description : '',
    family: String(t.family),
    isDark: Boolean(t.isDark),
    pairId: typeof t.pairId === 'string' ? t.pairId : undefined,
    parentTheme: typeof t.parentTheme === 'string' ? t.parentTheme : 'base',
    tokens: (typeof t.tokens === 'object' && t.tokens !== null ? t.tokens : {}) as Record<string, string>,
    createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
    updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : new Date().toISOString(),
  };
}

/**
 * Trigger a download of an export file. Browser-only — the caller is
 * responsible for skipping this on the server.
 */
export function downloadThemeFile(theme: CustomThemeRecord): void {
  const { filename, content } = buildExportFile(theme);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
