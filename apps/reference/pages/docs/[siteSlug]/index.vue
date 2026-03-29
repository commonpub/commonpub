<script setup lang="ts">
const route = useRoute();
const siteSlug = computed(() => route.params.siteSlug as string);

const { data: site, pending: sitePending, error: siteError, refresh: refreshSite } = useLazyFetch(() => `/api/docs/${siteSlug.value}`);
const { data: nav } = useLazyFetch(() => `/api/docs/${siteSlug.value}/nav`);
const { data: pages } = useLazyFetch(() => `/api/docs/${siteSlug.value}/pages`);

const { user } = useAuth();
const isOwner = computed(() => site.value && user.value && site.value.ownerId === user.value.id);

// Build hierarchical nav tree
interface NavTreeNode {
  id: string;
  title: string;
  slug: string;
  sortOrder: number;
  parentId: string | null;
  children: NavTreeNode[];
}

const navTree = computed<NavTreeNode[]>(() => {
  if (!pages.value) return [];
  const allPages = pages.value as Array<{ id: string; title: string; slug: string; sortOrder: number; parentId: string | null }>;
  const byParent = new Map<string | null, typeof allPages>();
  for (const p of allPages) {
    const key = p.parentId ?? null;
    const group = byParent.get(key) ?? [];
    group.push(p);
    byParent.set(key, group);
  }
  function buildChildren(parentId: string | null): NavTreeNode[] {
    const children = byParent.get(parentId) ?? [];
    return children
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(p => ({ ...p, children: buildChildren(p.id) }));
  }
  return buildChildren(null);
});

const expandedSections = ref<Set<string>>(new Set());
function toggleSection(id: string): void {
  if (expandedSections.value.has(id)) expandedSections.value.delete(id);
  else expandedSections.value.add(id);
}

// Version selector
const selectedVersion = ref('');
watch(site, (s) => {
  if (s?.versions?.length) {
    const def = s.versions.find((v: { isDefault: boolean }) => v.isDefault) ?? s.versions[0];
    if (def) selectedVersion.value = def.version;
  }
}, { immediate: true });

// Search
const searchQuery = ref('');
const searchOpen = ref(false);
const { data: searchResults, execute: executeSearch } = useFetch(
  () => `/api/docs/${siteSlug.value}/search?q=${encodeURIComponent(searchQuery.value)}`,
  { immediate: false, watch: false },
);

async function handleSearch(): Promise<void> {
  if (!searchQuery.value.trim()) {
    searchOpen.value = false;
    return;
  }
  await executeSearch();
  searchOpen.value = true;
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (q) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  if (!q.trim()) { searchOpen.value = false; return; }
  searchTimeout = setTimeout(handleSearch, 300);
});

const firstPageSlug = computed(() => {
  if (!nav.value || !(nav.value as Array<{ slug: string }>).length) return null;
  return (nav.value as Array<{ slug: string }>)[0]!.slug;
});

const sidebarOpen = ref(false);

useSeoMeta({
  title: () => site.value ? `${site.value.name} — Docs — CommonPub` : 'Docs — CommonPub',
  description: () => site.value?.description || '',
});
</script>

<template>
  <div v-if="sitePending" class="cpub-loading">Loading documentation...</div>
  <div v-else-if="siteError" class="cpub-fetch-error">
    <div class="cpub-fetch-error-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
    <div class="cpub-fetch-error-msg">Failed to load documentation site.</div>
    <button class="cpub-btn cpub-btn-sm" @click="refreshSite()">Retry</button>
  </div>
  <div class="docs-site" v-else-if="site">
    <button class="docs-mobile-toggle" @click="sidebarOpen = !sidebarOpen" aria-label="Toggle navigation">
      <i class="fa-solid fa-bars"></i>
    </button>

    <div class="docs-layout">
      <!-- LEFT SIDEBAR -->
      <aside class="docs-sidebar" :class="{ open: sidebarOpen }" aria-label="Documentation navigation">
        <div class="docs-sidebar-header">
          <span class="docs-sidebar-title-text">{{ site.name }}</span>
          <NuxtLink v-if="isOwner" :to="`/docs/${siteSlug}/edit`" class="docs-edit-link" aria-label="Edit docs">
            <i class="fa-solid fa-pen"></i>
          </NuxtLink>
        </div>

        <div v-if="site.versions?.length > 1" class="docs-version-select">
          <select v-model="selectedVersion" class="docs-version-dropdown" aria-label="Select version">
            <option v-for="v in site.versions" :key="v.id" :value="v.version">
              {{ v.version }}{{ v.isDefault ? ' (latest)' : '' }}
            </option>
          </select>
        </div>

        <div class="docs-search">
          <div class="docs-search-input-wrap">
            <i class="fa-solid fa-magnifying-glass docs-search-icon"></i>
            <input
              v-model="searchQuery"
              type="search"
              class="docs-search-input"
              placeholder="Search docs..."
              @keyup.enter="handleSearch"
              @focus="searchOpen = true"
            />
          </div>
          <div v-if="searchOpen && searchResults?.length" class="docs-search-results">
            <NuxtLink
              v-for="r in (searchResults as Array<{ id: string; title: string; slug: string }>)"
              :key="r.id"
              :to="`/docs/${siteSlug}/${r.slug}`"
              class="docs-search-result"
              @click="searchOpen = false; searchQuery = ''"
            >
              {{ r.title }}
            </NuxtLink>
          </div>
        </div>

        <nav class="docs-nav">
          <template v-for="node in navTree" :key="node.id">
            <div class="docs-nav-item">
              <div class="docs-nav-row">
                <NuxtLink :to="`/docs/${siteSlug}/${node.slug}`" class="docs-nav-link" @click="sidebarOpen = false">
                  {{ node.title }}
                </NuxtLink>
                <button
                  v-if="node.children.length"
                  class="docs-nav-toggle"
                  @click="toggleSection(node.id)"
                  :aria-expanded="expandedSections.has(node.id)"
                  aria-label="Toggle section"
                >
                  <i :class="expandedSections.has(node.id) ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right'"></i>
                </button>
              </div>
              <div v-if="node.children.length && expandedSections.has(node.id)" class="docs-nav-children">
                <NuxtLink
                  v-for="child in node.children"
                  :key="child.id"
                  :to="`/docs/${siteSlug}/${child.slug}`"
                  class="docs-nav-link docs-nav-child"
                  @click="sidebarOpen = false"
                >
                  {{ child.title }}
                </NuxtLink>
              </div>
            </div>
          </template>
          <p v-if="!navTree.length" class="docs-nav-empty">No pages yet.</p>
        </nav>
      </aside>

      <!-- MAIN: Welcome / Getting Started -->
      <main class="docs-main">
        <div class="docs-welcome">
          <h1 class="docs-welcome-title">{{ site.name }}</h1>
          <p class="docs-welcome-desc" v-if="site.description">{{ site.description }}</p>

          <div class="docs-welcome-actions" v-if="firstPageSlug">
            <NuxtLink :to="`/docs/${siteSlug}/${firstPageSlug}`" class="docs-start-btn">
              Get Started <i class="fa-solid fa-arrow-right"></i>
            </NuxtLink>
          </div>

          <!-- Page Overview -->
          <div v-if="navTree.length" class="docs-page-grid">
            <NuxtLink
              v-for="node in navTree"
              :key="node.id"
              :to="`/docs/${siteSlug}/${node.slug}`"
              class="docs-page-card"
            >
              <div class="docs-page-card-icon"><i class="fa-solid fa-file-lines"></i></div>
              <div class="docs-page-card-title">{{ node.title }}</div>
              <div v-if="node.children.length" class="docs-page-card-sub">{{ node.children.length }} sub-pages</div>
            </NuxtLink>
          </div>

          <div v-else class="docs-empty-welcome">
            <p v-if="isOwner">No pages yet. <NuxtLink :to="`/docs/${siteSlug}/edit`">Add your first page</NuxtLink>.</p>
            <p v-else>This documentation site has no pages yet.</p>
          </div>
        </div>
      </main>
    </div>
  </div>
  <div v-else class="docs-not-found"><h1>Documentation site not found</h1></div>
</template>

<style scoped>
.docs-site { max-width: 100%; min-height: calc(100vh - 48px); }
.docs-layout { display: grid; grid-template-columns: 240px 1fr; gap: 0; min-height: calc(100vh - 48px); }

/* SIDEBAR — shared styles with page reader */
.docs-sidebar {
  border-right: 2px solid var(--border);
  padding: 16px 0;
  overflow-y: auto;
  height: calc(100vh - 48px);
  position: sticky;
  top: 48px;
  background: var(--surface);
}

.docs-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 12px;
  border-bottom: 2px solid var(--border);
  margin-bottom: 12px;
}

.docs-sidebar-title-text { font-size: 13px; font-weight: 700; color: var(--text); letter-spacing: -0.01em; }
.docs-edit-link { font-size: 11px; color: var(--text-faint); text-decoration: none; padding: 2px 6px; border: 2px solid var(--border2); }
.docs-edit-link:hover { color: var(--accent); border-color: var(--accent); }

.docs-version-select { padding: 0 16px 12px; }
.docs-version-dropdown { width: 100%; padding: 5px 8px; font-size: 11px; font-family: var(--font-mono); border: 2px solid var(--border); background: var(--surface); color: var(--text-dim); cursor: pointer; }
.docs-version-dropdown:focus { border-color: var(--accent); outline: none; }

.docs-search { padding: 0 16px 12px; position: relative; }
.docs-search-input-wrap { position: relative; }
.docs-search-icon { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); font-size: 10px; color: var(--text-faint); }
.docs-search-input { width: 100%; padding: 6px 8px 6px 26px; font-size: 12px; border: 2px solid var(--border); background: var(--surface); color: var(--text); }
.docs-search-input::placeholder { color: var(--text-faint); }
.docs-search-input:focus { border-color: var(--accent); outline: none; }
.docs-search-results { position: absolute; top: 100%; left: 16px; right: 16px; background: var(--surface); border: 2px solid var(--border); box-shadow: var(--shadow-md); z-index: 50; max-height: 200px; overflow-y: auto; }
.docs-search-result { display: block; padding: 8px 12px; font-size: 12px; color: var(--text-dim); text-decoration: none; border-bottom: 2px solid var(--border2); }
.docs-search-result:last-child { border-bottom: none; }
.docs-search-result:hover { background: var(--surface2); color: var(--accent); }

.docs-nav { padding: 0; }
.docs-nav-item { border-bottom: 2px solid var(--border2); }
.docs-nav-item:last-child { border-bottom: none; }
.docs-nav-row { display: flex; align-items: center; }
.docs-nav-link { flex: 1; display: block; padding: 7px 16px; font-size: 13px; color: var(--text-dim); text-decoration: none; line-height: 1.4; }
.docs-nav-link:hover { color: var(--text); background: var(--surface2); }
.docs-nav-toggle { padding: 6px 12px; background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 9px; }
.docs-nav-toggle:hover { color: var(--text-dim); }
.docs-nav-children { padding-left: 12px; border-top: 2px solid var(--border2); }
.docs-nav-child { font-size: 12px; padding: 5px 16px; }
.docs-nav-empty { color: var(--text-faint); font-size: 12px; padding: 16px; }

/* MAIN: Welcome */
.docs-main { padding: 40px; }

.docs-welcome { max-width: 720px; }

.docs-welcome-title {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.03em;
  margin-bottom: 12px;
  line-height: 1.15;
}

.docs-welcome-desc {
  font-size: 15px;
  color: var(--text-dim);
  line-height: 1.7;
  margin-bottom: 24px;
  max-width: 560px;
}

.docs-welcome-actions { margin-bottom: 40px; }

.docs-start-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  background: var(--accent);
  color: var(--color-text-inverse);
  border: 2px solid var(--border);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  box-shadow: var(--shadow-md);
  transition: box-shadow 0.15s, transform 0.15s;
}

.docs-start-btn:hover {
  box-shadow: var(--shadow-sm);
  transform: translate(1px, 1px);
}

.docs-page-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.docs-page-card {
  padding: 16px;
  border: 2px solid var(--border);
  background: var(--surface);
  text-decoration: none;
  color: var(--text);
  box-shadow: var(--shadow-md);
  transition: box-shadow 0.15s, transform 0.15s;
}

.docs-page-card:hover {
  box-shadow: var(--shadow-sm);
  transform: translate(1px, 1px);
}

.docs-page-card-icon { font-size: 16px; color: var(--accent); margin-bottom: 8px; }
.docs-page-card-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
.docs-page-card-sub { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); }

.docs-empty-welcome { color: var(--text-faint); font-size: 13px; }
.docs-empty-welcome a { color: var(--accent); }

.docs-not-found { text-align: center; padding: 64px 0; color: var(--text-dim); }

.docs-mobile-toggle {
  display: none;
  position: fixed;
  bottom: 16px;
  right: 16px;
  width: 44px;
  height: 44px;
  background: var(--accent);
  color: var(--color-text-inverse);
  border: 2px solid var(--border);
  box-shadow: var(--shadow-md);
  font-size: 16px;
  cursor: pointer;
  z-index: 100;
  align-items: center;
  justify-content: center;
}

@media (max-width: 768px) {
  .docs-mobile-toggle { display: flex; }
  .docs-layout { grid-template-columns: 1fr; }
  .docs-sidebar {
    position: fixed;
    left: -280px;
    top: 48px;
    width: 280px;
    height: calc(100vh - 48px);
    z-index: 90;
    transition: left 0.2s ease;
  }
  .docs-sidebar.open { left: 0; box-shadow: var(--shadow-md); }
  .docs-main { padding: 20px 16px; }
}
</style>
