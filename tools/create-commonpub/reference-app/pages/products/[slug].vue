<script setup lang="ts">
const route = useRoute();
const slug = route.params.slug as string;

const { data: product } = useLazyFetch(`/api/products/${slug}`) as { data: Ref<Record<string, any> | null> };
const { data: projectsUsing } = useLazyFetch(`/api/products/${slug}/content`) as { data: Ref<any[] | null> };

useSeoMeta({
  title: () => product.value ? `${product.value.name} — CommonPub` : 'Product — CommonPub',
  description: () => product.value?.description ?? '',
});
</script>

<template>
  <div v-if="product" class="product-detail">
    <NuxtLink to="/products" class="cpub-back-link"><i class="fa-solid fa-arrow-left"></i> Products</NuxtLink>

    <div class="product-layout">
      <!-- Main -->
      <div class="product-main">
        <div class="product-header">
          <div class="product-icon"><i class="fa-solid fa-microchip"></i></div>
          <div>
            <h1 class="product-name">{{ product.name }}</h1>
            <span v-if="product.category" class="product-category">{{ product.category }}</span>
          </div>
        </div>

        <p v-if="product.description" class="product-desc">{{ product.description }}</p>

        <!-- Specs -->
        <div v-if="product.specs && Object.keys(product.specs).length" class="product-specs">
          <h2 class="product-section-title">Specifications</h2>
          <div class="specs-grid">
            <div v-for="(val, key) in product.specs" :key="key" class="spec-item">
              <span class="spec-key">{{ key }}</span>
              <span class="spec-val">{{ val }}</span>
            </div>
          </div>
        </div>

        <!-- Links -->
        <div class="product-links">
          <a v-if="product.purchaseUrl" :href="product.purchaseUrl" target="_blank" rel="noopener" class="product-link-btn">
            <i class="fa-solid fa-cart-shopping"></i> Purchase
          </a>
          <a v-if="product.datasheetUrl" :href="product.datasheetUrl" target="_blank" rel="noopener" class="product-link-btn">
            <i class="fa-solid fa-file-pdf"></i> Datasheet
          </a>
        </div>

        <!-- Projects using this product -->
        <div v-if="projectsUsing?.length" class="product-projects">
          <h2 class="product-section-title">Projects Using This</h2>
          <div class="product-projects-grid">
            <ContentCard v-for="item in projectsUsing" :key="item.id" :item="item" />
          </div>
        </div>
        <div v-else class="product-projects-empty">
          <p>No projects using this product yet.</p>
        </div>
      </div>

      <!-- Sidebar -->
      <aside class="product-sidebar">
        <div class="product-sb-card">
          <h3 class="product-sb-label">Details</h3>
          <div class="product-sb-row" v-if="product.category">
            <span>Category</span>
            <span class="product-sb-val">{{ product.category }}</span>
          </div>
          <div class="product-sb-row" v-if="product.pricing">
            <span>Price</span>
            <span class="product-sb-val">{{ product.pricing }}</span>
          </div>
          <div class="product-sb-row" v-if="product.hub">
            <span>Hub</span>
            <NuxtLink :to="`/hubs/${product.hub.slug}`" class="product-sb-link">{{ product.hub.name }}</NuxtLink>
          </div>
        </div>
      </aside>
    </div>
  </div>
  <div v-else class="product-not-found">
    <h1>Product not found</h1>
  </div>
</template>

<style scoped>
.product-detail { max-width: 1080px; margin: 0 auto; padding: 32px; }
.cpub-back-link { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 20px; }
.cpub-back-link:hover { color: var(--accent); }

.product-layout { display: grid; grid-template-columns: 1fr 280px; gap: 32px; }

.product-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
.product-icon { width: 56px; height: 56px; border: 2px solid var(--border); background: var(--accent-bg); display: flex; align-items: center; justify-content: center; font-size: 24px; color: var(--accent); }
.product-name { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.product-category { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); text-transform: capitalize; }
.product-desc { font-size: 14px; color: var(--text-dim); line-height: 1.7; margin-bottom: 24px; }

.product-section-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }

.specs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; margin-bottom: 24px; }
.spec-item { display: flex; justify-content: space-between; padding: 8px 12px; border: 1px solid var(--border2); background: var(--surface); font-size: 12px; }
.spec-key { color: var(--text-dim); font-family: var(--font-mono); font-size: 11px; }
.spec-val { font-weight: 500; }

.product-links { display: flex; gap: 8px; margin-bottom: 32px; }
.product-link-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: 2px solid var(--border); background: var(--surface); color: var(--text); text-decoration: none; font-size: 13px; font-weight: 500; box-shadow: 4px 4px 0 var(--border); }
.product-link-btn:hover { box-shadow: 2px 2px 0 var(--border); transform: translate(1px, 1px); }

.product-projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.product-projects-empty { color: var(--text-faint); font-size: 13px; padding: 24px 0; }

.product-sidebar { display: flex; flex-direction: column; gap: 16px; }
.product-sb-card { padding: 16px; border: 2px solid var(--border); background: var(--surface); box-shadow: 4px 4px 0 var(--border); }
.product-sb-label { font-family: var(--font-mono); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--text-faint); margin-bottom: 12px; }
.product-sb-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border2); font-size: 13px; color: var(--text-dim); }
.product-sb-row:last-child { border-bottom: none; }
.product-sb-val { font-weight: 500; color: var(--text); }
.product-sb-link { color: var(--accent); text-decoration: none; font-weight: 500; }
.product-sb-link:hover { text-decoration: underline; }

.product-not-found { text-align: center; padding: 64px 0; color: var(--text-dim); }

@media (max-width: 768px) { .product-layout { grid-template-columns: 1fr; } }
</style>
