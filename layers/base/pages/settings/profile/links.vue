<script setup lang="ts">
/**
 * `/settings/profile/links` — the platforms the member lists.
 *
 * Its own tab rather than a block inside Basics because this is where the
 * per-platform sharing controls land (plan section 4.2): GitHub and Instagram
 * are not the same decision, and a member should not have to choose between
 * handing a recruiter their personal Instagram and withholding the GitHub that
 * was the point.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS TAB SENDS
 * ---------------------------------------------------------------------------
 * `PUT /api/profile` with `website` and `socialLinks`, and nothing else.
 * `updateUserProfile` skips every key it is not given, so this body leaves the
 * Basics and Experience fields untouched.
 *
 * `socialLinks` is a WHOLE-OBJECT replace on the server (`updates.socialLinks =
 * input.socialLinks`), so this page seeds from EVERY stored key, not from the
 * built-in list. An operator-declared eighth platform must survive a save made
 * by a member who has never heard of it. `socialLinksSchema` carries a
 * `catchall` for the same reason; this seeding is the other half of that fix.
 *
 * ---------------------------------------------------------------------------
 * THE PLATFORM LIST
 * ---------------------------------------------------------------------------
 * `PLATFORMS` below mirrors `BUILTIN_PERSONA_LINK_PLATFORMS` in
 * `@commonpub/persona`, which is what `setSharedLinkPlatforms` validates a
 * chosen platform against. It is a local copy rather than an import because a
 * page importing package VALUES pulls them into the client bundle for every
 * instance, including the ones with `persona` off, and this tab must work
 * there. The copy is not left to drift: `settingsProfileTabs.test.ts` imports
 * the real list and fails if the keys, labels or placeholders diverge.
 */
import type { Serialized, UserProfile } from '@commonpub/server';

definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: `Profile links, ${useSiteName()}` });

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

interface LinkPlatform {
  key: string;
  label: string;
  placeholder: string;
}

/** Mirror of `BUILTIN_PERSONA_LINK_PLATFORMS`, pinned by a test. */
const PLATFORMS: readonly LinkPlatform[] = [
  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/yourname' },
  { key: 'twitter', label: 'X (Twitter)', placeholder: 'https://x.com/yourname' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://www.linkedin.com/in/yourname' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://www.youtube.com/@yourchannel' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://www.instagram.com/yourname' },
  { key: 'mastodon', label: 'Mastodon', placeholder: 'https://mastodon.social/@yourname' },
  { key: 'discord', label: 'Discord', placeholder: 'https://discord.gg/yourinvite' },
];

const website = ref('');
const socialLinks = ref<Record<string, string>>(
  Object.fromEntries(PLATFORMS.map((p) => [p.key, ''])),
);

const { data: profile } = await useFetch<Serialized<UserProfile>>('/api/profile');

if (profile.value) {
  website.value = profile.value.website || '';
  const stored = (profile.value.socialLinks ?? {}) as Record<string, string | undefined>;
  for (const [key, value] of Object.entries(stored)) {
    if (typeof value === 'string') socialLinks.value[key] = value;
  }
}

/**
 * Platforms this instance does not ship an input for, but this member has a
 * value in: an operator declares extra link platforms in `config.persona`, and
 * before the merge those answers were editable only on the persona editor. The
 * label is derived from the key because the operator's own label lives in the
 * persona schema, which this tab deliberately does not load.
 */
const extraPlatforms = computed<LinkPlatform[]>(() => {
  const known = new Set(PLATFORMS.map((p) => p.key));
  return Object.keys(socialLinks.value)
    .filter((key) => !known.has(key))
    .sort()
    .map((key) => ({
      key,
      label: key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      placeholder: 'https://',
    }));
});

const allPlatforms = computed<LinkPlatform[]>(() => [...PLATFORMS, ...extraPlatforms.value]);

onMounted(() => {
  nextTick(() => {
    watch([website, socialLinks], () => { isDirty.value = true; }, { deep: true });
  });
});

async function handleSave(): Promise<void> {
  saving.value = true;
  try {
    await $fetch('/api/profile', {
      method: 'PUT',
      body: {
        website: website.value,
        socialLinks: socialLinks.value,
      },
    });
    toast.success('Links updated');
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
    <h2 class="cpub-section-title-lg">Links</h2>

    <form class="cpub-settings-form" @submit.prevent="handleSave">
      <div class="cpub-form-section">
        <span class="cpub-form-section-label">Website</span>

        <div class="cpub-form-group">
          <label for="link-website" class="cpub-form-label">Website</label>
          <input
            id="link-website"
            v-model="website"
            type="url"
            class="cpub-input"
            placeholder="https://..."
          />
          <!--
            `website` is a `users` column, not a platform key. It has no row in
            `user_shared_links` to consult, so it never grows a per-platform
            sharing toggle; whether it is disclosed is decided by the data class
            it belongs to, not by a switch here.
          -->
        </div>
      </div>

      <div class="cpub-form-section">
        <span class="cpub-form-section-label">Platforms</span>

        <div
          v-for="platform in allPlatforms"
          :key="platform.key"
          class="cpub-link-row"
          :data-platform="platform.key"
        >
          <div class="cpub-form-group">
            <label :for="`social-${platform.key}`" class="cpub-form-label">{{ platform.label }}</label>
            <input
              :id="`social-${platform.key}`"
              v-model="socialLinks[platform.key]"
              type="url"
              class="cpub-input"
              :placeholder="platform.placeholder"
            />
          </div>
        </div>
      </div>

      <!--
        The sharing control is a SIBLING of the platform list, not a toggle
        inside each row, and that is a deliberate shape rather than a
        convenience. `<PersonaLinkSharing>` fetches `GET /api/persona/links` and
        writes `PUT /api/persona/links` itself; mounted once per row it would
        either fire one request per platform or leave every other row showing a
        state a write had already changed. It renders its own row per platform
        the member has actually filled in.

        It takes no props and renders NOTHING at all when the server says no
        purpose covering `profile_links` is offerable, so an instance running
        `persona` with no sharing ambitions sees no heading, no hint and no word
        about recruiters or sponsors (plan R2.3). It also renders nothing before
        its fetch resolves, so it cannot flash a control about to disappear.

        It is OUTSIDE the form on purpose: a save that also granted a disclosure
        would be the bundling pattern this whole design exists to avoid.
      -->
      <PersonaLinkSharing />

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

.cpub-link-row {
  display: flex;
  flex-direction: column;
}

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
</style>
