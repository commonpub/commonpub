<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const { user } = useAuth();
const { show: toast } = useToast();

const currentPassword = ref('');
const newPassword = ref('');
const passwordLoading = ref(false);
const deleteConfirm = ref(false);
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

async function handleDeleteAccount(): Promise<void> {
  if (!deleteConfirm.value) {
    deleteConfirm.value = true;
    return;
  }

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
      <input v-model="newPassword" type="password" class="cpub-input" placeholder="New password (min 8 characters)" required minlength="8" style="margin-top: 8px" />
      <button type="submit" class="cpub-btn cpub-btn-sm" style="margin-top: 8px" :disabled="passwordLoading">
        {{ passwordLoading ? 'Updating...' : 'Update Password' }}
      </button>
    </form>

    <hr style="border: none; border-top: 2px solid var(--red-border); margin: 32px 0 16px" />

    <div>
      <h3 style="font-size: 14px; font-weight: 600; color: var(--red); margin-bottom: 8px">Danger Zone</h3>
      <p style="font-size: 12px; color: var(--text-dim); margin-bottom: 12px">
        {{ deleteConfirm ? 'Are you sure? Click again to confirm permanent deletion.' : 'Deleting your account is permanent and cannot be undone.' }}
      </p>
      <button
        class="cpub-btn cpub-btn-sm"
        style="background: var(--red-bg); color: var(--red); border-color: var(--red)"
        :disabled="deleteLoading"
        @click="handleDeleteAccount"
      >
        <i class="fa-solid fa-trash"></i>
        {{ deleteConfirm ? (deleteLoading ? 'Deleting...' : 'Confirm Delete') : 'Delete Account' }}
      </button>
      <button v-if="deleteConfirm" class="cpub-btn cpub-btn-sm" style="margin-left: 8px" @click="deleteConfirm = false">
        Cancel
      </button>
    </div>
  </div>
</template>
