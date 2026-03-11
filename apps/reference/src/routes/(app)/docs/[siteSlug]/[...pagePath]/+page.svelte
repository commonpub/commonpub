<script lang="ts">
  import DocsViewer from '$lib/components/docs/DocsViewer.svelte';
  import DocsSidebar from '$lib/components/docs/DocsSidebar.svelte';
  import DocsSearch from '$lib/components/docs/DocsSearch.svelte';
  import PageBreadcrumb from '$lib/components/docs/PageBreadcrumb.svelte';
  import PrevNextNav from '$lib/components/docs/PrevNextNav.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.page.title} — {data.site.name} Docs</title>
  <meta
    name="description"
    content={data.frontmatter.description ?? `${data.page.title} documentation`}
  />
</svelte:head>

<div class="docs-layout">
  <DocsSidebar
    nav={data.nav}
    activePath={data.page.id}
    versions={data.versions}
    currentVersion={data.activeVersion.version}
    siteSlug={data.site.slug}
  />

  <main class="docs-main">
    <DocsSearch siteSlug={data.site.slug} versionId={data.activeVersion.id} />
    <PageBreadcrumb items={data.breadcrumbs} siteSlug={data.site.slug} />

    <DocsViewer
      html={data.html}
      toc={data.toc}
      frontmatter={data.frontmatter}
      themeTokens={data.site.themeTokens}
    />

    <PrevNextNav prev={data.prevNext.prev} next={data.prevNext.next} siteSlug={data.site.slug} />
  </main>
</div>

<style>
  .docs-layout {
    display: flex;
    min-height: calc(100vh - 4rem);
  }

  .docs-main {
    flex: 1;
    padding: var(--space-4, 1rem) var(--space-6, 2rem);
    min-width: 0;
  }
</style>
