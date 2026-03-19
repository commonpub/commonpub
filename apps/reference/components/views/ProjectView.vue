<script setup lang="ts">
import type { ContentViewData } from '~/composables/useEngagement';

const props = defineProps<{
  content: ContentViewData;
}>();

const activeTab = ref('overview');

// Fetch linked products (BOM) for this content
const { data: bomProducts } = useFetch(() => `/api/content/${props.content?.id}/products`, {
  key: `bom-${props.content?.id}`,
  default: () => [],
  immediate: !!props.content?.id,
});

const tabs = computed(() => {
  const result = [
    { value: 'overview', label: 'Overview', count: 0 },
  ];
  const bomCount = partsFromBlocks.value.length + (bomProducts.value?.length ?? 0);
  if (bomCount > 0 || buildStepsFromBlocks.value.length > 0) {
    result.push({ value: 'bom', label: 'Parts & Steps', count: bomCount });
  }
  if (codeBlocks.value.length > 0) {
    result.push({ value: 'code', label: 'Code', count: codeBlocks.value.length });
  }
  if (downloadFiles.value.length > 0) {
    result.push({ value: 'files', label: 'Files', count: downloadFiles.value.length });
  }
  result.push({ value: 'comments', label: 'Discussion', count: props.content?.commentCount ?? 0 });
  return result;
});

const contentId = computed(() => props.content?.id);
const contentType = computed(() => props.content?.type ?? 'project');
const { liked, bookmarked, likeCount, toggleLike, toggleBookmark, share, setInitialState } = useEngagement(contentId, contentType);

onMounted(() => {
  setInitialState(false, false, props.content?.likeCount ?? 0);
});

const config = useRuntimeConfig();
useJsonLd({
  type: 'howto',
  title: props.content.title,
  description: props.content.seoDescription ?? props.content.description ?? '',
  url: `${config.public.siteUrl}/project/${props.content.slug}`,
  imageUrl: props.content.coverImageUrl ?? undefined,
  authorName: props.content.author?.displayName ?? props.content.author?.username ?? '',
  authorUrl: `${config.public.siteUrl}/u/${props.content.author?.username}`,
  difficulty: props.content.difficulty ?? undefined,
  estimatedTime: props.content.buildTime ?? undefined,
  estimatedCost: props.content.estimatedCost ?? undefined,
});

const difficultyLevel = computed(() => {
  const d = props.content?.difficulty;
  if (d === 'beginner') return 1;
  if (d === 'intermediate') return 3;
  if (d === 'advanced') return 5;
  return 3;
});

const formattedDate = computed(() => {
  const date = props.content?.publishedAt || props.content?.createdAt;
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
});

// Extract parts list blocks from content for BOM tab
interface PartItem {
  name: string;
  quantity: number;
  productId?: string;
  notes?: string;
}

const partsFromBlocks = computed<PartItem[]>(() => {
  const blocks = props.content?.content;
  if (!Array.isArray(blocks)) return [];
  const items: PartItem[] = [];
  for (const block of blocks) {
    const [type, data] = block as [string, Record<string, unknown>];
    if (type === 'partsList' && Array.isArray(data.parts)) {
      for (const part of data.parts as Array<Record<string, unknown>>) {
        items.push({
          name: (part.name as string) || 'Unknown',
          quantity: (part.qty as number) ?? (part.quantity as number) ?? 1,
          productId: part.productId as string | undefined,
          notes: (part.notes as string) || '',
        });
      }
    }
  }
  return items;
});

// Extract build steps from content
interface BuildStep {
  number: number;
  title: string;
  instructions: string;
  image?: string;
  time?: string;
}

const buildStepsFromBlocks = computed<BuildStep[]>(() => {
  const blocks = props.content?.content;
  if (!Array.isArray(blocks)) return [];
  const steps: BuildStep[] = [];
  let stepNum = 0;
  for (const block of blocks) {
    const [type, data] = block as [string, Record<string, unknown>];
    if (type === 'buildStep') {
      stepNum++;
      steps.push({
        number: (data.stepNumber as number) || stepNum,
        title: (data.title as string) || `Step ${stepNum}`,
        instructions: (data.instructions as string) || '',
        image: data.image as string | undefined,
        time: data.time as string | undefined,
      });
    }
  }
  return steps;
});

// Extract code blocks for code tab
interface CodeSnippet {
  language: string;
  filename: string;
  code: string;
}

const codeBlocks = computed<CodeSnippet[]>(() => {
  const blocks = props.content?.content;
  if (!Array.isArray(blocks)) return [];
  const snippets: CodeSnippet[] = [];
  for (const block of blocks) {
    const [type, data] = block as [string, Record<string, unknown>];
    if (type === 'code_block' || type === 'codeBlock') {
      snippets.push({
        language: (data.language as string) || '',
        filename: (data.filename as string) || '',
        code: (data.code as string) || '',
      });
    }
  }
  return snippets;
});

// Extract download blocks for files tab
interface FileItem {
  name: string;
  url: string;
  size?: string;
}

const downloadFiles = computed<FileItem[]>(() => {
  const blocks = props.content?.content;
  if (!Array.isArray(blocks)) return [];
  const files: FileItem[] = [];
  for (const block of blocks) {
    const [type, data] = block as [string, Record<string, unknown>];
    if (type === 'downloads' && Array.isArray(data.files)) {
      for (const file of data.files as Array<Record<string, unknown>>) {
        files.push({
          name: (file.name as string) || 'Unknown',
          url: (file.url as string) || '',
          size: (file.size as string) || '',
        });
      }
    }
  }
  return files;
});

// Fork
const forking = ref(false);
async function handleFork(): Promise<void> {
  forking.value = true;
  try {
    const result = await $fetch<{ slug: string; type: string }>(`/api/content/${props.content.id}/fork`, { method: 'POST' });
    await navigateTo(`/${result.type}/${result.slug}/edit`);
  } catch {
    // fork failed silently
  } finally {
    forking.value = false;
  }
}

// I Built This
const buildMarked = ref(false);
const localBuildCount = ref(props.content?.buildCount ?? 0);
const buildToggling = ref(false);
async function handleBuild(): Promise<void> {
  buildToggling.value = true;
  try {
    const result = await $fetch<{ marked: boolean; count: number }>(`/api/content/${props.content.id}/build`, { method: 'POST' });
    buildMarked.value = result.marked;
    localBuildCount.value = result.count;
  } catch {
    // toggle failed silently
  } finally {
    buildToggling.value = false;
  }
}
</script>

<template>
  <div class="cpub-project-view">
    <!-- HERO COVER -->
    <div class="cpub-hero-cover" :class="{ 'cpub-hero-cover-has-image': content.coverImageUrl }">
      <img v-if="content.coverImageUrl" :src="content.coverImageUrl" :alt="content.title" class="cpub-hero-cover-img" />
      <template v-else>
        <div class="cpub-hero-cover-grid"></div>
        <div class="cpub-hero-circuit">
          <div class="cpub-chip-row">
            <div class="cpub-chip">{{ content.hardwarePrimary || 'MCU' }}</div>
            <div class="cpub-chip-line"></div>
            <div class="cpub-chip">{{ content.hardwareSecondary || 'SENSOR' }}</div>
            <div class="cpub-chip-line"></div>
            <div class="cpub-chip">{{ content.hardwareTertiary || 'ML MODEL' }}</div>
          </div>
        </div>
      </template>
      <div class="cpub-hero-badges">
        <span v-if="content.isFeatured" class="cpub-badge cpub-badge-featured"><i class="fa-solid fa-star"></i> Featured</span>
        <span class="cpub-badge cpub-badge-outline">{{ content.difficulty || 'Intermediate' }}</span>
      </div>
    </div>

    <!-- PAGE CONTENT -->
    <div class="cpub-page-outer">
      <!-- BREADCRUMB -->
      <div class="cpub-breadcrumb">
        <NuxtLink to="/">Explore</NuxtLink>
        <span class="cpub-bc-sep"><i class="fa-solid fa-chevron-right"></i></span>
        <NuxtLink to="/project">Projects</NuxtLink>
        <span class="cpub-bc-sep"><i class="fa-solid fa-chevron-right"></i></span>
        <span class="cpub-bc-current">{{ content.title }}</span>
      </div>

      <!-- PROJECT META -->
      <div class="cpub-project-meta">
        <h1 class="cpub-project-title">{{ content.title }}</h1>
        <p v-if="content.description" class="cpub-project-subtitle">{{ content.description }}</p>

        <!-- Author Row -->
        <div class="cpub-author-row">
          <div class="cpub-av cpub-av-lg">{{ content.author?.displayName?.slice(0, 2).toUpperCase() || 'CP' }}</div>
          <div>
            <div class="cpub-author-name">{{ content.author?.displayName || content.author?.username || 'Author' }}</div>
            <div class="cpub-author-meta-row">
              <span v-if="content.author?.org" class="cpub-author-org">{{ content.author.org }}</span>
              <span class="cpub-meta-date">Published {{ formattedDate }}</span>
            </div>
          </div>
          <span class="cpub-meta-sep">&bull;</span>
          <div class="cpub-fork-count">
            <i class="fa-solid fa-code-branch"></i>
            <span>{{ content.forkCount ?? 0 }} forks</span>
          </div>
        </div>

        <!-- Engagement Row -->
        <div class="cpub-engagement-row">
          <button class="cpub-engage-btn" :class="{ liked }" @click="toggleLike">
            <i class="fa-solid fa-heart"></i> Like <span class="cpub-count">{{ likeCount }}</span>
          </button>
          <button class="cpub-engage-btn" :class="{ bookmarked }" @click="toggleBookmark"><i class="fa-regular fa-bookmark"></i> Bookmark</button>
          <button class="cpub-engage-btn" @click="share"><i class="fa-solid fa-share-nodes"></i> Share</button>
          <div class="cpub-engage-sep"></div>
          <button class="cpub-engage-btn" :disabled="forking" @click="handleFork"><i class="fa-solid fa-code-branch"></i> {{ forking ? 'Forking...' : 'Fork' }} <span class="cpub-count">{{ content.forkCount ?? 0 }}</span></button>
          <button class="cpub-engage-btn cpub-engage-btn-green" :class="{ 'cpub-engage-active': buildMarked }" :disabled="buildToggling" @click="handleBuild"><i class="fa-solid fa-hammer"></i> I Built This <span class="cpub-count">{{ localBuildCount }}</span></button>
        </div>
      </div>
    </div>

    <!-- STICKY TABS -->
    <div class="cpub-tabs-sticky">
      <div class="cpub-tabs-inner">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="cpub-tab"
          :class="{ active: activeTab === tab.value }"
          @click="activeTab = tab.value"
        >
          {{ tab.label }}
          <span v-if="tab.count" class="cpub-tab-badge">{{ tab.count }}</span>
        </button>
      </div>
    </div>

    <!-- MAIN CONTENT GRID -->
    <div class="cpub-page-outer">
      <div class="cpub-content-grid">
        <!-- LEFT: CONTENT -->
        <div class="cpub-content-col">
          <!-- OVERVIEW TAB -->
          <template v-if="activeTab === 'overview'">
            <div class="cpub-prose">
              <template v-if="content.content && Array.isArray(content.content) && (content.content as unknown[]).length > 0">
                <BlockContentRenderer :blocks="(content.content as [string, Record<string, unknown>][])" />
              </template>
              <template v-else>
                <div class="cpub-prose-section">
                  <div class="cpub-section-title">Introduction</div>
                  <p class="cpub-prose-p">No content body yet. This project doesn't have any content blocks.</p>
                </div>
              </template>
            </div>
          </template>

          <!-- BOM / PARTS & STEPS TAB -->
          <template v-else-if="activeTab === 'bom'">
            <!-- Parts Table -->
            <div v-if="partsFromBlocks.length > 0" class="cpub-bom-section">
              <h2 class="cpub-tab-section-title"><i class="fa-solid fa-list-check"></i> Parts List</h2>
              <div class="cpub-parts-table-wrap">
                <table class="cpub-parts-table">
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th>Qty</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(part, idx) in partsFromBlocks" :key="idx">
                      <td class="cpub-part-name">{{ part.name }}</td>
                      <td class="cpub-part-qty">{{ part.quantity }}</td>
                      <td class="cpub-part-notes">{{ part.notes || '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Linked Products from catalog -->
            <div v-if="bomProducts?.length" class="cpub-bom-section">
              <h2 class="cpub-tab-section-title"><i class="fa-solid fa-cube"></i> Linked Products</h2>
              <div class="cpub-linked-products">
                <div v-for="bp in bomProducts" :key="bp.id" class="cpub-linked-product">
                  <div class="cpub-linked-product-icon"><i class="fa-solid fa-microchip"></i></div>
                  <div class="cpub-linked-product-info">
                    <NuxtLink :to="`/products/${bp.productSlug}`" class="cpub-linked-product-name">{{ bp.productName }}</NuxtLink>
                    <span class="cpub-linked-product-qty">× {{ bp.quantity }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Build Steps -->
            <div v-if="buildStepsFromBlocks.length > 0" class="cpub-bom-section">
              <h2 class="cpub-tab-section-title"><i class="fa-solid fa-hammer"></i> Build Steps</h2>
              <div class="cpub-build-steps">
                <div v-for="step in buildStepsFromBlocks" :key="step.number" class="cpub-build-step">
                  <div class="cpub-build-step-header">
                    <span class="cpub-build-step-num">{{ step.number }}</span>
                    <h3 class="cpub-build-step-title">{{ step.title }}</h3>
                    <span v-if="step.time" class="cpub-build-step-time"><i class="fa-regular fa-clock"></i> {{ step.time }}</span>
                  </div>
                  <div class="cpub-build-step-body">
                    <p>{{ step.instructions }}</p>
                    <img v-if="step.image" :src="step.image" :alt="`Step ${step.number}`" class="cpub-build-step-img" />
                  </div>
                </div>
              </div>
            </div>

            <p v-if="partsFromBlocks.length === 0 && !bomProducts?.length && buildStepsFromBlocks.length === 0" class="cpub-tab-empty">
              No parts or build steps have been added to this project yet.
            </p>
          </template>

          <!-- CODE TAB -->
          <template v-else-if="activeTab === 'code'">
            <div class="cpub-code-tab">
              <div v-for="(snippet, idx) in codeBlocks" :key="idx" class="cpub-code-snippet">
                <div class="cpub-code-snippet-header">
                  <span class="cpub-code-lang-label">{{ snippet.language || 'plain text' }}</span>
                  <span v-if="snippet.filename" class="cpub-code-filename">{{ snippet.filename }}</span>
                </div>
                <pre class="cpub-code-body"><code>{{ snippet.code }}</code></pre>
              </div>
            </div>
          </template>

          <!-- FILES TAB -->
          <template v-else-if="activeTab === 'files'">
            <div class="cpub-files-tab">
              <div v-for="(file, idx) in downloadFiles" :key="idx" class="cpub-file-row">
                <div class="cpub-file-icon"><i class="fa-solid fa-file-arrow-down"></i></div>
                <div class="cpub-file-info">
                  <a :href="file.url" class="cpub-file-name" download>{{ file.name }}</a>
                  <span v-if="file.size" class="cpub-file-size">{{ file.size }}</span>
                </div>
                <a :href="file.url" class="cpub-file-download" download>
                  <i class="fa-solid fa-download"></i>
                </a>
              </div>
            </div>
          </template>

          <!-- DISCUSSION TAB -->
          <template v-else-if="activeTab === 'comments'">
            <CommentSection :target-type="content.type" :target-id="content.id" />
          </template>
        </div>

        <!-- RIGHT: SIDEBAR -->
        <aside class="cpub-sidebar">
          <!-- Stats Grid -->
          <div class="cpub-sb-card">
            <div class="cpub-sb-title">Stats</div>
            <div class="cpub-stats-grid">
              <div class="cpub-stat-cell">
                <div class="cpub-stat-val">{{ content.viewCount?.toLocaleString() || '0' }}</div>
                <div class="cpub-stat-label">VIEWS</div>
              </div>
              <div class="cpub-stat-cell">
                <div class="cpub-stat-val">{{ content.likeCount ?? 0 }}</div>
                <div class="cpub-stat-label">LIKES</div>
              </div>
              <div class="cpub-stat-cell">
                <div class="cpub-stat-val">{{ content.forkCount ?? 0 }}</div>
                <div class="cpub-stat-label">FORKS</div>
              </div>
              <div class="cpub-stat-cell">
                <div class="cpub-stat-val">{{ content.bookmarkCount ?? 0 }}</div>
                <div class="cpub-stat-label">SAVES</div>
              </div>
            </div>
          </div>

          <!-- Details -->
          <div class="cpub-sb-card">
            <div class="cpub-sb-title">Details</div>
            <div class="cpub-diff-row">
              <span>Difficulty</span>
              <div class="cpub-diff-dots">
                <div v-for="d in 5" :key="d" class="cpub-diff-dot" :class="{ on: d <= difficultyLevel }"></div>
              </div>
            </div>
            <div class="cpub-meta-row">
              <div class="cpub-meta-row-icon"><i class="fa-solid fa-clock"></i></div>
              <div>
                <div class="cpub-meta-row-label">Build Time</div>
                <div class="cpub-meta-row-val">{{ content.buildTime || '~4 hours' }}</div>
              </div>
            </div>
            <div class="cpub-meta-row">
              <div class="cpub-meta-row-icon"><i class="fa-solid fa-dollar-sign"></i></div>
              <div>
                <div class="cpub-meta-row-label">Estimated Cost</div>
                <div class="cpub-meta-row-val">{{ content.estimatedCost || '$45–$65' }}</div>
              </div>
            </div>
            <div v-if="content.githubUrl" class="cpub-meta-row">
              <div class="cpub-meta-row-icon"><i class="fa-brands fa-github"></i></div>
              <div>
                <div class="cpub-meta-row-label">Source Code</div>
                <div class="cpub-meta-row-val"><a :href="content.githubUrl" class="cpub-link-text">View on GitHub</a></div>
              </div>
            </div>
            <div v-if="content.license" class="cpub-meta-row">
              <div class="cpub-meta-row-icon"><i class="fa-solid fa-scale-balanced"></i></div>
              <div>
                <div class="cpub-meta-row-label">License</div>
                <div class="cpub-meta-row-val">{{ content.license }}</div>
              </div>
            </div>
          </div>

          <!-- Tags -->
          <div v-if="content.tags?.length" class="cpub-sb-card">
            <div class="cpub-sb-title">Tags</div>
            <div class="cpub-tag-cloud">
              <span v-for="tag in content.tags" :key="tag.id || tag.name || tag" class="cpub-tag">{{ tag.name || tag }}</span>
            </div>
          </div>

          <!-- BOM Summary -->
          <div v-if="content.parts?.length || bomProducts?.length" class="cpub-sb-card">
            <div class="cpub-sb-title">BOM Summary</div>
            <div class="cpub-bom-summary-row">
              <span class="cpub-bom-label">Components</span>
              <span class="cpub-bom-val">{{ (content.parts?.length ?? 0) + (bomProducts?.length ?? 0) }}</span>
            </div>
            <div class="cpub-bom-summary-row">
              <span class="cpub-bom-label">Total Cost</span>
              <span class="cpub-bom-val cpub-bom-green">{{ content.estimatedCost || '—' }}</span>
            </div>
            <!-- Linked products from catalog -->
            <template v-if="bomProducts?.length">
              <div class="cpub-bom-products-header">Linked Products</div>
              <div v-for="bp in bomProducts" :key="bp.id" class="cpub-bom-product-row">
                <NuxtLink :to="`/products/${bp.productSlug}`" class="cpub-bom-product-link">
                  {{ bp.productName }}
                </NuxtLink>
                <span class="cpub-bom-qty">×{{ bp.quantity }}</span>
              </div>
            </template>
            <div class="cpub-bom-link-row">
              <button class="cpub-link-text" @click="activeTab = 'bom'">
                <i class="fa-solid fa-list"></i> View full BOM
              </button>
            </div>
          </div>

          <!-- Community Hub -->
          <div v-if="content.community" class="cpub-sb-card">
            <div class="cpub-hub-card-inner">
              <div class="cpub-hub-icon"><i class="fa-solid fa-users"></i></div>
              <div class="cpub-hub-name">{{ content.community.name }}</div>
              <div class="cpub-hub-desc">{{ content.community.description }}</div>
              <button class="cpub-btn cpub-btn-sm" @click="navigateTo(`/hubs/${content.community?.slug}`)">Join Community</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── HERO COVER ── */
.cpub-hero-cover {
  position: relative;
  height: 280px;
  background: var(--surface2);
  overflow: hidden;
  flex-shrink: 0;
  border-bottom: 2px solid var(--border);
}

.cpub-hero-cover-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--accent-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--accent-border) 1px, transparent 1px);
  background-size: 32px 32px;
}

.cpub-hero-circuit {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.22;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--teal);
  letter-spacing: 0.05em;
}

.cpub-chip-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cpub-chip {
  border: 2px solid currentColor;
  padding: 8px 16px;
  font-size: 10px;
}

.cpub-chip-line {
  width: 40px;
  height: 2px;
  background: currentColor;
  opacity: 0.5;
}

.cpub-hero-badges {
  position: absolute;
  top: 16px;
  left: 20px;
  display: flex;
  gap: 6px;
}

.cpub-badge {
  font-size: 9px;
  font-family: var(--font-mono);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 4px 10px;
}

.cpub-badge-featured {
  background: var(--yellow-bg);
  border: 2px solid var(--border);
  color: var(--yellow);
  box-shadow: 2px 2px 0 var(--border);
}

.cpub-badge-outline {
  background: var(--surface);
  border: 2px solid var(--border);
  color: var(--text-dim);
  box-shadow: 2px 2px 0 var(--border);
}

/* ── PAGE OUTER ── */
.cpub-page-outer {
  max-width: 1160px;
  margin: 0 auto;
  padding: 0 32px;
}

/* ── BREADCRUMB ── */
.cpub-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 0 10px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-faint);
}

.cpub-breadcrumb a { color: var(--text-dim); text-decoration: none; }
.cpub-breadcrumb a:hover { color: var(--text); }
.cpub-bc-sep { color: var(--text-faint); font-size: 8px; }
.cpub-bc-current { color: var(--text-dim); }

/* ── PROJECT META ── */
.cpub-project-meta { padding: 24px 0 0; }

.cpub-project-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.25;
  margin-bottom: 8px;
  letter-spacing: -0.02em;
}

.cpub-project-subtitle {
  font-size: 14px;
  color: var(--text-dim);
  line-height: 1.6;
  margin-bottom: 18px;
}

/* ── AUTHOR ROW ── */
.cpub-author-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.cpub-av {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--surface3);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-dim);
  font-family: var(--font-mono);
  flex-shrink: 0;
}

.cpub-av-lg { width: 36px; height: 36px; font-size: 12px; }

.cpub-author-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.cpub-author-meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.cpub-author-org {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--accent);
  background: var(--accent-bg);
  border: 2px solid var(--border);
  padding: 2px 7px;
}

.cpub-meta-date {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-faint);
}

.cpub-meta-sep { color: var(--text-faint); font-size: 11px; }

.cpub-fork-count {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-dim);
  display: flex;
  align-items: center;
  gap: 4px;
}

.cpub-fork-count i { font-size: 10px; color: var(--text-faint); }

/* ── ENGAGEMENT ROW ── */
.cpub-engagement-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 20px;
  flex-wrap: wrap;
}

.cpub-engage-btn {
  font-size: 12px;
  padding: 6px 13px;
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--text-dim);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.cpub-engage-btn:hover { color: var(--text); background: var(--surface2); }
.cpub-engage-btn.liked { color: var(--red); background: var(--red-bg); }

.cpub-engage-btn-green {
  color: var(--green);
  background: var(--green-bg);
}

.cpub-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
}

.cpub-engage-sep { width: 2px; height: 24px; background: var(--border); }

/* ── TABS ── */
.cpub-tabs-sticky {
  position: sticky;
  top: 48px;
  z-index: 50;
  background: var(--bg);
  border-bottom: 2px solid var(--border);
  margin-bottom: 28px;
}

.cpub-tabs-inner {
  max-width: 1160px;
  margin: 0 auto;
  padding: 0 32px;
  display: flex;
  align-items: center;
  gap: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.cpub-tabs-inner::-webkit-scrollbar { display: none; }

.cpub-tab {
  font-size: 12px;
  color: var(--text-dim);
  padding: 10px 14px;
  cursor: pointer;
  border: none;
  background: none;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: color var(--transition-fast);
}

.cpub-tab:hover { color: var(--text); }

.cpub-tab.active {
  color: var(--text);
  font-weight: 600;
  border-bottom-color: var(--border);
}

/* ── CONTENT GRID ── */
.cpub-content-grid {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 32px;
  align-items: start;
  padding-bottom: 64px;
}

/* ── PROSE ── */
.cpub-prose {
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-dim);
}

.cpub-prose :deep(h2),
.cpub-prose :deep(.section-title) {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 12px;
  letter-spacing: -0.01em;
}

.cpub-prose :deep(p) { margin-bottom: 12px; }
.cpub-prose :deep(strong) { color: var(--text); font-weight: 600; }
.cpub-prose :deep(a) { color: var(--accent); text-decoration: none; }
.cpub-prose :deep(a:hover) { text-decoration: underline; }
.cpub-prose :deep(code) {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--surface2);
  padding: 2px 5px;
  border: 1px solid var(--border2);
  color: var(--accent);
}

.cpub-prose :deep(hr) {
  border: none;
  border-top: 2px solid var(--border);
  margin: 24px 0;
}

/* ── SIDEBAR ── */
.cpub-sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cpub-sb-card {
  background: var(--surface);
  border: 2px solid var(--border);
  padding: 18px;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-sb-title {
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-bottom: 14px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--border);
}

/* Stats grid */
.cpub-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 2px solid var(--border);
  overflow: hidden;
}

.cpub-stat-cell {
  background: var(--surface2);
  padding: 14px;
  text-align: center;
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.cpub-stat-cell:nth-child(2n) { border-right: none; }
.cpub-stat-cell:nth-child(n+3) { border-bottom: none; }

.cpub-stat-val {
  font-size: 18px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text);
  line-height: 1;
  margin-bottom: 4px;
}

.cpub-stat-label {
  font-size: 9px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* Difficulty */
.cpub-diff-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 10px;
}

.cpub-diff-dots {
  display: flex;
  gap: 4px;
}

.cpub-diff-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border2);
}

.cpub-diff-dot.on { background: var(--yellow); }

/* Meta rows */
.cpub-meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border2);
  font-size: 12px;
}

.cpub-meta-row:last-child { border-bottom: none; }

.cpub-meta-row-icon {
  width: 28px;
  height: 28px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--text-faint);
  flex-shrink: 0;
}

.cpub-meta-row-label {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  margin-bottom: 2px;
}

.cpub-meta-row-val {
  font-size: 12px;
  color: var(--text);
  font-weight: 500;
}

/* Tags */
.cpub-tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cpub-tag {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-family: var(--font-mono);
  padding: 4px 10px;
  border: 2px solid var(--border);
  color: var(--text-dim);
  background: var(--surface);
  cursor: pointer;
  transition: border-color var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
}

.cpub-tag:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

/* BOM Summary */
.cpub-bom-summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 0;
  border-bottom: 1px solid var(--border2);
  font-size: 12px;
}

.cpub-bom-summary-row:last-child { border-bottom: none; }
.cpub-bom-label { color: var(--text-dim); }
.cpub-bom-val { font-family: var(--font-mono); color: var(--text); font-weight: 600; }
.cpub-bom-green { color: var(--green); }

/* Hub card */
.cpub-hub-card-inner {
  text-align: center;
  padding: 4px 0;
}

.cpub-hub-icon {
  width: 44px;
  height: 44px;
  background: var(--purple-bg);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: var(--purple);
  margin: 0 auto 10px;
}

.cpub-hub-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 4px;
}

.cpub-hub-desc {
  font-size: 11px;
  color: var(--text-faint);
  margin-bottom: 12px;
  line-height: 1.5;
}

/* Link text */
.cpub-link-text {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--accent);
  text-decoration: none;
}

.cpub-link-text:hover { color: var(--accent); text-decoration: underline; }

/* Buttons */
.cpub-btn {
  font-size: 12px;
  padding: 6px 14px;
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background var(--transition-fast);
}

.cpub-btn:hover { background: var(--surface2); }
.cpub-btn-sm { padding: 4px 10px; font-size: 11px; }

/* Tab badge */
.cpub-tab-badge {
  font-size: 9px;
  font-family: var(--font-mono);
  background: var(--surface3);
  color: var(--text-faint);
  padding: 1px 5px;
  border: 1px solid var(--border2);
}

/* BOM products in sidebar */
.cpub-bom-products-header {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-top: 12px;
  margin-bottom: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border2);
}

.cpub-bom-product-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 0;
  font-size: 12px;
}

.cpub-bom-product-link {
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}

.cpub-bom-product-link:hover { text-decoration: underline; }

.cpub-bom-qty {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
}

.cpub-bom-link-row {
  padding-top: 10px;
  text-align: center;
}

/* ── TAB CONTENT ── */
.cpub-tab-section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--border);
}

.cpub-tab-section-title i { font-size: 12px; color: var(--text-faint); }
.cpub-tab-empty { font-size: 13px; color: var(--text-faint); text-align: center; padding: 48px 0; }

/* Parts Table */
.cpub-bom-section { margin-bottom: 32px; }
.cpub-parts-table-wrap { overflow-x: auto; }

.cpub-parts-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.cpub-parts-table th {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-faint);
  padding: 8px 12px;
  text-align: left;
  background: var(--surface2);
  border-bottom: 2px solid var(--border);
}

.cpub-parts-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border2);
  color: var(--text-dim);
}

.cpub-part-name { font-weight: 500; color: var(--text); }
.cpub-part-qty { font-family: var(--font-mono); font-size: 12px; text-align: center; width: 50px; }
.cpub-part-notes { font-size: 12px; color: var(--text-faint); }

/* Linked Products */
.cpub-linked-products { display: flex; flex-direction: column; gap: 8px; }

.cpub-linked-product {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px;
  background: var(--surface);
  border: 2px solid var(--border);
  box-shadow: 2px 2px 0 var(--border);
}

.cpub-linked-product-icon {
  width: 32px; height: 32px;
  background: var(--accent-bg);
  border: 2px solid var(--accent-border);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; color: var(--accent); flex-shrink: 0;
}

.cpub-linked-product-info { flex: 1; display: flex; align-items: center; gap: 8px; }
.cpub-linked-product-name { font-size: 13px; font-weight: 600; color: var(--accent); text-decoration: none; }
.cpub-linked-product-name:hover { text-decoration: underline; }
.cpub-linked-product-qty { font-family: var(--font-mono); font-size: 11px; color: var(--text-faint); }

/* Build Steps */
.cpub-build-steps { display: flex; flex-direction: column; gap: 16px; }

.cpub-build-step {
  border: 2px solid var(--border);
  overflow: hidden;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-build-step-header {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px;
  background: var(--border);
  color: var(--surface);
}

.cpub-build-step-num {
  width: 28px; height: 28px;
  background: var(--accent);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-mono); font-size: 13px; font-weight: 700;
  flex-shrink: 0;
}

.cpub-build-step-title { font-size: 14px; font-weight: 600; flex: 1; }
.cpub-build-step-time { font-family: var(--font-mono); font-size: 11px; opacity: 0.7; display: flex; align-items: center; gap: 4px; }

.cpub-build-step-body {
  padding: 16px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-dim);
}

.cpub-build-step-body p { margin-bottom: 12px; }
.cpub-build-step-body p:last-child { margin-bottom: 0; }

.cpub-build-step-img {
  width: 100%;
  max-height: 400px;
  object-fit: cover;
  border: 2px solid var(--border);
  margin-top: 12px;
}

/* Code Tab */
.cpub-code-tab { display: flex; flex-direction: column; gap: 16px; }

.cpub-code-snippet {
  border: 2px solid var(--border);
  overflow: hidden;
  box-shadow: 2px 2px 0 var(--border);
}

.cpub-code-snippet-header {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px;
  background: var(--surface2);
  border-bottom: 2px solid var(--border);
}

.cpub-code-lang-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent);
}

.cpub-code-filename {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-faint);
  margin-left: auto;
}

.cpub-code-body {
  margin: 0;
  padding: 16px;
  background: var(--text);
  color: var(--surface);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
  white-space: pre;
}

/* Files Tab */
.cpub-files-tab { display: flex; flex-direction: column; gap: 8px; }

.cpub-file-row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
  background: var(--surface);
  border: 2px solid var(--border);
  box-shadow: 2px 2px 0 var(--border);
}

.cpub-file-icon {
  width: 32px; height: 32px;
  background: var(--surface2);
  border: 2px solid var(--border2);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; color: var(--text-faint); flex-shrink: 0;
}

.cpub-file-info { flex: 1; min-width: 0; }
.cpub-file-name { font-size: 13px; font-weight: 500; color: var(--accent); text-decoration: none; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpub-file-name:hover { text-decoration: underline; }
.cpub-file-size { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); }

.cpub-file-download {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: var(--accent-bg); border: 2px solid var(--accent-border);
  color: var(--accent); font-size: 12px; text-decoration: none; flex-shrink: 0;
}

.cpub-file-download:hover { background: var(--accent); color: var(--color-text-inverse); }

/* Cover image */
.cpub-hero-cover-has-image {
  background: var(--border);
}

.cpub-hero-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ── RESPONSIVE ── */
@media (max-width: 1024px) {
  .cpub-content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .cpub-page-outer { padding: 0 16px; }
  .cpub-hero-cover { height: 180px; }
}
</style>
