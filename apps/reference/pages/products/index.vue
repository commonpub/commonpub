<script setup lang="ts">
useSeoMeta({ title: 'Products — CommonPub', description: 'Browse hardware products, components, and tools.' });

const search = ref('');
const category = ref('');

const { data: productsData, pending } = useFetch('/api/products', {
  query: computed(() => ({
    q: search.value || undefined,
    category: category.value || undefined,
    limit: 40,
  })),
  watch: [search, category],
});

const products = computed(() => productsData.value?.items ?? (Array.isArray(productsData.value) ? productsData.value : []));

const categories = [
  { value: '', label: 'All' },
  { value: 'microcontroller', label: 'Microcontrollers' },
  { value: 'sbc', label: 'SBCs' },
  { value: 'sensor', label: 'Sensors' },
  { value: 'actuator', label: 'Actuators' },
  { value: 'display', label: 'Displays' },
  { value: 'communication', label: 'Communication' },
  { value: 'power', label: 'Power' },
  { value: 'software', label: 'Software' },
  { value: 'tool', label: 'Tools' },
];
</script>

<template>
  <div class="products-page">
    <div class="products-header">
      <div>
        <h1 class="products-title">Products</h1>
        <p class="products-subtitle">Hardware components, boards, sensors, and tools used in maker projects.</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="products-filters">
      <div class="products-search-wrap">
        <i class="fa-solid fa-magnifying-glass products-search-icon"></i>
        <input v-model="search" type="search" class="products-search" placeholder="Search products..." />
      </div>
      <div class="products-cats">
        <button
          v-for="cat in categories"
          :key="cat.value"
          class="products-cat-chip"
          :class="{ active: category === cat.value }"
          @click="category = cat.value"
        >{{ cat.label }}</button>
      </div>
    </div>

    <!-- Grid -->
    <div v-if="pending" class="products-loading">Loading...</div>
    <div v-else-if="products.length" class="products-grid">
      <NuxtLink
        v-for="product in products"
        :key="product.id"
        :to="`/products/${product.slug}`"
        class="product-card"
      >
        <div class="product-card-icon">
          <i class="fa-solid fa-microchip"></i>
        </div>
        <div class="product-card-body">
          <h3 class="product-card-name">{{ product.name }}</h3>
          <span v-if="product.category" class="product-card-cat">{{ product.category }}</span>
          <div v-if="product.specs" class="product-card-specs">
            <span v-for="(val, key) in (typeof product.specs === 'object' ? Object.entries(product.specs).slice(0, 3) : [])" :key="key" class="product-spec">
              {{ val[0] }}: {{ val[1] }}
            </span>
          </div>
        </div>
      </NuxtLink>
    </div>
    <div v-else class="products-empty">
      <div class="products-empty-icon"><i class="fa-solid fa-cube"></i></div>
      <p class="products-empty-title">No products found</p>
      <p class="products-empty-sub">Products linked from project BOMs will appear here.</p>
    </div>
  </div>
</template>

<style scoped>
.products-page { max-width: 1080px; margin: 0 auto; padding: 32px; }
.products-header { margin-bottom: 24px; }
.products-title { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 4px; }
.products-subtitle { font-size: 13px; color: var(--text-dim); }

.products-filters { margin-bottom: 24px; }
.products-search-wrap { position: relative; margin-bottom: 12px; max-width: 400px; }
.products-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: var(--text-faint); }
.products-search { width: 100%; padding: 8px 10px 8px 30px; border: 2px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; }
.products-search:focus { border-color: var(--accent); outline: none; }

.products-cats { display: flex; gap: 4px; flex-wrap: wrap; }
.products-cat-chip { font-size: 11px; font-family: var(--font-mono); padding: 5px 12px; border: 2px solid var(--border); background: var(--surface); color: var(--text-dim); cursor: pointer; }
.products-cat-chip:hover { background: var(--surface2); color: var(--text); }
.products-cat-chip.active { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); }

.products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }

.product-card { border: 2px solid var(--border); background: var(--surface); text-decoration: none; color: var(--text); box-shadow: 4px 4px 0 var(--border); transition: box-shadow 0.15s, transform 0.15s; display: flex; gap: 12px; padding: 16px; }
.product-card:hover { box-shadow: 2px 2px 0 var(--border); transform: translate(1px, 1px); }
.product-card-icon { width: 40px; height: 40px; border: 2px solid var(--border); background: var(--accent-bg); display: flex; align-items: center; justify-content: center; font-size: 16px; color: var(--accent); flex-shrink: 0; }
.product-card-body { flex: 1; min-width: 0; }
.product-card-name { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.product-card-cat { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); text-transform: capitalize; display: block; margin-bottom: 6px; }
.product-card-specs { display: flex; flex-wrap: wrap; gap: 4px; }
.product-spec { font-size: 10px; font-family: var(--font-mono); color: var(--text-dim); background: var(--surface2); padding: 1px 6px; border: 1px solid var(--border2); }

.products-loading { text-align: center; padding: 48px 0; color: var(--text-faint); font-size: 13px; }
.products-empty { text-align: center; padding: 48px 0; }
.products-empty-icon { font-size: 32px; color: var(--text-faint); margin-bottom: 12px; }
.products-empty-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.products-empty-sub { font-size: 12px; color: var(--text-dim); }
</style>
