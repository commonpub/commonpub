<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

useSeoMeta({
  title: `Create Hub — ${useSiteName()}`,
  description: 'Create a new maker hub.',
});

const toast = useToast();
const { extract: extractError } = useApiError();
const name = ref('');
const description = ref('');
const iconUrl = ref('');
const bannerUrl = ref('');
const hubType = ref<'community' | 'product' | 'company'>('community');
const joinPolicy = ref<'open' | 'approval' | 'invite'>('open');
const saving = ref(false);

async function handleCreate(): Promise<void> {
  saving.value = true;
  try {
    const result = await $fetch('/api/hubs', {
      method: 'POST',
      body: {
        name: name.value,
        description: description.value || undefined,
        iconUrl: iconUrl.value || undefined,
        bannerUrl: bannerUrl.value || undefined,
        hubType: hubType.value,
        joinPolicy: joinPolicy.value,
      },
    });
    await navigateTo(`/hubs/${(result as { slug: string }).slug}`);
  } catch (err: unknown) {
    toast.error(extractError(err));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="cpub-create-hub">
    <div class="cpub-create-header">
      <NuxtLink to="/explore" class="cpub-back-link">
        <i class="fa-solid fa-arrow-left"></i> Back
      </NuxtLink>
      <h1 class="cpub-create-title">Create Hub</h1>
      <p class="cpub-create-subtitle">Start a new maker community, product page, or company hub.</p>
    </div>

    <form class="cpub-create-form" @submit.prevent="handleCreate" aria-label="Create hub form">
      <div class="cpub-field">
        <label for="hub-name" class="cpub-field-label">Name</label>
        <input id="hub-name" v-model="name" type="text" class="cpub-field-input" required placeholder="Hub name" />
      </div>

      <div class="cpub-field">
        <label for="hub-desc" class="cpub-field-label">Description</label>
        <textarea id="hub-desc" v-model="description" class="cpub-field-input cpub-field-textarea" rows="3" placeholder="What is this hub about?" />
      </div>

      <div class="cpub-field-row cpub-field-row-images">
        <div class="cpub-field">
          <ImageUpload v-model="iconUrl" purpose="avatar" label="Icon / Avatar" hint="Square image, at least 256x256px" />
        </div>
        <div class="cpub-field">
          <ImageUpload v-model="bannerUrl" purpose="banner" label="Banner Image" hint="Wide image, at least 1200x300px" />
        </div>
      </div>

      <div class="cpub-field-row">
        <div class="cpub-field">
          <label for="hub-type" class="cpub-field-label">Hub Type</label>
          <select id="hub-type" v-model="hubType" class="cpub-field-input">
            <option value="community">Community — maker group / topic space</option>
            <option value="product">Product — product or platform page</option>
            <option value="company">Company — organization page</option>
          </select>
        </div>

        <div class="cpub-field">
          <label for="hub-join" class="cpub-field-label">Join Policy</label>
          <select id="hub-join" v-model="joinPolicy" class="cpub-field-input">
            <option value="open">Open — anyone can join</option>
            <option value="approval">Approval — requests must be approved</option>
            <option value="invite">Invite Only</option>
          </select>
        </div>
      </div>

      <div class="cpub-form-actions">
        <button type="submit" class="cpub-btn cpub-btn-primary" :disabled="saving || !name">
          {{ saving ? 'Creating...' : 'Create Hub' }}
        </button>
        <NuxtLink to="/explore" class="cpub-btn">Cancel</NuxtLink>
      </div>
    </form>
  </div>
</template>

<style scoped>
.cpub-create-hub {
  max-width: 640px;
  margin: 0 auto;
  padding: 32px;
}

.cpub-create-header {
  margin-bottom: 32px;
}

.cpub-back-link {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-dim);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
}

.cpub-back-link:hover { color: var(--text); }

.cpub-create-title {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 4px;
}

.cpub-create-subtitle {
  font-size: 13px;
  color: var(--text-dim);
}

.cpub-create-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.cpub-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cpub-field-label {
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}

.cpub-field-input {
  padding: 8px 12px;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  font-family: var(--font-sans);
  outline: none;
  transition: border-color 0.15s;
}

.cpub-field-input:focus {
  border-color: var(--accent);
}

.cpub-field-input::placeholder {
  color: var(--text-faint);
}

.cpub-field-textarea {
  resize: vertical;
  min-height: 60px;
  line-height: 1.5;
}

.cpub-field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.cpub-form-actions {
  display: flex;
  gap: 10px;
  padding-top: 8px;
}

select.cpub-field-input { cursor: pointer; }

@media (max-width: 640px) {
  .cpub-create-hub { padding: 16px; }
  .cpub-field-row { grid-template-columns: 1fr; }
}
</style>
