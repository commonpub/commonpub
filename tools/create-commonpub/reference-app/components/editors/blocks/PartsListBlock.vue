<script setup lang="ts">
/**
 * Parts list block — editable BOM table with product catalog autocomplete.
 * When a user selects a product from the catalog, the productId is stored
 * so the content-products join table can be synced on save (BOM → product hub gallery).
 */
interface Part {
  name: string;
  qty: number;
  price?: number;
  url?: string;
  category?: string;
  required?: boolean;
  notes?: string;
  productId?: string;
  productSlug?: string;
}

interface ProductResult {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  imageUrl: string | null;
  purchaseUrl: string | null;
}

const props = defineProps<{
  content: Record<string, unknown>;
}>();

const emit = defineEmits<{
  update: [content: Record<string, unknown>];
}>();

const parts = computed(() => (props.content.parts as Part[]) ?? []);

function updatePart(index: number, field: string, value: unknown): void {
  const updated = [...parts.value];
  updated[index] = { ...updated[index]!, [field]: value };
  emit('update', { parts: updated });
}

function addPart(): void {
  emit('update', { parts: [...parts.value, { name: '', qty: 1, required: true }] });
}

function removePart(index: number): void {
  const updated = parts.value.filter((_: Part, i: number) => i !== index);
  emit('update', { parts: updated });
}

function selectProduct(index: number, product: ProductResult): void {
  const updated = [...parts.value];
  updated[index] = {
    ...updated[index]!,
    name: product.name,
    url: product.purchaseUrl ?? undefined,
    productId: product.id,
    productSlug: product.slug,
    category: product.category ?? undefined,
  };
  emit('update', { parts: updated });
  // Close autocomplete
  activeAutocomplete.value = -1;
  autocompleteResults.value = [];
}

function clearProductLink(index: number): void {
  const updated = [...parts.value];
  updated[index] = { ...updated[index]!, productId: undefined, productSlug: undefined };
  emit('update', { parts: updated });
}

const totalPrice = computed(() => {
  return parts.value.reduce((sum: number, p: Part) => sum + (p.price ?? 0) * p.qty, 0);
});

// --- Autocomplete ---
const activeAutocomplete = ref(-1);
const autocompleteResults = ref<ProductResult[]>([]);
const autocompleteLoading = ref(false);
const debounceTimer = ref<ReturnType<typeof setTimeout> | null>(null);

function onNameInput(index: number, value: string): void {
  updatePart(index, 'name', value);

  // Clear product link when name changes manually
  if (parts.value[index]?.productId) {
    clearProductLink(index);
  }

  if (debounceTimer.value) clearTimeout(debounceTimer.value);

  if (value.length < 2) {
    autocompleteResults.value = [];
    activeAutocomplete.value = -1;
    return;
  }

  activeAutocomplete.value = index;
  debounceTimer.value = setTimeout(async () => {
    autocompleteLoading.value = true;
    try {
      const data = await $fetch<{ items: ProductResult[] }>('/api/products', {
        query: { q: value, limit: 5 },
      });
      autocompleteResults.value = data.items;
    } catch {
      autocompleteResults.value = [];
    } finally {
      autocompleteLoading.value = false;
    }
  }, 250);
}

function onNameBlur(): void {
  // Delay to allow click on autocomplete item
  setTimeout(() => {
    activeAutocomplete.value = -1;
    autocompleteResults.value = [];
  }, 200);
}
</script>

<template>
  <div class="cpub-parts-block">
    <div class="cpub-parts-header">
      <div class="cpub-parts-icon"><i class="fa-solid fa-list-check"></i></div>
      <span class="cpub-parts-title">Parts List</span>
      <span class="cpub-parts-count">{{ parts.length }} items<template v-if="totalPrice > 0"> · ${{ totalPrice.toFixed(2) }} est.</template></span>
      <button class="cpub-parts-add-btn" @click="addPart">
        <i class="fa-solid fa-plus"></i> Add part
      </button>
    </div>
    <table v-if="parts.length > 0" class="cpub-parts-table">
      <thead>
        <tr>
          <th>Part</th>
          <th class="cpub-parts-qty">Qty</th>
          <th>Notes</th>
          <th class="cpub-parts-price">Price</th>
          <th class="cpub-parts-actions"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(part, i) in parts" :key="i">
          <td class="cpub-parts-name-cell">
            <div class="cpub-parts-name-wrap">
              <input
                class="cpub-parts-input"
                type="text"
                :value="part.name"
                placeholder="Search product catalog..."
                :aria-label="`Part ${i + 1} name`"
                @input="onNameInput(i, ($event.target as HTMLInputElement).value)"
                @blur="onNameBlur"
              />
              <span v-if="part.productId" class="cpub-parts-linked" title="Linked to product catalog">
                <i class="fa-solid fa-link"></i>
              </span>
            </div>
            <!-- Autocomplete dropdown -->
            <div v-if="activeAutocomplete === i && autocompleteResults.length > 0" class="cpub-parts-ac">
              <button
                v-for="product in autocompleteResults"
                :key="product.id"
                class="cpub-parts-ac-item"
                @mousedown.prevent="selectProduct(i, product)"
              >
                <div class="cpub-parts-ac-icon">
                  <img v-if="product.imageUrl" :src="product.imageUrl" :alt="product.name" />
                  <i v-else class="fa-solid fa-microchip"></i>
                </div>
                <div class="cpub-parts-ac-info">
                  <span class="cpub-parts-ac-name">{{ product.name }}</span>
                  <span v-if="product.category" class="cpub-parts-ac-cat">{{ product.category }}</span>
                </div>
              </button>
            </div>
            <div v-else-if="activeAutocomplete === i && autocompleteLoading" class="cpub-parts-ac">
              <div class="cpub-parts-ac-loading">Searching...</div>
            </div>
          </td>
          <td class="cpub-parts-qty">
            <input class="cpub-parts-input cpub-parts-input-sm" type="number" :value="part.qty" min="1" :aria-label="`Part ${i + 1} quantity`" @input="updatePart(i, 'qty', Number(($event.target as HTMLInputElement).value))" />
          </td>
          <td>
            <input class="cpub-parts-input" type="text" :value="part.notes ?? ''" placeholder="Notes..." :aria-label="`Part ${i + 1} notes`" @input="updatePart(i, 'notes', ($event.target as HTMLInputElement).value)" />
          </td>
          <td class="cpub-parts-price">
            <input class="cpub-parts-input cpub-parts-input-sm" type="number" step="0.01" :value="part.price ?? ''" placeholder="0.00" :aria-label="`Part ${i + 1} price`" @input="updatePart(i, 'price', Number(($event.target as HTMLInputElement).value))" />
          </td>
          <td class="cpub-parts-actions">
            <button class="cpub-parts-remove" title="Remove" @click="removePart(i)">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="cpub-parts-empty" @click="addPart">
      <i class="fa-solid fa-plus"></i> Click to add your first part
    </div>
  </div>
</template>

<style scoped>
.cpub-parts-block { border: 2px solid var(--border2); background: var(--surface); }

.cpub-parts-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  border-bottom: 2px solid var(--border2);
  background: var(--surface2);
}

.cpub-parts-icon { font-size: 12px; color: var(--accent); }
.cpub-parts-title { font-size: 12px; font-weight: 600; }
.cpub-parts-count { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); margin-left: auto; }

.cpub-parts-add-btn {
  font-family: var(--font-mono); font-size: 10px;
  padding: 3px 8px; background: transparent;
  border: 2px solid var(--border2); color: var(--text-dim);
  cursor: pointer; display: flex; align-items: center; gap: 4px;
  margin-left: 8px;
}
.cpub-parts-add-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-bg); }

.cpub-parts-table { width: 100%; border-collapse: collapse; }
.cpub-parts-table th {
  font-family: var(--font-mono); font-size: 9px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.1em;
  text-align: left; padding: 6px 10px;
  background: var(--text); color: var(--surface);
}
.cpub-parts-table td { padding: 4px 6px; border-bottom: 1px solid var(--border2); }
.cpub-parts-qty { width: 50px; text-align: center; }
.cpub-parts-price { width: 80px; }
.cpub-parts-actions { width: 30px; text-align: center; }

.cpub-parts-name-cell {
  position: relative;
}

.cpub-parts-name-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cpub-parts-linked {
  font-size: 9px;
  color: var(--accent);
  flex-shrink: 0;
}

.cpub-parts-input {
  width: 100%; padding: 4px 6px; font-size: 12px;
  background: transparent; border: 1px solid transparent;
  color: var(--text); outline: none;
}
.cpub-parts-input:focus { border-color: var(--accent); background: var(--accent-bg); }
.cpub-parts-input::placeholder { color: var(--text-faint); }
.cpub-parts-input-sm { width: 60px; text-align: center; }

.cpub-parts-remove {
  background: none; border: none; color: var(--text-faint);
  cursor: pointer; font-size: 10px; padding: 4px;
}
.cpub-parts-remove:hover { color: var(--red); }

.cpub-parts-empty {
  padding: 24px; text-align: center;
  font-size: 12px; color: var(--text-faint);
  cursor: pointer;
}
.cpub-parts-empty:hover { color: var(--accent); background: var(--accent-bg); }

/* Autocomplete dropdown */
.cpub-parts-ac {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 50;
  background: var(--surface);
  border: 2px solid var(--border);
  box-shadow: 4px 4px 0 var(--border);
  max-height: 200px;
  overflow-y: auto;
}

.cpub-parts-ac-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  font-size: 12px;
}

.cpub-parts-ac-item:hover {
  background: var(--accent-bg);
}

.cpub-parts-ac-icon {
  width: 24px;
  height: 24px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--text-faint);
  flex-shrink: 0;
}

.cpub-parts-ac-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cpub-parts-ac-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cpub-parts-ac-name {
  font-weight: 500;
}

.cpub-parts-ac-cat {
  font-size: 9px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  text-transform: uppercase;
}

.cpub-parts-ac-loading {
  padding: 10px;
  text-align: center;
  font-size: 11px;
  color: var(--text-faint);
}
</style>
