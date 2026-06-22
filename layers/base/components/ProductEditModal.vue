<script setup lang="ts">
interface EditableProduct {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  purchaseUrl: string | null;
  datasheetUrl: string | null;
  status: string;
}

const props = defineProps<{
  product: EditableProduct;
}>();

const emit = defineEmits<{
  close: [];
  updated: [product: { slug: string }];
}>();

const toast = useToast();

const formName = ref(props.product.name);
const formDescription = ref(props.product.description ?? '');
const formCategory = ref(props.product.category ?? 'other');
const formPurchaseUrl = ref(props.product.purchaseUrl ?? '');
const formDatasheetUrl = ref(props.product.datasheetUrl ?? '');
const formStatus = ref(props.product.status ?? 'active');
const saving = ref(false);

// Parent mounts/unmounts this modal via v-if, so it's always "open" while
// mounted. A local ref flipped on mount drives useFocusTrap's watcher.
const contentRef = ref<HTMLElement | null>(null);
const visible = ref(false);
onMounted(() => { visible.value = true; });
useFocusTrap(contentRef, () => visible.value, () => emit('close'));

async function handleSave(): Promise<void> {
  if (!formName.value.trim()) return;
  saving.value = true;
  try {
    const updated = await $fetch<{ slug: string }>(`/api/products/${props.product.id}`, {
      method: 'PUT',
      body: {
        name: formName.value,
        description: formDescription.value || undefined,
        category: formCategory.value,
        purchaseUrl: formPurchaseUrl.value || undefined,
        datasheetUrl: formDatasheetUrl.value || undefined,
        status: formStatus.value,
      },
    });
    toast.success('Product updated');
    emit('updated', updated);
    emit('close');
  } catch {
    toast.error('Failed to update product');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="cpub-modal-backdrop" @click.self="emit('close')">
      <div ref="contentRef" class="cpub-modal-content" role="dialog" aria-modal="true" aria-labelledby="cpub-edit-product-title">
        <div class="cpub-modal-header">
          <h3 id="cpub-edit-product-title" class="cpub-modal-title">Edit Product</h3>
          <button class="cpub-modal-close" aria-label="Close" @click="emit('close')"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <form class="cpub-resource-form" @submit.prevent="handleSave">
          <label class="cpub-field-label" for="cpub-edit-product-name">Name</label>
          <input id="cpub-edit-product-name" v-model="formName" type="text" placeholder="Product name" class="cpub-input" required />

          <label class="cpub-field-label" for="cpub-edit-product-desc">Description</label>
          <input id="cpub-edit-product-desc" v-model="formDescription" type="text" placeholder="Short description (optional)" class="cpub-input" />

          <label class="cpub-field-label" for="cpub-edit-product-category">Category</label>
          <select id="cpub-edit-product-category" v-model="formCategory" class="cpub-input">
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

          <label class="cpub-field-label" for="cpub-edit-product-purchase">Purchase URL</label>
          <input id="cpub-edit-product-purchase" v-model="formPurchaseUrl" type="url" placeholder="Purchase URL (optional)" class="cpub-input" />

          <label class="cpub-field-label" for="cpub-edit-product-datasheet">Datasheet URL</label>
          <input id="cpub-edit-product-datasheet" v-model="formDatasheetUrl" type="url" placeholder="Datasheet URL (optional)" class="cpub-input" />

          <label class="cpub-field-label" for="cpub-edit-product-status">Status</label>
          <select id="cpub-edit-product-status" v-model="formStatus" class="cpub-input">
            <option value="active">Active</option>
            <option value="discontinued">Discontinued</option>
            <option value="preview">Preview</option>
          </select>

          <div class="cpub-modal-actions">
            <button type="submit" class="cpub-btn cpub-btn-primary" :disabled="saving || !formName.trim()">
              {{ saving ? 'Saving...' : 'Save Changes' }}
            </button>
            <button type="button" class="cpub-btn" @click="emit('close')">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cpub-modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--color-surface-scrim, rgba(0,0,0,0.5));
  z-index: var(--z-modal-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cpub-modal-content {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-lg);
  -webkit-backdrop-filter: var(--surface-backdrop, none);
  backdrop-filter: var(--surface-backdrop, none);
  padding: 24px;
  max-width: 420px;
  width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}

.cpub-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.cpub-modal-title { font-size: 16px; font-weight: 700; }

.cpub-modal-close {
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
}
.cpub-modal-close:hover { color: var(--text); }

.cpub-resource-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cpub-field-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  margin-top: 6px;
}

.cpub-modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
</style>
