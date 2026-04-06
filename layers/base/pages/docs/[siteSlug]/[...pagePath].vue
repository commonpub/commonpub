<script setup lang="ts">
import type { TocEntry } from '@commonpub/docs';
import type { BlockTuple } from '@commonpub/editor';

const route = useRoute();
const siteSlug = computed(() => route.params.siteSlug as string);
const pagePath = computed(() => {
  const p = route.params.pagePath;
  return Array.isArray(p) ? p[p.length - 1] : p;
});

const { data: site } = useLazyFetch<{ id: string; name: string; slug: string; description: string; ownerId: string; versions: Array<{ id: string; label: string; slug: string; version: string; isDefault: boolean }> }>(() => `/api/docs/${siteSlug.value}`);
const { data: nav } = useLazyFetch<Array<{ id: string; title: string; slug: string; sortOrder: number; parentId: string | null }>>(() => `/api/docs/${siteSlug.value}/nav`);
const { data: pages } = useLazyFetch<Array<{ id: string; title: string; slug: string; sortOrder: number; parentId: string | null }>>(() => `/api/docs/${siteSlug.value}/pages`);

// Fetch the rendered page (server-side markdown rendering or block content)
interface RenderedPage {
  id: string;
  title: string;
  slug: string;
  content: string | BlockTuple[];
  sortOrder: number;
  parentId: string | null;
  html: string | null;
  toc: TocEntry[];
  frontmatter: { title?: string; description?: string };
  format?: 'blocks' | 'markdown';
}

const isBlockContent = computed(() =>
  renderedPage.value?.format === 'blocks' || Array.isArray(renderedPage.value?.content),
);

const blockContent = computed<BlockTuple[]>(() => {
  if (!renderedPage.value || !isBlockContent.value) return [];
  return renderedPage.value.content as BlockTuple[];
});

const { data: renderedPage, pending: pagePending, error: pageError, refresh: refreshPage } = useLazyFetch<RenderedPage>(
  () => `/api/docs/${siteSlug.value}/pages/${pagePath.value}`,
  { key: `doc-page-${siteSlug.value}-${pagePath.value}` },
);

const { user } = useAuth();
const isOwner = computed(() => site.value && user.value && site.value.ownerId === user.value.id);

// Build hierarchical nav tree from flat pages
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

// Expanded nav sections
const expandedSections = ref<Set<string>>(new Set());
function toggleSection(id: string): void {
  if (expandedSections.value.has(id)) {
    expandedSections.value.delete(id);
  } else {
    expandedSections.value.add(id);
  }
}

// Auto-expand parent sections of current page
watch(pagePath, () => {
  if (!pages.value) return;
  const allPages = pages.value as Array<{ id: string; slug: string; parentId: string | null }>;
  const current = allPages.find(p => p.slug === pagePath.value);
  if (current?.parentId) {
    expandedSections.value.add(current.parentId);
  }
}, { immediate: true });

// TOC from rendered page
const toc = computed<TocEntry[]>(() => renderedPage.value?.toc ?? []);
const activeHeadingId = ref('');

// Scroll spy for TOC
function setupScrollSpy(): void {
  if (!import.meta.client) return;
  const headings = document.querySelectorAll('.docs-content h2[id], .docs-content h3[id], .docs-content .cpub-block-heading[id]');
  if (!headings.length) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          activeHeadingId.value = entry.target.id;
        }
      }
    },
    { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
  );
  headings.forEach(h => observer.observe(h));
}

onMounted(() => {
  nextTick(setupScrollSpy);
});

watch(renderedPage, () => {
  nextTick(setupScrollSpy);
});

// Prev/Next links
const prevNextLinks = computed(() => {
  if (!nav.value || !renderedPage.value) return { prev: null, next: null };
  const navItems = nav.value as Array<{ id: string; slug: string; title: string }>;
  const currentSlug = pagePath.value;
  const idx = navItems.findIndex(n => n.slug === currentSlug);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? { title: navItems[idx - 1]!.title, slug: navItems[idx - 1]!.slug } : null,
    next: idx < navItems.length - 1 ? { title: navItems[idx + 1]!.title, slug: navItems[idx + 1]!.slug } : null,
  };
});

// Breadcrumbs
const breadcrumbs = computed(() => {
  if (!renderedPage.value) return [];
  const crumbs: Array<{ title: string; slug: string }> = [];
  if (renderedPage.value.parentId && pages.value) {
    const allPages = pages.value as Array<{ id: string; title: string; slug: string; parentId: string | null }>;
    const byId = new Map(allPages.map(p => [p.id, p]));
    let parent = byId.get(renderedPage.value.parentId);
    while (parent) {
      crumbs.unshift({ title: parent.title, slug: parent.slug });
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
    }
  }
  crumbs.push({ title: renderedPage.value.title, slug: renderedPage.value.slug });
  return crumbs;
});

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

// Debounced search-as-you-type
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (q) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  if (!q.trim()) { searchOpen.value = false; return; }
  searchTimeout = setTimeout(handleSearch, 300);
});

// Version switching
const selectedVersion = ref('');
watch(site, (s) => {
  if (s?.versions?.length) {
    const def = s.versions.find((v: { isDefault: boolean }) => v.isDefault) ?? s.versions[0];
    if (def) selectedVersion.value = def.version;
  }
}, { immediate: true });

// Mobile sidebar
const sidebarOpen = ref(false);

useSeoMeta({
  title: () => renderedPage.value ? `${renderedPage.value.title} — ${site.value?.name ?? 'Docs'}` : `Docs — ${useSiteName()}`,
  description: () => renderedPage.value?.frontmatter?.description ?? '',
});
</script>

<template>
  <div class="docs-site" v-if="site">
    <!-- Mobile toggle -->
    <button class="docs-mobile-toggle" @click="sidebarOpen = !sidebarOpen" aria-label="Toggle navigation">
      <i class="fa-solid fa-bars"></i>
    </button>

    <div class="docs-layout">
      <!-- LEFT SIDEBAR: Nav + Search -->
      <aside class="docs-sidebar" :class="{ open: sidebarOpen }" aria-label="Documentation navigation">
        <div class="docs-sidebar-header">
          <NuxtLink :to="`/docs/${siteSlug}`" class="docs-sidebar-title">{{ site.name }}</NuxtLink>
          <NuxtLink v-if="isOwner" :to="`/docs/${siteSlug}/edit?page=${pagePath}`" class="docs-edit-link" aria-label="Edit this page">
            <i class="fa-solid fa-pen"></i>
          </NuxtLink>
        </div>

        <!-- Version Selector -->
        <div v-if="site.versions?.length > 1" class="docs-version-select">
          <select v-model="selectedVersion" class="docs-version-dropdown" aria-label="Select version">
            <option v-for="v in site.versions" :key="v.id" :value="v.version">
              {{ v.version }}{{ v.isDefault ? ' (latest)' : '' }}
            </option>
          </select>
        </div>

        <!-- Search -->
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

        <!-- Nav Tree -->
        <nav class="docs-nav">
          <template v-for="node in navTree" :key="node.id">
            <div class="docs-nav-item" :class="{ active: node.slug === pagePath }">
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
                  :class="{ active: child.slug === pagePath }"
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

      <!-- MAIN CONTENT -->
      <main v-if="pagePending" class="docs-main"><div class="cpub-loading">Loading page...</div></main>
      <main v-else-if="pageError" class="docs-main">
        <div class="cpub-fetch-error">
          <div class="cpub-fetch-error-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <div class="cpub-fetch-error-msg">Failed to load this page.</div>
          <button class="cpub-btn cpub-btn-sm" @click="refreshPage()">Retry</button>
        </div>
      </main>
      <main class="docs-main" v-else-if="renderedPage">
        <!-- Breadcrumbs -->
        <div v-if="breadcrumbs.length > 1" class="docs-breadcrumbs">
          <NuxtLink :to="`/docs/${siteSlug}`" class="docs-breadcrumb-item">{{ site.name }}</NuxtLink>
          <template v-for="(crumb, i) in breadcrumbs" :key="crumb.slug">
            <span class="docs-breadcrumb-sep"><i class="fa-solid fa-chevron-right"></i></span>
            <NuxtLink
              v-if="i < breadcrumbs.length - 1"
              :to="`/docs/${siteSlug}/${crumb.slug}`"
              class="docs-breadcrumb-item"
            >{{ crumb.title }}</NuxtLink>
            <span v-else class="docs-breadcrumb-current">{{ crumb.title }}</span>
          </template>
        </div>

        <!-- Page Title -->
        <h1 class="docs-page-title">{{ renderedPage.title }}</h1>

        <!-- Rendered Content -->
        <div v-if="isBlockContent" class="docs-content cpub-prose">
          <BlocksBlockContentRenderer :blocks="blockContent" />
        </div>
        <div v-else class="docs-content cpub-prose" v-html="renderedPage.html" />

        <!-- Prev / Next -->
        <div class="docs-prev-next" v-if="prevNextLinks.prev || prevNextLinks.next">
          <NuxtLink
            v-if="prevNextLinks.prev"
            :to="`/docs/${siteSlug}/${prevNextLinks.prev.slug}`"
            class="docs-pn-link docs-pn-prev"
          >
            <span class="docs-pn-label"><i class="fa-solid fa-arrow-left"></i> Previous</span>
            <span class="docs-pn-title">{{ prevNextLinks.prev.title }}</span>
          </NuxtLink>
          <div v-else></div>
          <NuxtLink
            v-if="prevNextLinks.next"
            :to="`/docs/${siteSlug}/${prevNextLinks.next.slug}`"
            class="docs-pn-link docs-pn-next"
          >
            <span class="docs-pn-label">Next <i class="fa-solid fa-arrow-right"></i></span>
            <span class="docs-pn-title">{{ prevNextLinks.next.title }}</span>
          </NuxtLink>
        </div>
      </main>

      <!-- Page not found -->
      <main v-else class="docs-main">
        <div class="docs-not-found">
          <h1>Page not found</h1>
          <p>The requested documentation page could not be found.</p>
        </div>
      </main>

      <!-- RIGHT SIDEBAR: TOC -->
      <aside v-if="toc.length > 1" class="docs-toc" aria-label="Table of contents">
        <div class="docs-toc-title">On this page</div>
        <nav class="docs-toc-nav">
          <a
            v-for="entry in toc"
            :key="entry.id"
            :href="`#${entry.id}`"
            class="docs-toc-link"
            :class="{ active: activeHeadingId === entry.id, [`level-${entry.level}`]: true }"
          >
            {{ entry.text }}
          </a>
        </nav>
      </aside>
    </div>
  </div>
  <div v-else class="docs-not-found"><h1>Documentation site not found</h1></div>
</template>

<style scoped>
/* ── LAYOUT ── */
.docs-site { max-width: 100%; min-height: calc(100vh - 48px); }
.docs-layout { display: grid; grid-template-columns: 240px 1fr 200px; gap: 0; min-height: calc(100vh - 48px); }
.docs-layout:has(.docs-toc:empty) { grid-template-columns: 240px 1fr; }

/* ── SIDEBAR ── */
.docs-sidebar {
  border-right: var(--border-width-default) solid var(--border);
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
  border-bottom: var(--border-width-default) solid var(--border);
  margin-bottom: 12px;
}

.docs-sidebar-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  text-decoration: none;
  letter-spacing: -0.01em;
}

.docs-sidebar-title:hover { color: var(--accent); }

.docs-edit-link {
  font-size: 11px;
  color: var(--text-faint);
  text-decoration: none;
  padding: 2px 6px;
  border: var(--border-width-default) solid var(--border2);
}

.docs-edit-link:hover { color: var(--accent); border-color: var(--accent); }

/* Version Selector */
.docs-version-select { padding: 0 16px 12px; }

.docs-version-dropdown {
  width: 100%;
  padding: 5px 8px;
  font-size: 11px;
  font-family: var(--font-mono);
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  color: var(--text-dim);
  cursor: pointer;
}

.docs-version-dropdown:focus { border-color: var(--accent); outline: none; }

/* Search */
.docs-search { padding: 0 16px 12px; position: relative; }

.docs-search-input-wrap { position: relative; }

.docs-search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 10px;
  color: var(--text-faint);
}

.docs-search-input {
  width: 100%;
  padding: 6px 8px 6px 26px;
  font-size: 12px;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  color: var(--text);
}

.docs-search-input::placeholder { color: var(--text-faint); }
.docs-search-input:focus { border-color: var(--accent); outline: none; }

.docs-search-results {
  position: absolute;
  top: 100%;
  left: 16px;
  right: 16px;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-md);
  z-index: 50;
  max-height: 200px;
  overflow-y: auto;
}

.docs-search-result {
  display: block;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-dim);
  text-decoration: none;
  border-bottom: var(--border-width-default) solid var(--border2);
}

.docs-search-result:last-child { border-bottom: none; }
.docs-search-result:hover { background: var(--surface2); color: var(--accent); }

/* Nav Tree */
.docs-nav { padding: 0; }

.docs-nav-item { border-bottom: var(--border-width-default) solid var(--border2); }
.docs-nav-item:last-child { border-bottom: none; }

.docs-nav-row { display: flex; align-items: center; }

.docs-nav-link {
  flex: 1;
  display: block;
  padding: 7px 16px;
  font-size: 13px;
  color: var(--text-dim);
  text-decoration: none;
  line-height: 1.4;
}

.docs-nav-link:hover { color: var(--text); background: var(--surface2); }

.docs-nav-item.active > .docs-nav-row > .docs-nav-link,
.docs-nav-link.active {
  color: var(--accent);
  font-weight: 600;
  border-right: 3px solid var(--accent);
  background: var(--accent-bg);
}

.docs-nav-toggle {
  padding: 6px 12px;
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 9px;
}

.docs-nav-toggle:hover { color: var(--text-dim); }

.docs-nav-children { padding-left: 12px; border-top: var(--border-width-default) solid var(--border2); }

.docs-nav-child { font-size: 12px; padding: 5px 16px; }

.docs-nav-empty { color: var(--text-faint); font-size: 12px; padding: 16px; }

/* ── MAIN CONTENT ── */
.docs-main {
  padding: 28px 40px 64px;
  min-height: 400px;
  max-width: 800px;
}

/* Breadcrumbs */
.docs-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-faint);
}

.docs-breadcrumb-item { color: var(--text-dim); text-decoration: none; }
.docs-breadcrumb-item:hover { color: var(--accent); }
.docs-breadcrumb-sep { font-size: 8px; }
.docs-breadcrumb-current { color: var(--text-dim); }

.docs-page-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 24px;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

/* Prose */
.docs-content { font-size: 14px; line-height: 1.75; color: var(--text-dim); }
.docs-content :deep(h2) { font-size: 20px; font-weight: 700; color: var(--text); margin-top: 32px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: var(--border-width-default) solid var(--border); }
.docs-content :deep(h3) { font-size: 16px; font-weight: 700; color: var(--text); margin-top: 24px; margin-bottom: 8px; }
.docs-content :deep(h4) { font-size: 14px; font-weight: 700; color: var(--text); margin-top: 20px; margin-bottom: 6px; }
.docs-content :deep(p) { margin-bottom: 14px; }
.docs-content :deep(a) { color: var(--accent); text-decoration: none; }
.docs-content :deep(a:hover) { text-decoration: underline; }
.docs-content :deep(strong) { color: var(--text); font-weight: 600; }
.docs-content :deep(code) { font-family: var(--font-mono); font-size: 12px; background: var(--surface2); padding: 2px 5px; border: var(--border-width-default) solid var(--border2); color: var(--accent); }
.docs-content :deep(pre) { padding: 16px; background: var(--surface2); border: var(--border-width-default) solid var(--border); overflow-x: auto; margin: 16px 0; box-shadow: var(--shadow-md); }
.docs-content :deep(pre code) { background: none; border: none; padding: 0; font-size: 13px; color: var(--text); }
.docs-content :deep(ul), .docs-content :deep(ol) { margin-bottom: 14px; padding-left: 24px; }
.docs-content :deep(li) { margin-bottom: 4px; }
.docs-content :deep(blockquote) { border-left: 4px solid var(--accent); padding: 8px 16px; margin: 16px 0; background: var(--surface); color: var(--text-dim); }
.docs-content :deep(table) { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
.docs-content :deep(th) { background: var(--surface2); padding: 8px 12px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; font-family: var(--font-mono); color: var(--text-faint); border-bottom: var(--border-width-default) solid var(--border); }
.docs-content :deep(td) { padding: 8px 12px; border-bottom: var(--border-width-default) solid var(--border2); }
.docs-content :deep(hr) { border: none; border-top: var(--border-width-default) solid var(--border); margin: 32px 0; }
.docs-content :deep(img) { max-width: 100%; border: var(--border-width-default) solid var(--border); }

/* Prev / Next */
.docs-prev-next {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-top: 48px;
  padding-top: 24px;
  border-top: var(--border-width-default) solid var(--border);
}

.docs-pn-link {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  text-decoration: none;
  min-width: 0;
  max-width: 48%;
  box-shadow: var(--shadow-md);
  transition: box-shadow 0.15s, transform 0.15s;
}

.docs-pn-link:hover {
  box-shadow: var(--shadow-sm);
  transform: translate(1px, 1px);
}

.docs-pn-prev { align-items: flex-start; }
.docs-pn-next { align-items: flex-end; margin-left: auto; }

.docs-pn-label {
  font-size: 10px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-faint);
  display: flex;
  align-items: center;
  gap: 4px;
}

.docs-pn-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── TOC (Right Sidebar) ── */
.docs-toc {
  padding: 28px 16px;
  border-left: var(--border-width-default) solid var(--border);
  height: calc(100vh - 48px);
  position: sticky;
  top: 48px;
  overflow-y: auto;
}

.docs-toc-title {
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-faint);
  margin-bottom: 12px;
}

.docs-toc-nav { display: flex; flex-direction: column; gap: 2px; }

.docs-toc-link {
  font-size: 12px;
  color: var(--text-faint);
  text-decoration: none;
  padding: 3px 8px;
  border-left: var(--border-width-default) solid transparent;
  line-height: 1.4;
}

.docs-toc-link:hover { color: var(--text-dim); }
.docs-toc-link.active { color: var(--accent); border-left-color: var(--accent); }
.docs-toc-link.level-3 { padding-left: 20px; }
.docs-toc-link.level-4 { padding-left: 32px; }
.docs-toc-link.level-5 { padding-left: 44px; }
.docs-toc-link.level-6 { padding-left: 56px; }

/* Not Found */
.docs-not-found { text-align: center; padding: 64px 0; color: var(--text-dim); }

/* Mobile */
.docs-mobile-toggle {
  display: none;
  position: fixed;
  bottom: 16px;
  right: 16px;
  width: 44px;
  height: 44px;
  background: var(--accent);
  color: var(--color-text-inverse);
  border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-md);
  font-size: 16px;
  cursor: pointer;
  z-index: 100;
  align-items: center;
  justify-content: center;
}

@media (max-width: 1024px) {
  .docs-toc { display: none; }
  .docs-layout { grid-template-columns: 240px 1fr; }
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
    box-shadow: none;
  }
  .docs-sidebar.open {
    left: 0;
    box-shadow: var(--shadow-md);
  }
  .docs-main { padding: 20px 16px 64px; }
}
</style>
