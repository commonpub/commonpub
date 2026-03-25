<script setup lang="ts">
useSeoMeta({ title: 'Video Hub — CommonPub' });

const activeFilter = ref('');
const sortOption = ref('recent');

const { data: categories } = await useFetch<Array<{ id: string; name: string; slug: string }>>('/api/videos/categories');
const page = ref(1);
const pageSize = 20;

// Reset page on filter change
watch([activeFilter, sortOption], () => { page.value = 1; });

const { data: videosData, pending: loadingVideos } = useFetch<{ items: any[]; total: number }>('/api/videos', {
  query: computed(() => ({
    categoryId: activeFilter.value || undefined,
    sort: sortOption.value,
    limit: pageSize,
    offset: (page.value - 1) * pageSize,
  })),
  watch: [activeFilter, sortOption, page],
});

const videos = computed(() => videosData.value?.items ?? []);
const totalVideos = computed(() => videosData.value?.total ?? 0);

const filterOptions = computed(() => {
  const cats = categories.value ?? [];
  return [{ id: '', name: 'All' }, ...cats];
});

function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

</script>

<template>
  <div class="cpub-videos">

    <!-- HERO -->
    <div class="cpub-video-hero">
      <div class="cpub-video-hero-inner">
        <div class="cpub-hero-eyebrow"><i class="fa-solid fa-play-circle"></i> &nbsp;Video Hub</div>
        <div class="cpub-hero-row">
          <h1 class="cpub-hero-title">Video Hub</h1>
          <span class="cpub-tag cpub-tag-live"><i class="fa-solid fa-circle" style="font-size:8px;"></i> Beta</span>
        </div>
        <p class="cpub-hero-sub">Tutorials, conference talks, project demos, and live build streams from the edge AI community.</p>
        <div class="cpub-hero-actions">
          <NuxtLink to="/videos/submit" class="cpub-btn cpub-btn-primary" style="text-decoration:none;"><i class="fa-solid fa-upload"></i> Submit Video</NuxtLink>
        </div>
      </div>
    </div>

    <!-- FILTER BAR -->
    <div class="cpub-filter-bar">
      <button
        v-for="f in filterOptions"
        :key="f.id"
        class="cpub-fchip"
        :class="{ active: activeFilter === f.id }"
        @click="activeFilter = f.id"
      >{{ f.name }}</button>
      <div class="cpub-filter-right">
        <select v-model="sortOption" class="cpub-sort-select">
          <option value="recent">Sort: Most Recent</option>
          <option value="viewed">Sort: Most Viewed</option>
          <option value="rated">Sort: Top Rated</option>
          <option value="shortest">Sort: Shortest First</option>
        </select>
      </div>
    </div>

    <!-- MAIN -->
    <div class="cpub-page-wrap">
      <div class="cpub-main-grid">

        <!-- LEFT COLUMN -->
        <div>
          <!-- FEATURED VIDEO (most viewed) -->
          <div v-if="videos.length" class="cpub-featured-section">
            <div class="cpub-sec-head">
              <h2>Featured</h2>
            </div>
            <NuxtLink :to="`/videos/${videos[0].id}`" class="cpub-featured-player" style="text-decoration: none; display: block;">
              <div class="cpub-featured-player-bg">
                <div class="cpub-featured-bg-gradient"></div>
                <div class="cpub-featured-bg-grid"></div>
                <div class="cpub-featured-player-icon"><i class="fa-solid fa-video"></i></div>
              </div>
              <div class="cpub-play-overlay">
                <div class="cpub-play-circle"><i class="fa fa-play"></i></div>
              </div>
              <div v-if="videos[0].duration" class="cpub-featured-duration">{{ formatDuration(videos[0].duration) }}</div>
            </NuxtLink>
            <div class="cpub-featured-info">
              <NuxtLink :to="`/videos/${videos[0].id}`" class="cpub-featured-title" style="text-decoration: none; color: inherit;">{{ videos[0].title }}</NuxtLink>
              <div class="cpub-featured-stats">
                <span><i class="fa-solid fa-eye"></i> {{ videos[0].viewCount.toLocaleString() }} views</span>
                <span>·</span>
                <span>{{ formatDate(videos[0].createdAt) }}</span>
              </div>
            </div>
          </div>

          <hr v-if="videos.length" class="cpub-divider" style="margin:20px 0;" />

          <!-- VIDEO GRID -->
          <div class="cpub-sec-head">
            <h2>Recent Videos</h2>
            <span class="cpub-sec-sub">{{ totalVideos }} videos</span>
          </div>

          <!-- Loading skeleton -->
          <div v-if="loadingVideos" class="cpub-video-grid">
            <div v-for="i in 4" :key="i" class="cpub-vcard">
              <div class="cpub-vcard-thumb" style="background: var(--surface2)">
                <div class="cpub-vcard-thumb-overlay"></div>
              </div>
              <div class="cpub-vcard-body">
                <div class="cpub-vcard-title" style="background: var(--surface2); height: 14px; width: 80%;"></div>
                <div class="cpub-vcard-stats" style="background: var(--surface2); height: 10px; width: 50%; margin-top: 8px;"></div>
              </div>
            </div>
          </div>

          <!-- Real data -->
          <div v-else-if="videos.length" class="cpub-video-grid">
            <NuxtLink v-for="v in videos" :key="v.id" :to="`/videos/${v.id}`" style="text-decoration: none;">
              <VideoCard :video="v" />
            </NuxtLink>
          </div>

          <!-- Empty state -->
          <div v-else class="cpub-empty-state">
            <div class="cpub-empty-icon"><i class="fa-solid fa-film"></i></div>
            <p class="cpub-empty-title">No videos yet</p>
            <p class="cpub-empty-sub">Be the first to upload a video to the community.</p>
          </div>

          <!-- Pagination -->
          <div v-if="totalVideos > pageSize" class="cpub-pagination">
            <button class="cpub-page-btn" :disabled="page <= 1" @click="page--">
              <i class="fa-solid fa-chevron-left" style="font-size: 10px"></i>
            </button>
            <span class="cpub-page-info">Page {{ page }} of {{ Math.ceil(totalVideos / pageSize) }}</span>
            <button class="cpub-page-btn" :disabled="page >= Math.ceil(totalVideos / pageSize)" @click="page++">
              <i class="fa-solid fa-chevron-right" style="font-size: 10px"></i>
            </button>
          </div>
        </div>

        <!-- SIDEBAR -->
        <aside class="cpub-sidebar">

          <!-- CATEGORIES -->
          <div class="cpub-sb-block">
            <div class="cpub-sb-block-head">
              <div class="cpub-sb-block-title">Categories</div>
            </div>
            <template v-if="categories?.length">
              <div v-for="cat in categories" :key="cat.id" class="cpub-playlist-item" style="cursor: pointer;" @click="activeFilter = cat.id">
                <div class="cpub-playlist-info">
                  <div class="cpub-playlist-title">{{ cat.name }}</div>
                </div>
              </div>
            </template>
            <div v-else style="padding: 14px 16px; font-size: 11px; color: var(--text-faint); font-family: var(--font-mono);">
              No categories yet
            </div>
          </div>

          <!-- STATS -->
          <div class="cpub-sb-block">
            <div class="cpub-sb-block-head">
              <div class="cpub-sb-block-title">Video Stats</div>
            </div>
            <div style="padding: 14px 16px; font-size: 11px; color: var(--text-dim); font-family: var(--font-mono);">
              {{ totalVideos }} total videos
            </div>
          </div>

        </aside>

      </div>
    </div>

  </div>
</template>

<style scoped>
/* HERO */
.cpub-video-hero { background: var(--surface); border-bottom: 2px solid var(--border); padding: 32px 32px 28px; }
.cpub-video-hero-inner { max-width: 1200px; margin: 0 auto; }
/* cpub-hero-eyebrow → global components.css */
.cpub-hero-row { display: flex; align-items: center; gap: 16px; margin-bottom: 4px; }
.cpub-hero-title { font-size: 28px; font-weight: 700; letter-spacing: -.03em; font-family: var(--font-mono); }
.cpub-hero-sub { font-size: 13px; color: var(--text-dim); margin-bottom: 18px; }
.cpub-hero-actions { display: flex; align-items: center; gap: 10px; }

/* TAGS (page-specific) */
.cpub-tag-live { background: var(--red); border-color: var(--red); color: var(--color-text-inverse); font-family: var(--font-mono); animation: cpub-livepulse 2s infinite; }
@keyframes cpub-livepulse { 0%,100% { opacity: 1; } 50% { opacity: .75; } }

/* FILTER BAR */
.cpub-filter-bar { background: var(--surface); border-bottom: 2px solid var(--border); padding: 0 32px; display: flex; align-items: center; gap: 6px; position: sticky; top: 48px; z-index: 50; overflow-x: auto; scrollbar-width: none; }
.cpub-filter-bar::-webkit-scrollbar { display: none; }
.cpub-fchip { font-size: 11px; font-family: var(--font-mono); padding: 12px 14px; border-bottom: 3px solid transparent; color: var(--text-dim); cursor: pointer; white-space: nowrap; background: none; border-top: none; border-left: none; border-right: none; }
.cpub-fchip:hover { color: var(--text); }
.cpub-fchip.active { color: var(--accent); border-bottom-color: var(--accent); }
.cpub-filter-right { margin-left: auto; display: flex; align-items: center; gap: 8px; padding: 8px 0; }
.cpub-sort-select { font-size: 11px; font-family: var(--font-mono); padding: 5px 12px; border-radius: var(--radius); border: 2px solid var(--border); background: var(--surface); color: var(--text-dim); cursor: pointer; outline: none; }

/* LAYOUT */
.cpub-page-wrap { max-width: 1200px; margin: 0 auto; padding: 28px 32px; }
.cpub-main-grid { display: grid; grid-template-columns: 1fr 300px; gap: 28px; align-items: start; }
/* cpub-sec-sub, cpub-sec-head-right → global components.css */
.cpub-view-all-link { font-size: 11px; color: var(--accent); font-family: var(--font-mono); text-decoration: none; }
.cpub-view-all-link:hover { text-decoration: underline; }

/* FEATURED VIDEO */
.cpub-featured-section { margin-bottom: 24px; }
.cpub-featured-player { background: var(--surface3); border: 2px solid var(--border); border-radius: var(--radius); aspect-ratio: 16/9; position: relative; overflow: hidden; cursor: pointer; box-shadow: 4px 4px 0 var(--border); }
.cpub-featured-player-bg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.cpub-featured-bg-grid { position: absolute; inset: 0; background-image: repeating-linear-gradient(0deg, var(--border2) 0, var(--border2) 1px, transparent 1px, transparent 32px), repeating-linear-gradient(90deg, var(--border2) 0, var(--border2) 1px, transparent 1px, transparent 32px); opacity: .3; }
.cpub-featured-bg-gradient { position: absolute; inset: 0; background: var(--surface3); }
.cpub-featured-player-icon { font-size: 48px; position: relative; z-index: 2; opacity: .25; color: var(--text-dim); }
.cpub-play-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 3; }
.cpub-play-circle { width: 68px; height: 68px; border-radius: 0; background: var(--surface); border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; box-shadow: 4px 4px 0 var(--border); transition: background .15s; }
.cpub-featured-player:hover .cpub-play-circle { background: var(--accent-bg); border-color: var(--accent); }
.cpub-play-circle i { font-size: 22px; color: var(--text); margin-left: 3px; }
.cpub-featured-duration { position: absolute; bottom: 12px; right: 12px; font-size: 11px; font-family: var(--font-mono); background: var(--surface); color: var(--text); padding: 3px 8px; border: 2px solid var(--border); z-index: 4; }
.cpub-featured-quality { position: absolute; bottom: 12px; left: 12px; z-index: 4; }
.cpub-featured-info { margin-top: 16px; }
.cpub-featured-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; line-height: 1.3; }
.cpub-featured-meta-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.cpub-featured-author { display: flex; align-items: center; gap: 8px; }
.cpub-featured-author-av { width: 24px; height: 24px; border-radius: 50%; background: var(--surface2); border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 9px; font-family: var(--font-mono); color: var(--text-dim); flex-shrink: 0; }
.cpub-featured-author-name { font-size: 12px; color: var(--text-dim); font-family: var(--font-mono); }
.cpub-featured-stats { display: flex; align-items: center; gap: 10px; font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); }
.cpub-featured-desc { font-size: 12px; color: var(--text-dim); line-height: 1.6; max-width: 640px; }

/* VIDEO GRID */
.cpub-video-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.cpub-vcard { background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius); overflow: hidden; cursor: pointer; transition: border-color .15s; box-shadow: 4px 4px 0 var(--border); }
.cpub-vcard:hover { border-color: var(--accent); }
.cpub-vcard:hover .cpub-vcard-title { color: var(--accent); }
.cpub-vcard-thumb { aspect-ratio: 16/9; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; border-bottom: 2px solid var(--border); }
.cpub-vcard-thumb-overlay { position: absolute; inset: 0; background: var(--surface3); opacity: .5; }
.cpub-vcard-thumb-icon { font-size: 24px; position: relative; z-index: 1; opacity: .3; color: var(--text-dim); }
.cpub-vcard-play { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 2; opacity: 0; transition: opacity .15s; }
.cpub-vcard:hover .cpub-vcard-play { opacity: 1; }
.cpub-vcard-play-btn { width: 38px; height: 38px; border-radius: 0; background: var(--surface); border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; box-shadow: 4px 4px 0 var(--border); }
.cpub-vcard-play-btn i { font-size: 13px; color: var(--text); margin-left: 2px; }
.cpub-vcard-duration { position: absolute; bottom: 8px; right: 8px; font-size: 10px; font-family: var(--font-mono); background: var(--surface); color: var(--text); padding: 2px 7px; border: 2px solid var(--border); z-index: 3; }
.cpub-vcard-type { position: absolute; top: 8px; left: 8px; z-index: 3; }
.cpub-vcard-body { padding: 12px 14px; }
.cpub-vcard-title { font-size: 12px; font-weight: 600; line-height: 1.35; margin-bottom: 7px; transition: color .1s; }
.cpub-vcard-author-row { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; }
.cpub-vcard-av { width: 18px; height: 18px; border-radius: 50%; background: var(--surface2); border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 7px; font-family: var(--font-mono); color: var(--text-faint); flex-shrink: 0; }
.cpub-vcard-author { font-size: 11px; color: var(--text-dim); font-family: var(--font-mono); }
.cpub-vcard-stats { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); display: flex; align-items: center; gap: 8px; }

/* SIDEBAR */
.cpub-sidebar { display: flex; flex-direction: column; gap: 0; }
.cpub-sb-block { background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius); overflow: hidden; margin-bottom: 16px; box-shadow: 4px 4px 0 var(--border); }
.cpub-sb-block-head { padding: 14px 16px; border-bottom: 2px solid var(--border); display: flex; align-items: center; justify-content: space-between; background: var(--surface2); }
.cpub-sb-block-title { font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--text); font-family: var(--font-mono); display: flex; align-items: center; gap: 6px; }
.cpub-sb-block-link { font-size: 10px; font-family: var(--font-mono); color: var(--accent); text-decoration: none; }
.cpub-sb-block-link:hover { text-decoration: underline; }

/* LIVE NOW */
.cpub-live-item { padding: 12px 16px; border-bottom: 2px solid var(--border2); cursor: pointer; }
.cpub-live-item:last-child { border-bottom: none; }
.cpub-live-item:hover .cpub-live-title { color: var(--accent); }
.cpub-live-item-top { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 6px; }
.cpub-live-thumb { width: 56px; height: 38px; border-radius: var(--radius); border: 2px solid var(--border); background: var(--red-bg); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; position: relative; overflow: hidden; }
.cpub-live-thumb-bg { position: absolute; inset: 0; background: var(--red-bg); }
.cpub-live-thumb-icon { position: relative; z-index: 1; color: var(--red); }
.cpub-live-title { font-size: 12px; font-weight: 600; line-height: 1.3; transition: color .1s; }
.cpub-live-meta { display: flex; align-items: center; gap: 8px; font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); }
.cpub-live-viewers { display: flex; align-items: center; gap: 4px; color: var(--red); }
.cpub-live-viewers::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--red); animation: cpub-livepulse 1.5s infinite; }

/* PLAYLISTS */
.cpub-playlist-item { display: flex; gap: 10px; padding: 12px 16px; border-bottom: 2px solid var(--border2); cursor: pointer; align-items: center; }
.cpub-playlist-item:last-child { border-bottom: none; }
.cpub-playlist-item:hover .cpub-playlist-title { color: var(--accent); }
.cpub-playlist-thumb-stack { width: 52px; height: 38px; position: relative; flex-shrink: 0; }
.cpub-pls-layer { position: absolute; border-radius: var(--radius); border: 2px solid var(--border); background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 11px; }
.cpub-pls-layer-1 { width: 100%; height: 100%; left: 0; top: 0; background: var(--surface3); }
.cpub-pls-layer-2 { width: 92%; height: 88%; left: 4%; top: -4px; background: var(--surface2); z-index: 1; }
.cpub-pls-layer-3 { width: 86%; height: 76%; left: 7%; top: -7px; background: var(--border2); z-index: 0; }
.cpub-pls-icon { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 2; font-size: 14px; color: var(--text-dim); }
.cpub-playlist-info { flex: 1; }
.cpub-playlist-title { font-size: 12px; font-weight: 600; margin-bottom: 2px; transition: color .1s; }
.cpub-playlist-count { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); }

/* CREATORS */
.cpub-creator-item { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 2px solid var(--border2); }
.cpub-creator-item:last-child { border-bottom: none; }
.cpub-creator-av { width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--border); background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 11px; font-family: var(--font-mono); font-weight: 600; color: var(--text-dim); flex-shrink: 0; }
.cpub-creator-info { flex: 1; }
.cpub-creator-name { font-size: 12px; font-weight: 600; }
.cpub-creator-subs { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); }
.cpub-creator-sub-btn { font-size: 10px; font-family: var(--font-mono); padding: 5px 12px; border-radius: var(--radius); border: 2px solid var(--border); background: var(--surface); color: var(--text-dim); cursor: pointer; white-space: nowrap; }
.cpub-creator-sub-btn:hover { background: var(--surface2); }
.cpub-subbed { border-color: var(--green); color: var(--green); background: var(--green-bg); }

/* PAGINATION (page-specific) */
.cpub-page-info { font-size: 11px; font-family: var(--font-mono); color: var(--text-dim); }

/* EMPTY STATE (page-specific) */
.cpub-empty-icon { font-size: 32px; color: var(--text-faint); margin-bottom: 12px; }
.cpub-empty-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.cpub-empty-sub { font-size: 12px; color: var(--text-dim); }
</style>
