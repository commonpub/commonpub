<script setup lang="ts">
import type { HubViewModel } from '../../types/hub';

const props = defineProps<{
  hub: HubViewModel
  galleryTotal?: number
}>();

const hubType = computed(() => props.hub.hubType ?? 'community');
const isProductHub = computed(() => hubType.value === 'product');
const isCompanyHub = computed(() => hubType.value === 'company');
</script>

<template>
  <div class="cpub-hub-hero">
    <!-- Banner overlay slot (e.g., origin banner for federated hubs) -->
    <slot name="banner-overlay" />

    <div class="cpub-hub-banner" :style="hub.bannerUrl ? { backgroundImage: `url(${hub.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}">
      <template v-if="!hub.bannerUrl">
        <div class="cpub-hub-banner-pattern"></div>
        <div class="cpub-hub-banner-dots"></div>
      </template>
    </div>
    <div class="cpub-hub-meta-bar">
      <div class="cpub-hub-meta-inner">
        <div class="cpub-hub-icon">
          <img v-if="hub.iconUrl" :src="hub.iconUrl" :alt="hub.name ?? ''" />
          <i v-else :class="isCompanyHub ? 'fa-solid fa-building' : isProductHub ? 'fa-solid fa-microchip' : 'fa-solid fa-users'" />
        </div>
        <div class="cpub-hub-info">
          <div class="cpub-hub-top-row">
            <div>
              <h1 class="cpub-hub-name">{{ hub.name }}</h1>
              <p v-if="hub.description" class="cpub-hub-desc">{{ hub.description }}</p>
              <div class="cpub-hub-stats">
                <span class="cpub-hub-stat"><i class="fa-solid fa-users"></i> <span class="cpub-hub-stat-val">{{ hub.memberCount ?? 0 }}</span> Members</span>
                <span class="cpub-hub-stat"><i class="fa-solid fa-message"></i> <span class="cpub-hub-stat-val">{{ hub.postCount ?? 0 }}</span> Posts</span>
                <span v-if="galleryTotal" class="cpub-hub-stat"><i class="fa-solid fa-folder-open"></i> <span class="cpub-hub-stat-val">{{ galleryTotal }}</span> Projects</span>
                <span v-if="hub.foundedLabel" class="cpub-hub-stat"><i class="fa-solid fa-calendar"></i> Founded <span class="cpub-hub-stat-val">{{ hub.foundedLabel }}</span></span>
              </div>
              <div class="cpub-hub-actions">
                <slot name="actions" />
              </div>
            </div>
            <div class="cpub-hub-badges">
              <slot name="badges" />
            </div>
          </div>
          <div v-if="hub.categories?.length" class="cpub-hub-tags">
            <div class="cpub-tag-row">
              <span v-for="cat in hub.categories" :key="cat" class="cpub-tag">{{ cat }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-hub-hero { position: relative; overflow: hidden; }

.cpub-hub-banner {
  height: 180px;
  background: linear-gradient(135deg, var(--accent) 0%, #006b6b 50%, var(--accent-border) 100%);
  position: relative;
  overflow: hidden;
  border-bottom: var(--border-width-default) solid var(--border);
}

.cpub-hub-banner-pattern {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 40px 40px;
}

.cpub-hub-banner-dots {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px);
  background-size: 24px 24px;
}

.cpub-hub-meta-bar {
  background: var(--surface);
  border-bottom: var(--border-width-default) solid var(--border);
  padding: 20px 0;
}

.cpub-hub-meta-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 32px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.cpub-hub-icon {
  width: 72px;
  height: 72px;
  background: var(--surface);
  border: 3px solid var(--surface);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  flex-shrink: 0;
  margin-top: -36px;
  position: relative;
  z-index: 1;
  box-shadow: var(--shadow-md);
  color: var(--accent);
  overflow: hidden;
}
.cpub-hub-icon img { width: 100%; height: 100%; object-fit: cover; }

.cpub-hub-info { flex: 1; min-width: 0; }

.cpub-hub-top-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.cpub-hub-name {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-bottom: 4px;
}

.cpub-hub-desc {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.5;
  max-width: 600px;
  margin-bottom: 10px;
}

.cpub-hub-stats {
  display: flex;
  align-items: center;
  gap: 20px;
  font-size: 0.8125rem;
  color: var(--text-dim);
  margin-bottom: 12px;
}

.cpub-hub-stat { display: flex; align-items: center; gap: 5px; }
.cpub-hub-stat-val { color: var(--text); font-weight: 600; }

.cpub-hub-actions { display: flex; align-items: center; gap: 8px; }

.cpub-hub-badges {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.cpub-hub-tags { margin-top: 10px; }

@media (max-width: 1024px) {
  .cpub-hub-top-row { flex-direction: column; }
}

@media (max-width: 640px) {
  .cpub-hub-banner { height: 120px; }
  .cpub-hub-meta-inner { flex-direction: column; padding: 0 16px; }
  .cpub-hub-icon { margin-top: -24px; width: 56px; height: 56px; font-size: 22px; }
  .cpub-hub-name { font-size: 1.25rem; }
  .cpub-hub-stats { flex-wrap: wrap; gap: 10px 16px; font-size: 0.75rem; }
  .cpub-hub-actions { flex-wrap: wrap; }
  .cpub-hub-badges { flex-wrap: wrap; }
}
</style>
