<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
</script>

<template>
  <div>
    <h2 class="cpub-section-title-lg">Account Settings</h2>

    <div class="cpub-form-group">
      <label class="cpub-form-label">Email</label>
      <input type="email" class="cpub-input" placeholder="your@email.com" disabled />
      <span class="cpub-form-hint">Contact support to change your email.</span>
    </div>

    <div class="cpub-form-group">
      <label class="cpub-form-label">Change Password</label>
      <input type="password" class="cpub-input" placeholder="Current password" />
      <input type="password" class="cpub-input" placeholder="New password" style="margin-top: 8px" />
      <button class="cpub-btn cpub-btn-sm" style="margin-top: 8px">Update Password</button>
    </div>

    <hr style="border: none; border-top: 2px solid var(--red-border); margin: 32px 0 16px" />

    <div>
      <h3 style="font-size: 14px; font-weight: 600; color: var(--red); margin-bottom: 8px">Danger Zone</h3>
      <p style="font-size: 12px; color: var(--text-dim); margin-bottom: 12px">
        Deleting your account is permanent and cannot be undone.
      </p>
      <button class="cpub-btn cpub-btn-sm" style="background: var(--red-bg); color: var(--red); border-color: var(--red)">
        <i class="fa-solid fa-trash"></i> Delete Account
      </button>
    </div>
  </div>
</template>
