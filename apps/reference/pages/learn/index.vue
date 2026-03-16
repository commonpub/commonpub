<script setup lang="ts">
useSeoMeta({ title: 'Learn — CommonPub' });

interface PathItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  difficulty: string | null;
  status: string;
  moduleCount: number;
  enrollmentCount: number;
  createdAt: string;
}

interface EnrollmentItem {
  pathId: string;
  pathTitle: string;
  progress: number;
  currentModule: string | null;
  enrolledAt: string;
}

const { isAuthenticated } = useAuth();

const { data: pathsData, pending: loadingPaths } = useFetch<{ items: PathItem[]; total: number }>('/api/learn');
const { data: enrollments } = useFetch<EnrollmentItem[]>('/api/learn/enrollments', {
  immediate: isAuthenticated.value,
});
const { data: certificates } = useFetch<Array<{ name: string; earnedAt: string }>>('/api/learn/certificates', {
  immediate: isAuthenticated.value,
});

const paths = computed(() => pathsData.value?.items ?? []);
const totalPaths = computed(() => pathsData.value?.total ?? 0);
const inProgress = computed(() => enrollments.value?.filter(e => e.progress > 0 && e.progress < 100) ?? []);

function getDifficultyClass(difficulty: string | null): string {
  switch (difficulty) {
    case 'beginner': return 'cpub-tag-green';
    case 'intermediate': return 'cpub-tag-yellow';
    case 'advanced': return 'cpub-tag-red';
    default: return '';
  }
}

const heroCategories = [
  { name: 'All', icon: 'fa-solid fa-layer-group' },
  { name: 'TinyML', icon: 'fa-solid fa-microchip' },
  { name: 'Computer Vision', icon: 'fa-solid fa-eye' },
  { name: 'FPGA', icon: 'fa-solid fa-diagram-project' },
  { name: 'Audio', icon: 'fa-solid fa-waveform' },
];
const activeHeroCat = ref('All');
</script>

<template>
  <div class="cpub-learn">

    <!-- HERO -->
    <div class="cpub-learn-hero">
      <div class="cpub-learn-hero-inner">
        <div class="cpub-hero-eyebrow"><i class="fa-solid fa-graduation-cap"></i> &nbsp;Learning Hub</div>
        <h1 class="cpub-hero-title">Learn Edge AI</h1>
        <p class="cpub-hero-sub">Structured courses, interactive explainers, and hands-on tutorials — from beginner to production-ready.</p>
        <div class="cpub-hero-cats">
          <div
            v-for="c in heroCategories"
            :key="c.name"
            class="cpub-hero-cat"
            :class="{ active: activeHeroCat === c.name }"
            @click="activeHeroCat = c.name"
          >
            <span class="cpub-hero-cat-icon"><i :class="c.icon"></i></span> {{ c.name }}
          </div>
        </div>
        <div class="cpub-hero-stats">
          <div class="cpub-hero-stat"><div class="cpub-hero-stat-n">{{ totalPaths }}</div><div class="cpub-hero-stat-l">paths</div></div>
          <div class="cpub-hero-stat"><div class="cpub-hero-stat-n">{{ inProgress.length }}</div><div class="cpub-hero-stat-l">in progress</div></div>
        </div>
      </div>
    </div>

    <!-- SHELL -->
    <div class="cpub-shell">
      <div class="cpub-main-content">
        <div class="cpub-page">

          <!-- MY LEARNING -->
          <template v-if="isAuthenticated && inProgress.length">
            <div class="cpub-sec-head">
              <h2>My Learning</h2>
              <span class="cpub-sec-sub">{{ inProgress.length }} in progress</span>
            </div>

            <div class="cpub-ip-row">
              <div v-for="ip in inProgress" :key="ip.pathId" class="cpub-ip-card">
                <div class="cpub-ip-thumb">
                  <div class="cpub-ip-thumb-icon"><i class="fa-solid fa-graduation-cap"></i></div>
                </div>
                <div class="cpub-ip-body">
                  <div class="cpub-ip-title">{{ ip.pathTitle }}</div>
                  <div class="cpub-ip-meta">{{ ip.currentModule || 'In progress' }}</div>
                  <div class="cpub-ip-progress-label">
                    <span class="cpub-ip-progress-text">{{ ip.progress }}% complete</span>
                    <span class="cpub-ip-progress-pct">{{ ip.progress }}%</span>
                  </div>
                  <div class="cpub-progress-track"><div class="cpub-progress-fill" :style="{ width: ip.progress + '%' }"></div></div>
                  <NuxtLink :to="`/learn/${ip.pathId}`" class="cpub-ip-continue"><i class="fa-solid fa-play" style="font-size:9px;"></i> Continue Learning</NuxtLink>
                </div>
              </div>
            </div>

            <hr class="cpub-divider" />
          </template>

          <!-- LEARNING PATHS -->
          <div class="cpub-sec-head">
            <h2>Learning Paths</h2>
            <span class="cpub-sec-sub">{{ totalPaths }} paths</span>
          </div>

          <!-- Loading -->
          <div v-if="loadingPaths" style="padding: 24px 0; text-align: center; color: var(--text-faint); font-size: 12px;">
            Loading paths...
          </div>

          <!-- Real data -->
          <template v-else-if="paths.length">
            <NuxtLink v-for="p in paths" :key="p.id" :to="`/learn/${p.slug}`" class="cpub-path-card" style="text-decoration: none; color: inherit;">
              <div class="cpub-path-icon-wrap"><i class="fa-solid fa-route"></i></div>
              <div class="cpub-path-body">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                  <div class="cpub-path-title">{{ p.title }}</div>
                  <span v-if="p.difficulty" class="cpub-tag" :class="getDifficultyClass(p.difficulty)">{{ p.difficulty }}</span>
                </div>
                <div v-if="p.description" class="cpub-path-desc">{{ p.description }}</div>
                <div class="cpub-path-meta">
                  <div class="cpub-path-meta-item"><i class="fa-solid fa-book-open"></i> {{ p.moduleCount }} modules</div>
                  <div class="cpub-path-meta-item"><i class="fa-solid fa-users"></i> {{ p.enrollmentCount }} enrolled</div>
                </div>
              </div>
              <div class="cpub-path-aside">
                <button class="cpub-btn cpub-btn-sm cpub-btn-primary">View Path</button>
              </div>
            </NuxtLink>
          </template>

          <!-- Empty state -->
          <div v-else class="cpub-empty-state">
            <div class="cpub-empty-icon"><i class="fa-solid fa-graduation-cap"></i></div>
            <p class="cpub-empty-title">No learning paths yet</p>
            <p class="cpub-empty-sub">Learning paths will appear here once they're created.</p>
          </div>

        </div>
      </div>

      <!-- SIDEBAR -->
      <aside class="cpub-sidebar">

        <div class="cpub-sb-section">
          <div class="cpub-sb-title">Stats</div>
          <div style="font-size: 11px; color: var(--text-dim); font-family: var(--font-mono);">
            {{ totalPaths }} learning paths
          </div>
        </div>

        <template v-if="isAuthenticated && certificates?.length">
          <div class="cpub-sb-section">
            <div class="cpub-sb-title">Certificates Earned</div>
            <div class="cpub-cert-grid">
              <div v-for="c in certificates" :key="c.name" class="cpub-cert-item">
                <div class="cpub-cert-badge"><i class="fa-solid fa-medal"></i></div>
                <div class="cpub-cert-info">
                  <div class="cpub-cert-name">{{ c.name }}</div>
                  <div class="cpub-cert-date">{{ c.earnedAt }}</div>
                </div>
              </div>
            </div>
          </div>
        </template>

      </aside>
    </div>

  </div>
</template>

<style scoped>
/* HERO */
.cpub-learn-hero { background: var(--surface); border-bottom: 2px solid var(--border); padding: 36px 32px 28px; }
.cpub-learn-hero-inner { max-width: 960px; margin: 0 auto; }
.cpub-hero-eyebrow { font-size: 10px; font-family: var(--font-mono); color: var(--accent); letter-spacing: .12em; text-transform: uppercase; margin-bottom: 10px; }
.cpub-hero-title { font-size: 28px; font-weight: 700; line-height: 1.15; margin-bottom: 10px; letter-spacing: -.03em; }
.cpub-hero-sub { font-size: 14px; color: var(--text-dim); line-height: 1.6; max-width: 520px; margin-bottom: 24px; }
.cpub-hero-cats { display: flex; gap: 8px; flex-wrap: wrap; }
.cpub-hero-cat { font-size: 11px; font-family: var(--font-mono); padding: 6px 14px; border-radius: var(--radius); border: 2px solid var(--border); background: var(--surface); color: var(--text-dim); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.cpub-hero-cat:hover { background: var(--surface2); color: var(--text); }
.cpub-hero-cat.active { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); box-shadow: 3px 3px 0 var(--border); }
.cpub-hero-cat-icon { font-size: 12px; }
.cpub-hero-stats { display: flex; gap: 24px; margin-top: 24px; padding-top: 20px; border-top: 2px solid var(--border); }
.cpub-hero-stat { display: flex; flex-direction: column; gap: 2px; }
.cpub-hero-stat-n { font-size: 18px; font-weight: 700; color: var(--text); }
.cpub-hero-stat-l { font-size: 10px; font-family: var(--font-mono); color: var(--text-dim); }

/* SHELL LAYOUT */
.cpub-shell { display: flex; min-height: calc(100vh - 48px); }
.cpub-main-content { flex: 1; overflow-y: auto; overflow-x: hidden; }
.cpub-page { max-width: 960px; margin: 0 auto; padding: 28px 32px; }
.cpub-sidebar { width: 240px; background: var(--surface); border-left: 2px solid var(--border); flex-shrink: 0; overflow-y: auto; padding: 20px 0; }

/* PRIMITIVES */
.cpub-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-family: var(--font-mono); padding: 2px 8px; border-radius: 0; border: 1px solid var(--border2); color: var(--text-dim); background: var(--surface2); }
.cpub-tag-accent { border-color: var(--accent-border); color: var(--accent); background: var(--accent-bg); }
.cpub-tag-green { border-color: var(--green-border); color: var(--green); background: var(--green-bg); }
.cpub-tag-yellow { border-color: var(--yellow-border); color: var(--yellow); background: var(--yellow-bg); }
.cpub-tag-red { border-color: var(--red-border); color: var(--red); background: var(--red-bg); }
.cpub-tag-purple { border-color: var(--purple-border); color: var(--purple); background: var(--purple-bg); }
.cpub-tag-teal { border-color: var(--teal-border); color: var(--teal); background: var(--teal-bg); }

.cpub-btn { font-family: var(--font-sans); font-size: 12px; padding: 7px 16px; border-radius: var(--radius); border: 2px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.cpub-btn:hover { background: var(--surface2); }
.cpub-btn-primary { background: var(--accent); border-color: var(--border); color: var(--color-text-inverse); box-shadow: 4px 4px 0 var(--border); }
.cpub-btn-primary:hover { opacity: .9; }
.cpub-btn-sm { padding: 5px 12px; font-size: 11px; }
.cpub-btn-xs { padding: 3px 8px; font-size: 10px; font-family: var(--font-mono); }
.cpub-btn-progress { background: var(--accent-bg); border-color: var(--accent-border); color: var(--accent); }

.cpub-link { font-size: 11px; color: var(--accent); font-family: var(--font-mono); text-decoration: none; }
.cpub-link:hover { text-decoration: underline; }

.cpub-divider { border: none; border-top: 2px solid var(--border); margin: 28px 0; }

.cpub-progress-track { height: 4px; background: var(--surface3); border-radius: 0; overflow: hidden; border: 1px solid var(--border2); }
.cpub-progress-fill { height: 100%; border-radius: 0; background: var(--accent); }

/* SECTION HEADS */
.cpub-sec-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.cpub-sec-head h2 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.cpub-sec-sub { font-size: 11px; color: var(--text-dim); font-family: var(--font-mono); }
.cpub-sec-head-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }

/* MY LEARNING */
.cpub-ip-row { display: flex; gap: 14px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
.cpub-ip-row::-webkit-scrollbar { display: none; }
.cpub-ip-card { background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius); overflow: hidden; min-width: 220px; max-width: 220px; flex-shrink: 0; box-shadow: 4px 4px 0 var(--border); }
.cpub-ip-card:hover { box-shadow: 5px 5px 0 var(--border); }
.cpub-ip-thumb { height: 100px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--surface3); }
.cpub-ip-thumb-icon { font-size: 24px; position: relative; z-index: 1; color: var(--text-dim); }
.cpub-ip-thumb-badge { position: absolute; top: 8px; right: 8px; z-index: 2; }
.cpub-ip-body { padding: 14px; }
.cpub-ip-title { font-size: 12px; font-weight: 600; margin-bottom: 4px; line-height: 1.35; }
.cpub-ip-meta { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); margin-bottom: 10px; }
.cpub-ip-progress-label { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.cpub-ip-progress-text { font-size: 10px; font-family: var(--font-mono); color: var(--text-dim); }
.cpub-ip-progress-pct { font-size: 10px; font-family: var(--font-mono); color: var(--accent); }
.cpub-ip-continue { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 10px; padding: 7px; border-top: 2px solid var(--border); font-size: 11px; color: var(--accent); font-family: var(--font-mono); cursor: pointer; }
.cpub-ip-continue:hover { background: var(--accent-bg); }

/* LEARNING PATHS */
.cpub-path-card { background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius); padding: 20px; display: flex; gap: 20px; align-items: flex-start; margin-bottom: 12px; box-shadow: 4px 4px 0 var(--border); }
.cpub-path-card:hover { box-shadow: 5px 5px 0 var(--border); }
.cpub-path-icon-wrap { width: 52px; height: 52px; border-radius: var(--radius); border: 2px solid var(--border); background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; color: var(--text-dim); }
.cpub-path-body { flex: 1; }
.cpub-path-title { font-size: 14px; font-weight: 600; }
.cpub-path-desc { font-size: 12px; color: var(--text-dim); line-height: 1.55; margin-bottom: 12px; }
.cpub-path-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.cpub-path-meta-item { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); display: flex; align-items: center; gap: 5px; }
.cpub-path-courses-preview { display: flex; gap: 6px; margin-top: 12px; padding-top: 12px; border-top: 2px solid var(--border2); overflow-x: auto; }
.cpub-path-course-pill { font-size: 10px; font-family: var(--font-mono); padding: 3px 10px; border-radius: 0; border: 1px solid var(--border); background: var(--surface2); color: var(--text-dim); white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; }
.cpub-pill-done { border-color: var(--green-border); color: var(--green); background: var(--green-bg); }
.cpub-path-aside { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; flex-shrink: 0; }
.cpub-path-aside-meta { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); }

/* COURSES */
.cpub-course-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.cpub-course-card { background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius); overflow: hidden; display: flex; flex-direction: column; box-shadow: 4px 4px 0 var(--border); }
.cpub-course-card:hover { box-shadow: 5px 5px 0 var(--border); }
.cpub-course-cover { height: 120px; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; background: var(--surface3); border-bottom: 2px solid var(--border); }
.cpub-course-cover-icon { font-size: 28px; position: relative; z-index: 1; color: var(--text-dim); }
.cpub-course-cover-price { position: absolute; top: 10px; right: 10px; z-index: 2; font-size: 11px; font-family: var(--font-mono); padding: 3px 8px; border-radius: 0; background: var(--surface); border: 2px solid var(--border); }
.cpub-price-free { color: var(--green); border-color: var(--green); }
.cpub-price-paid { color: var(--text); }
.cpub-course-body { padding: 14px; flex: 1; display: flex; flex-direction: column; }
.cpub-course-title { font-size: 13px; font-weight: 600; margin-bottom: 6px; line-height: 1.35; }
.cpub-course-instructor { font-size: 11px; color: var(--text-dim); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.cpub-instructor-dot { width: 16px; height: 16px; border-radius: 50%; background: var(--surface3); border: 1px solid var(--border); font-size: 8px; display: flex; align-items: center; justify-content: center; font-family: var(--font-mono); color: var(--text-faint); flex-shrink: 0; }
.cpub-course-stars { display: flex; align-items: center; gap: 3px; margin-bottom: 8px; }
.cpub-star { color: var(--yellow); font-size: 10px; }
.cpub-star-empty { color: var(--border2); }
.cpub-star-score { font-size: 11px; font-family: var(--font-mono); color: var(--yellow); margin-left: 2px; }
.cpub-star-count { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); margin-left: 2px; }
.cpub-course-meta-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.cpub-course-meta-item { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); display: flex; align-items: center; gap: 4px; }
.cpub-course-footer { margin-top: auto; padding-top: 10px; border-top: 2px solid var(--border2); }
.cpub-course-enrolled-progress { margin-bottom: 8px; }
.cpub-course-enrolled-label { font-size: 10px; font-family: var(--font-mono); color: var(--accent); margin-bottom: 5px; }
.cpub-course-actions { display: flex; align-items: center; justify-content: space-between; }
.cpub-course-lesson-label { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); }

/* EXPLAINERS */
.cpub-explainer-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.cpub-explainer-card { background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius); padding: 18px; display: flex; gap: 16px; align-items: flex-start; box-shadow: 4px 4px 0 var(--border); }
.cpub-explainer-card:hover { box-shadow: 5px 5px 0 var(--border); }
.cpub-explainer-icon { width: 44px; height: 44px; border-radius: var(--radius); border: 2px solid var(--border); background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; color: var(--text-dim); }
.cpub-explainer-body { flex: 1; }
.cpub-explainer-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
.cpub-explainer-desc { font-size: 12px; color: var(--text-dim); line-height: 1.5; margin-bottom: 10px; }
.cpub-explainer-meta { display: flex; align-items: center; gap: 10px; }
.cpub-explainer-time { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); display: flex; align-items: center; gap: 4px; }
.cpub-explainer-action { margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }

/* TUTORIALS */
.cpub-tutorial-list { display: flex; flex-direction: column; }
.cpub-tutorial-row { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-bottom: 2px solid var(--border2); cursor: pointer; }
.cpub-tutorial-row:last-child { border-bottom: none; }
.cpub-tutorial-row:hover .cpub-tutorial-title { color: var(--accent); }
.cpub-tutorial-icon { width: 36px; height: 36px; border-radius: var(--radius); background: var(--surface2); border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; color: var(--text-dim); }
.cpub-tutorial-body { flex: 1; }
.cpub-tutorial-title { font-size: 12px; font-weight: 600; margin-bottom: 3px; transition: color .1s; }
.cpub-tutorial-meta { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); display: flex; align-items: center; gap: 8px; }
.cpub-tutorial-aside { display: flex; align-items: center; gap: 8px; margin-left: auto; flex-shrink: 0; }
.cpub-tutorial-steps { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); }

/* SIDEBAR */
.cpub-sb-section { padding: 0 16px 20px; }
.cpub-sb-section + .cpub-sb-section { border-top: 2px solid var(--border); padding-top: 20px; }
.cpub-sb-title { font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--text-faint); font-family: var(--font-mono); margin-bottom: 12px; }
.cpub-sb-cat-item { display: flex; align-items: center; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--border2); cursor: pointer; }
.cpub-sb-cat-item:last-child { border-bottom: none; }
.cpub-sb-cat-item:hover .cpub-sb-cat-name { color: var(--text); }
.cpub-sb-cat-icon { width: 24px; height: 24px; border-radius: var(--radius); background: var(--surface2); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; color: var(--text-dim); }
.cpub-sb-cat-name { font-size: 12px; color: var(--text-dim); }
.cpub-sb-cat-count { margin-left: auto; font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); }
.cpub-sb-level-row { display: flex; flex-direction: column; gap: 6px; }
.cpub-sb-level-item { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.cpub-sb-level-check { width: 14px; height: 14px; border-radius: 0; border: 2px solid var(--border); background: var(--surface); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 8px; }
.cpub-checked { background: var(--accent); border-color: var(--border); color: var(--color-text-inverse); }
.cpub-sb-level-name { font-size: 12px; color: var(--text-dim); }
.cpub-sb-level-n { margin-left: auto; font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); }
.cpub-sb-tag-cloud { display: flex; flex-wrap: wrap; gap: 6px; }
.cpub-sb-tag { font-size: 10px; font-family: var(--font-mono); padding: 3px 8px; border-radius: 0; border: 1px solid var(--border); background: var(--surface2); color: var(--text-faint); cursor: pointer; }
.cpub-sb-tag:hover { border-color: var(--border); color: var(--text-dim); background: var(--surface3); }
.cpub-cert-grid { display: flex; flex-direction: column; gap: 8px; }
.cpub-cert-item { background: var(--surface2); border: 2px solid var(--border); border-radius: var(--radius); padding: 10px 12px; display: flex; align-items: center; gap: 10px; box-shadow: 3px 3px 0 var(--border); }
.cpub-cert-badge { width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--yellow); background: var(--yellow-bg); display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; color: var(--yellow); }
.cpub-cert-info { flex: 1; }
.cpub-cert-name { font-size: 11px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
.cpub-cert-date { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); }

/* EMPTY STATE */
.cpub-empty-state { text-align: center; padding: 48px 16px; }
.cpub-empty-icon { font-size: 32px; color: var(--text-faint); margin-bottom: 12px; }
.cpub-empty-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.cpub-empty-sub { font-size: 12px; color: var(--text-dim); }
</style>
