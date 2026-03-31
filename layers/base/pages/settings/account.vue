<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const { user } = useAuth();
const { show: toast } = useToast();

const currentPassword = ref('');
const newPassword = ref('');
const passwordLoading = ref(false);
const deleteConfirm = ref(false);
const deleteConfirmText = ref('');
const deleteLoading = ref(false);

async function handlePasswordChange(): Promise<void> {
  if (!currentPassword.value || !newPassword.value) return;
  if (newPassword.value.length < 8) {
    toast('Password must be at least 8 characters', 'error');
    return;
  }

  passwordLoading.value = true;
  try {
    await $fetch('/api/auth/change-password', {
      method: 'POST',
      body: {
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
      },
      credentials: 'include',
    });
    toast('Password updated successfully', 'success');
    currentPassword.value = '';
    newPassword.value = '';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update password';
    toast(msg, 'error');
  } finally {
    passwordLoading.value = false;
  }
}

const canDelete = computed(() => deleteConfirmText.value === user.value?.username);

async function handleDeleteAccount(): Promise<void> {
  if (!deleteConfirm.value) {
    deleteConfirm.value = true;
    return;
  }
  if (!canDelete.value) return;

  deleteLoading.value = true;
  try {
    await $fetch('/api/auth/delete-user', {
      method: 'POST',
      credentials: 'include',
    });
    toast('Account deleted', 'success');
    await navigateTo('/');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete account';
    toast(msg, 'error');
    deleteConfirm.value = false;
    deleteConfirmText.value = '';
  } finally {
    deleteLoading.value = false;
  }
}
</script>

<template>
  <div>
    <h2 class="cpub-section-title-lg">Account Settings</h2>

    <div class="cpub-form-group">
      <label class="cpub-form-label">Email</label>
      <input type="email" class="cpub-input" :value="user?.email" disabled />
      <span class="cpub-form-hint">Contact support to change your email.</span>
    </div>

    <form class="cpub-form-group" @submit.prevent="handlePasswordChange">
      <label class="cpub-form-label">Change Password</label>
      <input v-model="currentPassword" type="password" class="cpub-input" placeholder="Current password" required />
      <input v-model="newPassword" type="password" class="cpub-input cpub-mt-2" placeholder="New password (min 8 characters)" required minlength="8" />
      <button type="submit" class="cpub-btn cpub-btn-sm cpub-mt-2" :disabled="passwordLoading">
        {{ passwordLoading ? 'Updating...' : 'Update Password' }}
      </button>
    </form>

    <hr class="cpub-danger-divider" />

    <div>
      <h3 class="cpub-danger-title">Danger Zone</h3>
      <p class="cpub-danger-desc">
        Deleting your account is permanent and cannot be undone.
      </p>

      <template v-if="deleteConfirm">
        <div class="cpub-form-group">
          <label class="cpub-form-label">Type your username <strong>{{ user?.username ?? '' }}</strong> to confirm</label>
          <input v-model="deleteConfirmText" type="text" class="cpub-input" :placeholder="user?.username" autocomplete="off" />
        </div>
        <div class="cpub-danger-actions">
          <button
            class="cpub-btn cpub-btn-sm cpub-btn-danger"
            :disabled="!canDelete || deleteLoading"
            @click="handleDeleteAccount"
          >
            <i class="fa-solid fa-trash"></i>
            {{ deleteLoading ? 'Deleting...' : 'Permanently Delete Account' }}
          </button>
          <button class="cpub-btn cpub-btn-sm" @click="deleteConfirm = false; deleteConfirmText = ''">
            Cancel
          </button>
        </div>
      </template>
      <button
        v-else
        class="cpub-btn cpub-btn-sm cpub-btn-danger"
        @click="deleteConfirm = true"
      >
        <i class="fa-solid fa-trash"></i> Delete Account
      </button>
    </div>
  </div>
</template>

<style scoped>
.cpub-mt-2 { margin-top: var(--space-2); }

.cpub-danger-divider {
  border: none;
  border-top: 2px solid var(--red-border);
  margin: var(--space-8) 0 var(--space-4);
}

.cpub-danger-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--red);
  margin-bottom: var(--space-2);
}

.cpub-danger-desc {
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: var(--space-3);
}

.cpub-danger-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.cpub-btn-danger {
  background: var(--red-bg);
  color: var(--red);
  border-color: var(--red);
}

.cpub-btn-danger:hover:not(:disabled) {
  background: var(--red);
  color: var(--color-text-inverse);
}

.cpub-btn-danger:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
