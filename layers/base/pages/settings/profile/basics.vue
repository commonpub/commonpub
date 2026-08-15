<script setup lang="ts">
/**
 * `/settings/profile/basics` — who the member is.
 *
 * Avatar, banner, display name, headline, location, pronouns and bio, and
 * nothing else. The old single-form Profile page also carried links, skills,
 * experience and a second copy of the email-notification toggles; each of those
 * moved to the tab that owns it (or, for the notification toggles, to
 * `/settings/notifications`, which already edited the same column).
 *
 * WHAT THIS TAB SENDS. `PUT /api/profile` applies only the keys it receives:
 * `updateUserProfile` tests every key for `undefined` before adding it to the
 * update, so this body cannot blank `socialLinks`, `skills` or `experience`,
 * which no longer have inputs here. That per-key behaviour was read in
 * `packages/server/src/profile/profile.ts` before this split was written, not
 * assumed; a whole-row replace would have made three separate forms unsafe.
 *
 * Clearing a field back to empty is not possible for `bio`, `headline`,
 * `location` or `pronouns`: `updateProfileSchema` preprocesses a blank string
 * to `undefined`, which the writer then skips. That is unchanged from the form
 * this replaces and is deliberately not fixed here, where it would be an
 * unrelated behaviour change riding along in a navigation refactor.
 */
import type { Serialized, UserProfile } from '@commonpub/server';

definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: `Profile basics, ${useSiteName()}` });

const toast = useToast();
const { extract: extractError } = useApiError();
const { uploadFile } = useFileUpload();

const saving = ref(false);
const isDirty = ref(false);

// Switching tabs is a route change, so the guard covers "I typed a headline and
// clicked Links" as well as leaving settings entirely.
onBeforeRouteLeave((_to, _from, next) => {
  if (isDirty.value && !confirm('You have unsaved changes. Leave anyway?')) {
    next(false);
  } else {
    next();
  }
});

const form = ref({
  displayName: '',
  username: '',
  bio: '',
  location: '',
  headline: '',
  pronouns: '',
  avatarUrl: '',
  bannerUrl: '',
});

const avatarInput = ref<HTMLInputElement | null>(null);
const bannerInput = ref<HTMLInputElement | null>(null);

const { data: profile } = await useFetch<Serialized<UserProfile>>('/api/profile');

if (profile.value) {
  const p = profile.value;
  form.value.displayName = p.displayName || '';
  form.value.username = p.username || '';
  form.value.bio = p.bio || '';
  form.value.location = p.location || '';
  form.value.headline = p.headline || '';
  form.value.pronouns = p.pronouns || '';
  form.value.avatarUrl = p.avatarUrl || '';
  form.value.bannerUrl = p.bannerUrl || '';
}

// Watch only AFTER the fetched values are seeded; watching immediately would
// mark the form dirty on load and make the leave guard fire on a page nobody
// edited.
onMounted(() => {
  nextTick(() => {
    watch(form, () => { isDirty.value = true; }, { deep: true });
  });
});

async function handleAvatarUpload(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const result = await uploadFile(file, 'avatar');
    form.value.avatarUrl = result.url;
  } catch (err: unknown) {
    toast.error(extractError(err));
  }
}

async function handleBannerUpload(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const result = await uploadFile(file, 'banner');
    form.value.bannerUrl = result.url;
  } catch (err: unknown) {
    toast.error(extractError(err));
  }
}

async function handleSave(): Promise<void> {
  saving.value = true;
  try {
    await $fetch('/api/profile', {
      method: 'PUT',
      body: {
        displayName: form.value.displayName,
        bio: form.value.bio,
        headline: form.value.headline,
        location: form.value.location,
        pronouns: form.value.pronouns || undefined,
        avatarUrl: form.value.avatarUrl,
        bannerUrl: form.value.bannerUrl,
      },
    });
    toast.success('Profile updated');
    isDirty.value = false;
  } catch (err: unknown) {
    toast.error(extractError(err));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <h2 class="cpub-section-title-lg">Basics</h2>

    <form class="cpub-settings-form" @submit.prevent="handleSave">
      <div class="cpub-form-section">
        <span class="cpub-form-section-label">Images</span>

        <div class="cpub-form-group">
          <span class="cpub-form-label">Banner Image</span>
          <button
            type="button"
            class="cpub-banner-upload"
            aria-label="Upload banner image"
            @click="bannerInput?.click()"
          >
            <img
              v-if="form.bannerUrl"
              :src="form.bannerUrl"
              alt="Banner preview"
              class="cpub-banner-preview"
            />
            <div v-else class="cpub-banner-placeholder">
              <i class="fa-solid fa-image" aria-hidden="true"></i>
              <span>Click to upload banner</span>
            </div>
          </button>
          <input
            ref="bannerInput"
            type="file"
            accept="image/*"
            class="cpub-file-hidden"
            aria-label="Banner file input"
            @change="handleBannerUpload"
          />
        </div>

        <div class="cpub-form-group">
          <span class="cpub-form-label">Avatar</span>
          <button
            type="button"
            class="cpub-avatar-upload"
            aria-label="Upload avatar image"
            @click="avatarInput?.click()"
          >
            <img
              v-if="form.avatarUrl"
              :src="form.avatarUrl"
              alt="Avatar preview"
              class="cpub-avatar-preview"
            />
            <div v-else class="cpub-avatar-placeholder">
              <i class="fa-solid fa-camera" aria-hidden="true"></i>
            </div>
            <div class="cpub-avatar-overlay" aria-hidden="true">
              <i class="fa-solid fa-camera"></i>
            </div>
          </button>
          <input
            ref="avatarInput"
            type="file"
            accept="image/*"
            class="cpub-file-hidden"
            aria-label="Avatar file input"
            @change="handleAvatarUpload"
          />
        </div>
      </div>

      <div class="cpub-form-section">
        <span class="cpub-form-section-label">About you</span>

        <div class="cpub-form-group">
          <label for="displayName" class="cpub-form-label">Display Name</label>
          <input
            id="displayName"
            v-model="form.displayName"
            type="text"
            class="cpub-input"
          />
        </div>

        <div class="cpub-form-group">
          <label for="username" class="cpub-form-label">Username</label>
          <input
            id="username"
            :value="form.username"
            type="text"
            class="cpub-input cpub-input-readonly"
            readonly
            aria-readonly="true"
          />
          <span class="cpub-form-hint">Username cannot be changed</span>
        </div>

        <div class="cpub-form-group">
          <label for="headline" class="cpub-form-label">Headline</label>
          <input
            id="headline"
            v-model="form.headline"
            type="text"
            class="cpub-input"
            placeholder="e.g., Full-stack maker"
          />
        </div>

        <div class="cpub-form-group">
          <label for="bio" class="cpub-form-label">Bio</label>
          <textarea
            id="bio"
            v-model="form.bio"
            class="cpub-textarea"
            rows="4"
            placeholder="Tell people about yourself..."
          ></textarea>
        </div>

        <div class="cpub-form-group">
          <label for="location" class="cpub-form-label">Location</label>
          <input
            id="location"
            v-model="form.location"
            type="text"
            class="cpub-input"
            placeholder="City, Country"
          />
        </div>

        <div class="cpub-form-group">
          <label for="pronouns" class="cpub-form-label">Pronouns</label>
          <input
            id="pronouns"
            v-model="form.pronouns"
            type="text"
            class="cpub-input"
            placeholder="e.g., they/them, she/her, he/him"
          />
        </div>
      </div>

      <div class="cpub-form-actions">
        <button type="submit" class="cpub-save-btn" :disabled="saving">
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
/*
 * These rules travel with the markup. Scoped styles do not cross a component
 * boundary, so the tab that renders the avatar widget is the tab that must
 * carry the avatar widget's CSS; leaving them on the parent would have shipped
 * an unstyled upload button.
 */
.cpub-settings-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.cpub-form-section {
  padding-bottom: var(--space-6);
  border-bottom: var(--border-width-default) solid var(--border);
}

.cpub-form-section-label {
  display: block;
  font-family: var(--font-mono);
  font-size: var(--text-label);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-widest);
  color: var(--text-faint);
  margin-bottom: var(--space-4);
}

/* ─── Banner upload ─── */
.cpub-banner-upload {
  display: block;
  width: 100%;
  height: 140px;
  border: 2px dashed var(--border2);
  background: var(--surface);
  cursor: pointer;
  overflow: hidden;
  position: relative;
  padding: 0;
}

.cpub-banner-upload:hover {
  border-color: var(--accent);
}

.cpub-banner-upload:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.cpub-banner-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cpub-banner-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: var(--space-2);
  color: var(--text-faint);
  font-size: var(--text-sm);
}

.cpub-banner-placeholder i {
  font-size: var(--text-xl);
}

/* ─── Avatar upload ─── */
.cpub-avatar-upload {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: var(--border-width-default) solid var(--border2);
  background: var(--surface);
  cursor: pointer;
  overflow: hidden;
  position: relative;
  padding: 0;
}

.cpub-avatar-upload:hover {
  border-color: var(--accent);
}

.cpub-avatar-upload:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.cpub-avatar-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cpub-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--text-faint);
  font-size: var(--text-xl);
}

.cpub-avatar-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-overlay);
  color: var(--color-text-inverse);
  font-size: var(--text-md);
  opacity: 0;
  transition: opacity var(--transition-fast);
  border-radius: 50%;
}

.cpub-avatar-upload:hover .cpub-avatar-overlay {
  opacity: 1;
}

.cpub-file-hidden {
  display: none;
}

/* ─── Read-only input ─── */
.cpub-input-readonly {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--surface2);
}

/* ─── Form actions ─── */
.cpub-form-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding-top: var(--space-4);
}

.cpub-save-btn {
  padding: var(--space-2) var(--space-5);
  background: var(--accent);
  color: var(--color-on-accent);
  border: var(--border-width-default) solid var(--border);
  font-size: var(--text-sm);
  cursor: pointer;
  font-family: var(--font-sans);
  box-shadow: var(--shadow-sm);
}

.cpub-save-btn:hover {
  opacity: 0.85;
}

.cpub-save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cpub-save-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (max-width: 768px) {
  .cpub-banner-upload { height: 100px; }
}
</style>
