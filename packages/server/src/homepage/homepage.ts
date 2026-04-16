import { getInstanceSetting, setInstanceSetting } from '../admin/admin.js';
import type { DB } from '../types.js';

export interface HomepageSectionConfig {
  contentType?: string;
  sort?: 'popular' | 'recent' | 'featured' | 'editorial';
  limit?: number;
  columns?: 2 | 3 | 4;
  showEditorial?: boolean;
  categorySlug?: string;
  featureGate?: string;
  variant?: string;
  customTitle?: string;
  customSubtitle?: string;
  html?: string;
}

export interface HomepageSection {
  id: string;
  type: 'hero' | 'editorial' | 'content-grid' | 'content-carousel' | 'contests' | 'hubs' | 'learning' | 'stats' | 'custom-html';
  title?: string;
  enabled: boolean;
  order: number;
  config: HomepageSectionConfig;
}

/** Default homepage sections — matches the hardcoded layout from before Phase 2 */
export const DEFAULT_SECTIONS: HomepageSection[] = [
  {
    id: 'hero',
    type: 'hero',
    title: 'Hero Banner',
    enabled: true,
    order: 0,
    config: { variant: 'default' },
  },
  {
    id: 'editorial',
    type: 'editorial',
    title: 'Staff Picks',
    enabled: true,
    order: 1,
    config: { limit: 3, featureGate: 'editorial' },
  },
  {
    id: 'content-feed',
    type: 'content-grid',
    title: 'Content Feed',
    enabled: true,
    order: 2,
    config: { sort: 'popular', limit: 12, columns: 2 },
  },
  {
    id: 'contests-sidebar',
    type: 'contests',
    title: 'Active Contests',
    enabled: true,
    order: 3,
    config: { limit: 3, featureGate: 'contests' },
  },
  {
    id: 'hubs-sidebar',
    type: 'hubs',
    title: 'Trending Hubs',
    enabled: true,
    order: 4,
    config: { limit: 4, featureGate: 'hubs' },
  },
  {
    id: 'stats',
    type: 'stats',
    title: 'Platform Stats',
    enabled: true,
    order: 5,
    config: {},
  },
];

const SETTINGS_KEY = 'homepage.sections';

/** Get homepage sections (from DB or defaults) */
export async function getHomepageSections(db: DB): Promise<HomepageSection[]> {
  const raw = await getInstanceSetting(db, SETTINGS_KEY);
  if (Array.isArray(raw) && raw.length > 0) {
    return raw as HomepageSection[];
  }
  return DEFAULT_SECTIONS;
}

/** Save homepage sections to DB */
export async function setHomepageSections(
  db: DB,
  sections: HomepageSection[],
  adminId: string,
  ip?: string,
): Promise<void> {
  await setInstanceSetting(db, SETTINGS_KEY, sections, adminId, ip);
}

/** Reset homepage to default sections */
export async function resetHomepageSections(
  db: DB,
  adminId: string,
  ip?: string,
): Promise<void> {
  await setInstanceSetting(db, SETTINGS_KEY, DEFAULT_SECTIONS, adminId, ip);
}
