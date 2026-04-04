<script setup lang="ts">
const props = defineProps<{
  activeTags: string[];
  suggestedTags: string[];
  categories: Array<{ icon: string; label: string }>;
  trendingSearches: Array<{ query: string; trend: number }> | null;
  relatedHubs: Array<{ id: string; name: string; slug: string; memberCount: number }>;
}>();

const emit = defineEmits<{
  'search': [query: string];
  'toggle-tag': [tag: string];
  'set-category': [label: string];
}>();

const { hubs: hubsEnabled } = useFeatures();
</script>

<template>
  <aside class="cpub-sidebar-col">
    <!-- Trending Searches -->
    <div class="cpub-sb-block">
      <div class="cpub-sb-heading">Trending Searches</div>
      <ul class="cpub-pop-search-list">
        <li
          v-for="(item, idx) in trendingSearches?.slice(0, 8) ?? []"
          :key="idx"
          class="cpub-pop-search-item"
          @click="emit('search', item.query)"
        >
          <span class="cpub-pop-rank" :class="{ top: idx < 3 }">{{ idx + 1 }}</span>
          <span class="cpub-pop-query">{{ item.query }}</span>
          <span v-if="item.trend" class="cpub-pop-trend" :class="item.trend > 0 ? 'trend-up' : 'trend-down'">
            <i :class="item.trend > 0 ? 'fa-solid fa-arrow-trend-up' : 'fa-solid fa-minus'" style="font-size: 9px"></i>
            <template v-if="item.trend > 0">+{{ item.trend }}%</template>
          </span>
        </li>
      </ul>
    </div>

    <!-- Suggested Tags -->
    <div class="cpub-sb-block">
      <div class="cpub-sb-heading">Suggested Tags</div>
      <div class="cpub-tag-cloud">
        <span
          v-for="tag in suggestedTags"
          :key="tag"
          class="cpub-s-tag"
          :class="{ active: activeTags.includes(tag) }"
          @click="emit('toggle-tag', tag)"
        >
          {{ tag }}
        </span>
      </div>
    </div>

    <!-- Browse by Category -->
    <div class="cpub-sb-block">
      <div class="cpub-sb-heading">Browse by Category</div>
      <p class="cpub-no-results-note">Not finding what you need? Try browsing a category directly.</p>
      <div class="cpub-cat-grid">
        <div v-for="cat in categories" :key="cat.label" class="cpub-cat-cell" @click="emit('set-category', cat.label)">
          <span class="cpub-cat-icon"><i :class="cat.icon"></i></span>
          <span class="cpub-cat-label">{{ cat.label }}</span>
        </div>
      </div>
    </div>

    <!-- Related Communities -->
    <div v-if="hubsEnabled && relatedHubs.length" class="cpub-sb-block">
      <div class="cpub-sb-heading">Related Communities</div>
      <div class="cpub-related-hubs">
        <div v-for="hub in relatedHubs" :key="hub.id" class="cpub-related-hub-item">
          <div class="cpub-related-hub-icon">
            <i class="fa-solid fa-users"></i>
          </div>
          <div class="cpub-related-hub-info">
            <NuxtLink :to="(hub as Record<string, unknown>).source === 'federated' ? `/federated-hubs/${hub.id}` : `/hubs/${hub.slug}`" class="cpub-related-hub-name">{{ hub.name }}</NuxtLink>
            <div class="cpub-related-hub-members">{{ hub.memberCount ?? 0 }} members</div>
          </div>
          <button class="cpub-btn-join-sm">
            <i class="fa-solid fa-plus" style="font-size: 8px"></i> Join
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.cpub-sb-block {
  background: var(--surface); border: var(--border-width-default) solid var(--border); padding: 20px;
  margin-bottom: 18px; box-shadow: var(--shadow-md);
}

.cpub-sb-heading {
  font-size: 10px; font-family: var(--font-mono); font-weight: 700;
  color: var(--text-faint); letter-spacing: 0.12em; text-transform: uppercase;
  margin-bottom: 12px; padding-bottom: 8px; border-bottom: var(--border-width-default) solid var(--border);
}

.cpub-pop-search-list { list-style: none; }

.cpub-pop-search-item {
  display: flex; align-items: center; gap: 8px; padding: 7px 0;
  border-bottom: var(--border-width-default) solid var(--border2); cursor: pointer;
}

.cpub-pop-search-item:last-child { border-bottom: none; }

.cpub-pop-rank {
  font-family: var(--font-mono); font-size: 10px; color: var(--text-faint);
  min-width: 16px; text-align: right;
}

.cpub-pop-rank.top { color: var(--accent); }

.cpub-pop-query { flex: 1; font-size: 12px; color: var(--text-dim); transition: color 0.15s; }
.cpub-pop-search-item:hover .cpub-pop-query { color: var(--text); }

.cpub-pop-trend {
  font-size: 10px; font-family: var(--font-mono); display: flex; align-items: center; gap: 3px;
}

.trend-up { color: var(--green); }
.trend-down { color: var(--text-faint); }

.cpub-tag-cloud { display: flex; flex-wrap: wrap; gap: 6px; }

.cpub-s-tag {
  font-size: 10px; font-family: var(--font-mono); padding: 4px 10px;
  border: var(--border-width-default) solid var(--border); background: var(--surface2); color: var(--text-dim);
  cursor: pointer; transition: all 0.15s;
}

.cpub-s-tag:hover,
.cpub-s-tag.active {
  border-color: var(--accent); color: var(--accent); background: var(--accent-bg);
}

.cpub-no-results-note { font-size: 11px; color: var(--text-faint); margin-bottom: 12px; line-height: 1.55; }

.cpub-cat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }

.cpub-cat-cell {
  background: var(--surface2); border: var(--border-width-default) solid var(--border); padding: 10px;
  cursor: pointer; transition: border-color 0.15s, background 0.15s; text-align: center;
}

.cpub-cat-cell:hover { border-color: var(--accent); background: var(--surface3); }
.cpub-cat-icon { font-size: 18px; margin-bottom: 4px; display: block; }
.cpub-cat-label { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); line-height: 1.3; }

.cpub-related-hubs { display: flex; flex-direction: column; gap: 8px; }

.cpub-related-hub-item {
  display: flex; align-items: center; gap: 10px; padding: 8px 0;
  border-bottom: var(--border-width-default) solid var(--border2); cursor: pointer;
}

.cpub-related-hub-item:last-child { border-bottom: none; }
.cpub-related-hub-icon { font-size: 20px; width: 32px; text-align: center; flex-shrink: 0; }
.cpub-related-hub-info { flex: 1; min-width: 0; }

.cpub-related-hub-name {
  font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 1px;
  display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-decoration: none;
}

.cpub-related-hub-name:hover { color: var(--accent); }
.cpub-related-hub-members { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); }

.cpub-btn-join-sm {
  font-size: 10px; font-family: var(--font-mono); padding: 3px 8px;
  border: var(--border-width-default) solid var(--border); background: var(--green-bg); color: var(--green);
  cursor: pointer; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px;
  box-shadow: var(--shadow-sm); transition: all 0.15s;
}

.cpub-btn-join-sm:hover { box-shadow: var(--shadow-sm); }
</style>
