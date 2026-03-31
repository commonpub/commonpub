<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: 'Edit Profile — CommonPub' });

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

const skills = ref<Array<{ name: string; proficiency: number }>>([]);
const socialLinks = ref({
  github: '',
  twitter: '',
  linkedin: '',
  website: '',
});
const experience = ref<Array<{ id: string; title: string; company: string; startDate: string; endDate: string; description: string }>>([]);

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
    skills.value = p.skills.map((s) =>
      typeof s === 'string' ? { name: s, proficiency: 3 } : s,
    );
  }
  if (p.socialLinks) {
    socialLinks.value.github = p.socialLinks.github || '';
    socialLinks.value.twitter = p.socialLinks.twitter || '';
    socialLinks.value.linkedin = p.socialLinks.linkedin || '';
    socialLinks.value.website = (p.socialLinks as Record<string, string | undefined>).website || '';
  }
  const profileRecord = p as Record<string, unknown>;
  if (Array.isArray(profileRecord.experience)) {
    experience.value = (profileRecord.experience as Array<Record<string, unknown>>).map((e) => ({ ...e }) as typeof experience.value[number]);
  }
}

// Watch for form changes AFTER initial data is loaded (nextTick avoids false positive)
onMounted(() => {
  nextTick(() => {
    watch([form, skills, socialLinks, experience], () => { isDirty.value = true; }, { deep: true });
  });
});

function addSkill(): void {
  skills.value.push({ name: '', proficiency: 50 });
}

function removeSkill(index: number): void {
  skills.value.splice(index, 1);
}

function generateId(): string {
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function addExperience(): void {
  experience.value.push({
    id: generateId(),
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
        skills: skills.value.filter((s) => s.name.trim()),
        socialLinks: socialLinks.value,
        experience: experience.value.filter((e) => e.title.trim()),
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

      <!-- Skills -->
      <div class="cpub-form-section">
        <span class="cpub-form-section-label">Skills</span>

        <div
          v-for="(skill, index) in skills"
          :key="index"
          class="cpub-skill-row"
        >
          <div class="cpub-skill-name">
            <input
              v-model="skill.name"
              type="text"
              class="cpub-input"
              placeholder="Skill name"
              :aria-label="`Skill ${index + 1} name`"
            />
          </div>
          <div class="cpub-skill-slider">
            <input
              v-model.number="skill.proficiency"
              type="range"
              min="0"
              max="100"
              class="cpub-range"
              :aria-label="`Skill ${index + 1} proficiency`"
            />
            <span class="cpub-skill-value">{{ skill.proficiency }}%</span>
          </div>
          <button
            type="button"
            class="cpub-btn-icon cpub-btn-danger"
            :aria-label="`Remove skill ${skill.name || index + 1}`"
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
          <label for="social-website" class="cpub-form-label">Website URL</label>
          <input
            id="social-website"
            v-model="socialLinks.website"
            type="url"
            class="cpub-input"
            placeholder="https://..."
          />
        </div>
      </div>

      <!-- Experience -->
      <div class="cpub-form-section">
        <span class="cpub-form-section-label">Experience</span>

        <div
          v-for="(entry, index) in experience"
          :key="entry.id"
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
              <label :for="`exp-title-${entry.id}`" class="cpub-form-label">Title</label>
              <input
                :id="`exp-title-${entry.id}`"
                v-model="entry.title"
                type="text"
                class="cpub-input"
                placeholder="e.g., Senior Developer"
              />
            </div>

            <div class="cpub-form-group">
              <label :for="`exp-company-${entry.id}`" class="cpub-form-label">Company</label>
              <input
                :id="`exp-company-${entry.id}`"
                v-model="entry.company"
                type="text"
                class="cpub-input"
                placeholder="Company name"
              />
            </div>

            <div class="cpub-experience-dates">
              <div class="cpub-form-group">
                <label :for="`exp-start-${entry.id}`" class="cpub-form-label">Start Date</label>
                <input
                  :id="`exp-start-${entry.id}`"
                  v-model="entry.startDate"
                  type="month"
                  class="cpub-input"
                />
              </div>
              <div class="cpub-form-group">
                <label :for="`exp-end-${entry.id}`" class="cpub-form-label">End Date</label>
                <input
                  :id="`exp-end-${entry.id}`"
                  v-model="entry.endDate"
                  type="month"
                  class="cpub-input"
                  placeholder="Present"
                />
              </div>
            </div>

            <div class="cpub-form-group">
              <label :for="`exp-desc-${entry.id}`" class="cpub-form-label">Description</label>
              <textarea
                :id="`exp-desc-${entry.id}`"
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
  border-bottom: 2px solid var(--border);
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
  border: 2px solid var(--border2);
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

.cpub-skill-name {
  flex: 1;
  min-width: 0;
}

.cpub-skill-slider {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 180px;
  flex-shrink: 0;
}

.cpub-range {
  flex: 1;
  appearance: none;
  height: 4px;
  background: var(--border2);
  outline: none;
  cursor: pointer;
}

.cpub-range::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--accent);
  border: 2px solid var(--accent);
  cursor: pointer;
}

.cpub-range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--accent);
  border: 2px solid var(--accent);
  cursor: pointer;
}

.cpub-range:focus-visible::-webkit-slider-thumb {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.cpub-skill-value {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-dim);
  min-width: 36px;
  text-align: right;
}

/* ─── Buttons ─── */
.cpub-btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--border2);
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
  border: 2px solid var(--border);
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
  border: 2px solid var(--border);
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
</style>
