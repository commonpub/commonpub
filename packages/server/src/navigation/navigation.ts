import { getInstanceSetting, setInstanceSetting } from '../admin/admin.js';
import type { DB } from '../types.js';

export interface NavItem {
  id: string;
  type: 'link' | 'dropdown' | 'external';
  label: string;
  icon?: string;
  route?: string;
  href?: string;
  featureGate?: string;
  children?: NavItem[];
  visibleTo?: 'all' | 'authenticated' | 'admin';
  disabled?: boolean;
}

/** Default nav items — matches the hardcoded layout from before Phase 3 */
export const DEFAULT_NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    type: 'link',
    label: 'Home',
    icon: 'fa-solid fa-house',
    route: '/',
  },
  {
    id: 'learn',
    type: 'dropdown',
    label: 'Learn',
    icon: 'fa-solid fa-graduation-cap',
    children: [
      { id: 'learn-paths', type: 'link', label: 'Learning Paths', icon: 'fa-solid fa-route', route: '/learn', featureGate: 'learning' },
      { id: 'explainers', type: 'link', label: 'Explainers', icon: 'fa-solid fa-lightbulb', route: '/explainer', featureGate: 'explainers' },
      { id: 'docs', type: 'link', label: 'Docs', icon: 'fa-solid fa-book', route: '/docs', featureGate: 'docs' },
    ],
  },
  {
    id: 'build',
    type: 'dropdown',
    label: 'Build',
    icon: 'fa-solid fa-hammer',
    children: [
      { id: 'projects', type: 'link', label: 'Projects', icon: 'fa-solid fa-cube', route: '/project' },
      { id: 'contests', type: 'link', label: 'Contests', icon: 'fa-solid fa-trophy', route: '/contests', featureGate: 'contests' },
    ],
  },
  {
    id: 'read',
    type: 'dropdown',
    label: 'Read',
    icon: 'fa-solid fa-newspaper',
    children: [
      { id: 'blog', type: 'link', label: 'Blog', icon: 'fa-solid fa-pen-nib', route: '/blog' },
    ],
  },
  {
    id: 'watch',
    type: 'dropdown',
    label: 'Watch',
    icon: 'fa-solid fa-play',
    featureGate: 'video',
    children: [
      { id: 'videos', type: 'link', label: 'Videos', icon: 'fa-solid fa-video', route: '/videos' },
      { id: 'livestreams', type: 'link', label: 'Live Streams', icon: 'fa-solid fa-tower-broadcast', disabled: true },
      { id: 'podcasts', type: 'link', label: 'Podcasts', icon: 'fa-solid fa-podcast', disabled: true },
    ],
  },
  {
    id: 'hubs',
    type: 'link',
    label: 'Hubs',
    icon: 'fa-solid fa-users',
    route: '/hubs',
    featureGate: 'hubs',
  },
  {
    id: 'fediverse',
    type: 'link',
    label: 'Fediverse',
    icon: 'fa-solid fa-globe',
    route: '/federation',
    featureGate: 'federation',
  },
  {
    id: 'admin',
    type: 'link',
    label: 'Admin',
    icon: 'fa-solid fa-shield-halved',
    route: '/admin',
    featureGate: 'admin',
    visibleTo: 'admin',
  },
];

const SETTINGS_KEY = 'nav.items';

/** Get navigation items (from DB or defaults) */
export async function getNavItems(db: DB): Promise<NavItem[]> {
  const raw = await getInstanceSetting(db, SETTINGS_KEY);
  if (Array.isArray(raw) && raw.length > 0) {
    return raw as NavItem[];
  }
  return DEFAULT_NAV_ITEMS;
}

/** Save navigation items to DB */
export async function setNavItems(
  db: DB,
  items: NavItem[],
  adminId: string,
  ip?: string,
): Promise<void> {
  await setInstanceSetting(db, SETTINGS_KEY, items, adminId, ip);
}

/** Reset navigation to default items */
export async function resetNavItems(
  db: DB,
  adminId: string,
  ip?: string,
): Promise<void> {
  await setInstanceSetting(db, SETTINGS_KEY, DEFAULT_NAV_ITEMS, adminId, ip);
}
