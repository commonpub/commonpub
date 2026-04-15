<script setup lang="ts">
const props = defineProps<{
  products: { items: Array<{ id: string; name: string; description: string | null; imageUrl: string | null; category: string | null; status: string }>; total: number } | null;
  currentUserRole?: string | null;
  hubSlug?: string;
}>();

const emit = defineEmits<{ 'product-created': [] }>();

const canManage = computed(() => ['owner', 'admin', 'moderator'].includes(props.currentUserRole ?? ''));
const showForm = ref(false);
const formName = ref('');
const formDescription = ref('');
const formCategory = ref('other');
const formPurchaseUrl = ref('');
const creating = ref(false);

async function handleCreate(): Promise<void> {
  if (!formName.value.trim() || !props.hubSlug) return;
  creating.value = true;
  try {
    await $fetch(`/api/hubs/${props.hubSlug}/products`, {
      method: 'POST',
      body: { name: formName.value, description: formDescription.value || undefined, category: formCategory.value, purchaseUrl: formPurchaseUrl.value || undefined },
    });
    formName.value = '';
    formDescription.value = '';
    formCategory.value = 'other';
    formPurchaseUrl.value = '';
    showForm.value = false;
    emit('product-created');
  } catch { /* toast error */ }
  finally { creating.value = false; }
}
</script>

<template>
  <div>
    <div v-if="canManage && hubSlug" class="cpub-products-header">
      <button class="cpub-btn cpub-btn-sm" @click="showForm = !showForm">
        <i :class="showForm ? 'fa-solid fa-times' : 'fa-solid fa-plus'"></i>
        {{ showForm ? 'Cancel' : 'Add Product' }}
      </button>
    </div>

    <form v-if="showForm" class="cpub-resource-form" @submit.prevent="handleCreate">
      <input v-model="formName" type="text" placeholder="Product name" class="cpub-input" required />
      <input v-model="formDescription" type="text" placeholder="Short description (optional)" class="cpub-input" />
      <select v-model="formCategory" class="cpub-input" aria-label="Product category">
        <option value="microcontroller">Microcontroller</option>
        <option value="sbc">SBC</option>
        <option value="sensor">Sensor</option>
        <option value="actuator">Actuator</option>
        <option value="display">Display</option>
        <option value="communication">Communication</option>
        <option value="power">Power</option>
        <option value="mechanical">Mechanical</option>
        <option value="software">Software</option>
        <option value="tool">Tool</option>
        <option value="other">Other</option>
      </select>
      <input v-model="formPurchaseUrl" type="url" placeholder="Purchase URL (optional)" class="cpub-input" />
      <button type="submit" class="cpub-btn cpub-btn-primary cpub-btn-sm" :disabled="creating || !formName.trim()">
        {{ creating ? 'Adding...' : 'Add Product' }}
      </button>
    </form>

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
  </div>
</template>

<style scoped>
.cpub-products-header { margin-bottom: 16px; }

.cpub-resource-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  margin-bottom: 20px;
}

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

@media (max-width: 768px) {
  .cpub-products-grid { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .cpub-products-grid { grid-template-columns: 1fr; }
}
</style>
