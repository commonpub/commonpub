<script setup lang="ts">
/**
 * `/settings/profile/experience` — roles and history, moved verbatim from the
 * single-form Profile page, plus skills.
 *
 * WHY SKILLS IS HERE. It is one of the five fields that live only on Profile
 * (avatar, banner, experience, skills, website), so the merge has to place it
 * somewhere. Basics is the person; Links is the platforms; skills is the
 * professional record, which is this tab. It is NOT the persona `tech_stack`
 * question: that one is an operator-defined multiselect stored in the persona
 * answer sink, while this writes `users.skills`. Two different columns, so
 * carrying both is not the duplication the merge removes.
 *
 * WHAT THIS TAB SENDS. `PUT /api/profile` with `skills` and `experience` only.
 * `updateUserProfile` applies only the keys it receives, so this body cannot
 * touch the name, the bio or the links.
 */
import type { Serialized, UserProfile } from '@commonpub/server';

definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: `Profile experience, ${useSiteName()}` });

const toast = useToast();
const { extract: extractError } = useApiError();

const saving = ref(false);
const isDirty = ref(false);

onBeforeRouteLeave((_to, _from, next) => {
  if (isDirty.value && !confirm('You have unsaved changes. Leave anyway?')) {
    next(false);
  } else {
    next();
  }
});

// Stable row ids so v-for keys survive splice-removal (keying by array index
// rebinds v-model to the wrong row after deleting an entry).
let rowIdCounter = 0;
function nextRowId(): string { return `row-${rowIdCounter++}`; }

interface ExperienceRow {
  _id: string;
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  description: string;
}

const skills = ref<string[]>([]);
// Parallel id list kept in lockstep with `skills` for stable v-for keys.
const skillIds = ref<string[]>([]);
const experience = ref<ExperienceRow[]>([]);

const { data: profile } = await useFetch<Serialized<UserProfile>>('/api/profile');

if (profile.value) {
  const p = profile.value;
  if (Array.isArray(p.skills)) {
    skills.value = (p.skills as unknown[]).filter((s): s is string => typeof s === 'string');
    skillIds.value = skills.value.map(() => nextRowId());
  }
  // Annotated, not inferred: `Array.isArray` on a `T[] | null` narrows to
  // `any[]` under `vue-tsc`, which is an implicit `any` parameter below and a
  // strict-mode error that vitest's looser transform would never have shown.
  if (Array.isArray(p.experience)) {
    const rows = p.experience as Array<Record<string, unknown>>;
    experience.value = rows.map((e) => ({
      _id: nextRowId(),
      title: String(e.title || ''),
      company: String(e.company || ''),
      startDate: String(e.startDate || ''),
      endDate: String(e.endDate || ''),
      description: String(e.description || ''),
    }));
  }
}

onMounted(() => {
  nextTick(() => {
    watch([skills, experience], () => { isDirty.value = true; }, { deep: true });
  });
});

function addSkill(): void {
  skills.value.push('');
  skillIds.value.push(nextRowId());
}

function removeSkill(index: number): void {
  skills.value.splice(index, 1);
  skillIds.value.splice(index, 1);
}

function addExperience(): void {
  experience.value.push({
    _id: nextRowId(),
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

async function handleSave(): Promise<void> {
  saving.value = true;
  try {
    await $fetch('/api/profile', {
      method: 'PUT',
      body: {
        skills: skills.value.filter((s) => s.trim()),
        // `_id` is a client-side v-for key and is not part of the stored shape.
        experience: experience.value
          .filter((e) => e.title.trim())
          .map(({ _id, ...rest }) => rest),
      },
    });
    toast.success('Experience updated');
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
    <h2 class="cpub-section-title-lg">Experience</h2>

    <form class="cpub-settings-form" @submit.prevent="handleSave">
      <div class="cpub-form-section">
        <span class="cpub-form-section-label">Skills</span>

        <div
          v-for="(_skill, index) in skills"
          :key="skillIds[index]"
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

        <button type="button" class="cpub-btn-add" @click="addSkill">
          <i class="fa-solid fa-plus" aria-hidden="true"></i>
          Add Skill
        </button>
      </div>

      <div class="cpub-form-section">
        <span class="cpub-form-section-label">Experience</span>

        <div
          v-for="(entry, index) in experience"
          :key="entry._id"
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

        <button type="button" class="cpub-btn-add" @click="addExperience">
          <i class="fa-solid fa-plus" aria-hidden="true"></i>
          Add Experience
        </button>
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
  color: var(--red-text);
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
  .cpub-experience-dates { grid-template-columns: 1fr; }
}
</style>
