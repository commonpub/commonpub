<script setup lang="ts">
defineProps<{
  products: { items: Array<{ id: string; name: string; description: string | null; imageUrl: string | null; category: string | null; status: string }>; total: number } | null;
}>();
</script>

<template>
  <div v-if="products?.items?.length" class="cpub-products-grid">
    <div v-for="product in products.items" :key="product.id" class="cpub-product-card">
      <div class="cpub-product-card-icon">
        <img v-if="product.imageUrl" :src="product.imageUrl" :alt="product.name" />
        <i v-else class="fa-solid fa-microchip"></i>
      </div>
      <div class="cpub-product-card-body">
        <h4 class="cpub-product-card-name">{{ product.name }}</h4>
        <p class="cpub-product-card-desc">{{ product.description }}</p>
        <div class="cpub-product-card-meta">
          <span v-if="product.category" class="cpub-tag">{{ product.category }}</span>
          <span v-if="product.status === 'discontinued'" class="cpub-tag cpub-tag-red">Discontinued</span>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="cpub-empty-state">
    <div class="cpub-empty-state-icon"><i class="fa-solid fa-microchip"></i></div>
    <p class="cpub-empty-state-title">No products listed yet</p>
  </div>
</template>

<style scoped>
.cpub-products-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.cpub-product-card {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  gap: 14px;
  align-items: flex-start;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
}

.cpub-product-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.cpub-product-card-icon {
  width: 48px;
  height: 48px;
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--text-faint);
  flex-shrink: 0;
}
.cpub-product-card-icon img { width: 100%; height: 100%; object-fit: cover; }

.cpub-product-card-body { flex: 1; min-width: 0; }

.cpub-product-card-name { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 4px; }

.cpub-product-card-desc {
  font-size: 11px;
  color: var(--text-dim);
  line-height: 1.5;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cpub-product-card-meta { display: flex; gap: 6px; flex-wrap: wrap; }

@media (max-width: 1024px) {
  .cpub-products-grid { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .cpub-products-grid { grid-template-columns: 1fr; }
}
</style>
