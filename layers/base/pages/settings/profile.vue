<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: `Edit Profile — ${useSiteName()}` });

const { user } = useAuth();
const toast = useToast();
const { extract: extractError } = useApiError();
const saving = ref(false);
const isDirty = ref(false);

// Track changes
function markDirty(): void { isDirty.value = true; }

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
  website: '',
  headline: '',
  avatarUrl: '',
  bannerUrl: '',
});

const skills = ref<string[]>([]);
const socialLinks = ref({
  github: '',
  twitter: '',
  linkedin: '',
  youtube: '',
  instagram: '',
  mastodon: '',
  discord: '',
});
const pronouns = ref('');
const experience = ref<Array<{ title: string; company: string; startDate: string; endDate: string; description: string }>>([]);

const emailNotifications = ref<{
  digest: 'daily' | 'weekly' | 'none';
  likes: boolean;
  comments: boolean;
  follows: boolean;
  mentions: boolean;
}>({
  digest: 'none',
  likes: false,
  comments: false,
  follows: false,
  mentions: false,
});

const { emailNotifications: emailNotificationsEnabled } = useFeatures();

const avatarInput = ref<HTMLInputElement | null>(null);
const bannerInput = ref<HTMLInputElement | null>(null);

// Load current profile
import type { Serialized, UserProfile } from '@commonpub/server';

const { data: profile } = await useFetch<Serialized<UserProfile>>('/api/profile');

if (profile.value) {
  const p = profile.value;
  form.value.displayName = p.displayName || '';
  form.value.username = p.username || '';
  form.value.bio = p.bio || '';
  form.value.location = p.location || '';
  form.value.website = p.website || '';
  form.value.headline = p.headline || '';
  form.value.avatarUrl = p.avatarUrl || '';
  form.value.bannerUrl = p.bannerUrl || '';

  if (Array.isArray(p.skills)) {
    skills.value = (p.skills as unknown[]).filter((s): s is string => typeof s === 'string');
  }
  pronouns.value = p.pronouns || '';
  if (p.socialLinks) {
    const sl = p.socialLinks as Record<string, string | undefined>;
    socialLinks.value.github = sl.github || '';
    socialLinks.value.twitter = sl.twitter || '';
    socialLinks.value.linkedin = sl.linkedin || '';
    socialLinks.value.youtube = sl.youtube || '';
    socialLinks.value.instagram = sl.instagram || '';
    socialLinks.value.mastodon = sl.mastodon || '';
    socialLinks.value.discord = sl.discord || '';
  }
  const profileRecord = p as Record<string, unknown>;
  if (Array.isArray(profileRecord.experience)) {
    experience.value = (profileRecord.experience as Array<Record<string, unknown>>).map((e) => ({
      title: String(e.title || ''),
      company: String(e.company || ''),
      startDate: String(e.startDate || ''),
      endDate: String(e.endDate || ''),
      description: String(e.description || ''),
    }));
  }
  if (profileRecord.emailNotifications && typeof profileRecord.emailNotifications === 'object') {
    const en = profileRecord.emailNotifications as Record<string, unknown>;
    emailNotifications.value = {
      digest: (['daily', 'weekly', 'none'].includes(en.digest as string) ? en.digest : 'none') as 'daily' | 'weekly' | 'none',
      likes: en.likes === true,
      comments: en.comments === true,
      follows: en.follows === true,
      mentions: en.mentions === true,
    };
  }
}

// Watch for form changes AFTER initial data is loaded (nextTick avoids false positive)
onMounted(() => {
  nextTick(() => {
    watch([form, skills, pronouns, socialLinks, experience, emailNotifications], () => { isDirty.value = true; }, { deep: true });
  });
});

function addSkill(): void {
  skills.value.push('');
}

function removeSkill(index: number): void {
  skills.value.splice(index, 1);
}

function addExperience(): void {
  experience.value.push({
    title: '',
    company: '',
    startDate: '',
    endDate: '',
    description: '',
  });
}

function removeExperience(index: number): void {
  experience.value.splice(index, 1);
}

async function handleAvatarUpload(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', 'avatar');
  try {
    const result = await $fetch<{ url: string }>('/api/files/upload', { method: 'POST', body: formData });
    form.value.avatarUrl = result.url;
  } catch (err: unknown) {
    toast.error(extractError(err));
  }
}

async function handleBannerUpload(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', 'banner');
  try {
    const result = await $fetch<{ url: string }>('/api/files/upload', { method: 'POST', body: formData });
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
        ...form.value,
        skills: skills.value.filter((s) => s.trim()),
        experience: experience.value.filter((e) => e.title.trim()),
        pronouns: pronouns.value || undefined,
        socialLinks: socialLinks.value,
        ...(emailNotificationsEnabled.value ? { emailNotifications: emailNotifications.value } : {}),
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
  <div class="cpub-settings">
    <h1 class="cpub-page-title">Edit Profile</h1>

    <form class="cpub-settings-form" @submit.prevent="handleSave">
      <!-- Avatar & Banner -->
      <div class="cpub-form-section">
        <span class="cpub-form-section-label">Images</span>

        <!-- Banner upload -->
        <div class="cpub-form-group">
          <label class="cpub-form-label">Banner Image</label>
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

        <!-- Avatar upload -->
        <div class="cpub-form-group">
          <label class="cpub-form-label">Avatar</label>
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

      <!-- Basic Info -->
      <div class="cpub-form-section">
        <span class="cpub-form-section-label">Profile</span>

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
          <label for="website" class="cpub-form-label">Website</label>
          <input
            id="website"
            v-model="form.website"
            type="url"
            class="cpub-input"
            placeholder="https://..."
          />
        </div>
      </div>

      <!-- Pronouns -->
      <div class="cpub-form-section">
        <span class="cpub-form-section-label">Identity</span>

        <div class="cpub-form-group">
          <label for="pronouns" class="cpub-form-label">Pronouns</label>
          <input
            id="pronouns"
            v-model="pronouns"
            type="text"
            class="cpub-input"
            placeholder="e.g., they/them, she/her, he/him"
          />
        </div>
      </div>

      <!-- Skills -->
      <div class="cpub-form-section">
        <span class="cpub-form-section-label">Skills</span>

        <div
          v-for="(_skill, index) in skills"
          :key="index"
          class="cpub-skill-row"
        >
          <input
            v-model="skills[index]"
            type="text"
            class="cpub-input"
            placeholder="Skill name"
            :aria-label="`Skill ${index + 1}`"
          />
          <button
            type="button"
            class="cpub-btn-icon cpub-btn-danger"
            :aria-label="`Remove skill ${skills[index] || index + 1}`"
            @click="removeSkill(index)"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <button
          type="button"
          class="cpub-btn-add"
          @click="addSkill"
        >
          <i class="fa-solid fa-plus" aria-hidden="true"></i>
          Add Skill
        </button>
      </div>

      <!-- Social Links -->
      <div class="cpub-form-section">
        <span class="cpub-form-section-label">Social Links</span>

        <div class="cpub-form-group">
          <label for="social-github" class="cpub-form-label">GitHub</label>
          <input
            id="social-github"
            v-model="socialLinks.github"
            type="url"
            class="cpub-input"
            placeholder="https://github.com/username"
          />
        </div>

        <div class="cpub-form-group">
          <label for="social-twitter" class="cpub-form-label">Twitter / X</label>
          <input
            id="social-twitter"
            v-model="socialLinks.twitter"
            type="url"
            class="cpub-input"
            placeholder="https://x.com/username"
          />
        </div>

        <div class="cpub-form-group">
          <label for="social-linkedin" class="cpub-form-label">LinkedIn</label>
          <input
            id="social-linkedin"
            v-model="socialLinks.linkedin"
            type="url"
            class="cpub-input"
            placeholder="https://linkedin.com/in/username"
          />
        </div>

        <div class="cpub-form-group">
          <label for="social-youtube" class="cpub-form-label">YouTube</label>
          <input id="social-youtube" v-model="socialLinks.youtube" type="url" class="cpub-input" placeholder="https://youtube.com/@channel" />
        </div>

        <div class="cpub-form-group">
          <label for="social-instagram" class="cpub-form-label">Instagram</label>
          <input id="social-instagram" v-model="socialLinks.instagram" type="url" class="cpub-input" placeholder="https://instagram.com/username" />
        </div>

        <div class="cpub-form-group">
          <label for="social-mastodon" class="cpub-form-label">Mastodon</label>
          <input id="social-mastodon" v-model="socialLinks.mastodon" type="url" class="cpub-input" placeholder="https://mastodon.social/@username" />
        </div>

        <div class="cpub-form-group">
          <label for="social-discord" class="cpub-form-label">Discord</label>
          <input id="social-discord" v-model="socialLinks.discord" type="url" class="cpub-input" placeholder="https://discord.gg/invite" />
        </div>

      </div>

      <!-- Experience -->
      <div class="cpub-form-section">
        <span class="cpub-form-section-label">Experience</span>

        <div
          v-for="(entry, index) in experience"
          :key="index"
          class="cpub-experience-card"
        >
          <div class="cpub-experience-header">
            <span class="cpub-experience-number">{{ index + 1 }}</span>
            <button
              type="button"
              class="cpub-btn-icon cpub-btn-danger"
              :aria-label="`Remove experience entry ${index + 1}`"
              @click="removeExperience(index)"
            >
              <i class="fa-solid fa-trash" aria-hidden="true"></i>
            </button>
          </div>

          <div class="cpub-experience-fields">
            <div class="cpub-form-group">
              <label :for="`exp-title-${index}`" class="cpub-form-label">Title</label>
              <input
                :id="`exp-title-${index}`"
                v-model="entry.title"
                type="text"
                class="cpub-input"
                placeholder="e.g., Senior Developer"
              />
            </div>

            <div class="cpub-form-group">
              <label :for="`exp-company-${index}`" class="cpub-form-label">Company</label>
              <input
                :id="`exp-company-${index}`"
                v-model="entry.company"
                type="text"
                class="cpub-input"
                placeholder="Company name"
              />
            </div>

            <div class="cpub-experience-dates">
              <div class="cpub-form-group">
                <label :for="`exp-start-${index}`" class="cpub-form-label">Start Date</label>
                <input
                  :id="`exp-start-${index}`"
                  v-model="entry.startDate"
                  type="month"
                  class="cpub-input"
                />
              </div>
              <div class="cpub-form-group">
                <label :for="`exp-end-${index}`" class="cpub-form-label">End Date</label>
                <input
                  :id="`exp-end-${index}`"
                  v-model="entry.endDate"
                  type="month"
                  class="cpub-input"
                  placeholder="Present"
                />
              </div>
            </div>

            <div class="cpub-form-group">
              <label :for="`exp-desc-${index}`" class="cpub-form-label">Description</label>
              <textarea
                :id="`exp-desc-${index}`"
                v-model="entry.description"
                class="cpub-textarea"
                rows="3"
                placeholder="What did you do?"
              ></textarea>
            </div>
          </div>
        </div>

        <button
          type="button"
          class="cpub-btn-add"
          @click="addExperience"
        >
          <i class="fa-solid fa-plus" aria-hidden="true"></i>
          Add Experience
        </button>
      </div>

      <!-- Email Notifications (gated behind feature flag) -->
      <div v-if="emailNotificationsEnabled" class="cpub-form-section">
        <span class="cpub-form-section-label">Email Notifications</span>

        <div class="cpub-form-group">
          <label for="digest-mode" class="cpub-form-label">Digest Mode</label>
          <select
            id="digest-mode"
            v-model="emailNotifications.digest"
            class="cpub-select"
          >
            <option value="none">Off (instant emails only)</option>
            <option value="daily">Daily digest</option>
            <option value="weekly">Weekly digest</option>
          </select>
          <span class="cpub-form-hint">
            {{ emailNotifications.digest === 'none'
              ? 'Instant emails are sent for each enabled type below.'
              : `A ${emailNotifications.digest} email summarizing your unread notifications.` }}
          </span>
        </div>

        <fieldset class="cpub-notification-toggles" :disabled="emailNotifications.digest !== 'none'">
          <legend class="cpub-form-label cpub-toggle-legend">Instant Email Types</legend>
          <span v-if="emailNotifications.digest !== 'none'" class="cpub-form-hint cpub-toggle-hint">
            Individual emails are disabled when digest mode is active.
          </span>

          <label class="cpub-toggle-row" for="notif-likes">
            <input
              id="notif-likes"
              v-model="emailNotifications.likes"
              type="checkbox"
              class="cpub-checkbox"
            />
            <span>Likes</span>
          </label>

          <label class="cpub-toggle-row" for="notif-comments">
            <input
              id="notif-comments"
              v-model="emailNotifications.comments"
              type="checkbox"
              class="cpub-checkbox"
            />
            <span>Comments</span>
          </label>

          <label class="cpub-toggle-row" for="notif-follows">
            <input
              id="notif-follows"
              v-model="emailNotifications.follows"
              type="checkbox"
              class="cpub-checkbox"
            />
            <span>New followers</span>
          </label>

          <label class="cpub-toggle-row" for="notif-mentions">
            <input
              id="notif-mentions"
              v-model="emailNotifications.mentions"
              type="checkbox"
              class="cpub-checkbox"
            />
            <span>@mentions</span>
          </label>
        </fieldset>
      </div>

      <!-- Actions -->
      <div class="cpub-form-actions">
        <button type="submit" class="cpub-save-btn" :disabled="saving">
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.cpub-settings {
  max-width: 640px;
  padding: var(--space-6);
}

.cpub-page-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-6);
}

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

/* ─── Skills ─── */
.cpub-skill-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

/* ─── Buttons ─── */
.cpub-btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: var(--border-width-default) solid var(--border2);
  background: var(--surface);
  color: var(--text-dim);
  cursor: pointer;
  flex-shrink: 0;
}

.cpub-btn-icon:hover {
  border-color: var(--border);
  color: var(--text);
}

.cpub-btn-icon:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.cpub-btn-danger:hover {
  color: var(--red);
  border-color: var(--red);
}

.cpub-btn-add {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: 2px dashed var(--border2);
  background: none;
  color: var(--text-dim);
  font-size: var(--text-sm);
  font-family: var(--font-sans);
  cursor: pointer;
  margin-top: var(--space-2);
}

.cpub-btn-add:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.cpub-btn-add:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* ─── Experience ─── */
.cpub-experience-card {
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
}

.cpub-experience-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.cpub-experience-number {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-bold);
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.cpub-experience-fields {
  display: flex;
  flex-direction: column;
}

.cpub-experience-dates {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

/* ─── Email notification toggles ─── */
.cpub-select {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: var(--surface);
  color: var(--text);
  border: var(--border-width-default) solid var(--border2);
  font-size: var(--text-sm);
  font-family: var(--font-sans);
  appearance: none;
}

.cpub-select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.cpub-notification-toggles {
  border: none;
  padding: 0;
  margin: var(--space-3) 0 0;
}

.cpub-notification-toggles:disabled {
  opacity: 0.5;
}

.cpub-toggle-legend {
  margin-bottom: var(--space-2);
}

.cpub-toggle-hint {
  display: block;
  margin-bottom: var(--space-2);
}

.cpub-toggle-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  cursor: pointer;
  font-size: var(--text-sm);
  color: var(--text);
}

.cpub-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
  cursor: pointer;
  flex-shrink: 0;
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
  color: var(--color-text-inverse);
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
  .cpub-settings-form { padding: 0 var(--space-1); }
  .cpub-experience-dates { grid-template-columns: 1fr; }
  .cpub-banner-upload { height: 100px; }
}

</style>
