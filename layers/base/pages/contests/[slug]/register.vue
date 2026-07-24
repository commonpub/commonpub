<script setup lang="ts">
/**
 * Dedicated, full-width registration page for a contest. Rich registration forms
 * (sections / address / file / signature / many fields) route here from the signup
 * sidebar instead of cramming into the ~300px card. Short forms use a modal; the
 * bare default stays a one-click register. Requires auth (the middleware bounces
 * anonymous visitors to login and back).
 */
import type { Serialized, ContestDetail } from '@commonpub/server';
import { effectiveRegistrationTemplate } from '../../../utils/contestRegistration';

definePageMeta({ middleware: 'auth' });

const route = useRoute();
const slug = route.params.slug as string;
const toast = useToast();
const { extract: extractError } = useApiError();

const { data: contest } = await useFetch<Serialized<ContestDetail>>(`/api/contests/${slug}`);
if (!contest.value) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });

useSeoMeta({ title: () => `Register — ${contest.value?.title ?? 'Contest'}` });

// Current registration state (saved answers prefill the form; client-only to avoid a
// hydration mismatch on per-viewer data).
const { data: reg } = useLazyFetch<{ registered: boolean; tier: 'full' | 'reminders' | null; fields: Record<string, string> | null; count: number }>(
  `/api/contests/${slug}/register`,
  { server: false },
);

const template = computed(() => effectiveRegistrationTemplate(contest.value?.registrationTemplate));
const savedFields = computed(() => reg.value?.fields ?? null);
const alreadyFull = computed(() => reg.value?.tier === 'full');

const REGISTERABLE = ['upcoming', 'active'];
const open = computed(() => REGISTERABLE.includes(contest.value?.status ?? ''));

const registering = ref(false);
async function onSave(fields: Record<string, string>): Promise<void> {
  if (registering.value) return;
  registering.value = true;
  try {
    await $fetch(`/api/contests/${slug}/register`, { method: 'POST', body: { tier: 'full', fields } });
    toast.success(alreadyFull.value ? 'Your details were saved' : "You're registered for this contest");
    await navigateTo(`/contests/${slug}`);
  } catch (err: unknown) {
    toast.error(extractError(err));
  } finally {
    registering.value = false;
  }
}
</script>

<template>
  <div class="cpub-reg-page">
    <NuxtLink :to="`/contests/${slug}`" class="cpub-reg-back">
      <i class="fa-solid fa-arrow-left"></i> Back to {{ contest?.title }}
    </NuxtLink>

    <header class="cpub-reg-head">
      <p class="cpub-reg-eyebrow"><i class="fa-solid fa-user-plus"></i> Registration</p>
      <h1 class="cpub-reg-title">{{ alreadyFull ? 'Edit your registration' : 'Register for' }} {{ alreadyFull ? '' : contest?.title }}</h1>
      <p v-if="contest?.subheading" class="cpub-reg-sub">{{ contest.subheading }}</p>
      <p class="cpub-reg-note">
        Personal-data fields (email, address, phone, uploads, signature) are stored privately
        and shown only to the organizers who need them. Agreements are recorded to the consent log.
      </p>
    </header>

    <div v-if="!open" class="cpub-reg-closed" role="status">
      Registration for this contest is closed.
    </div>

    <div v-else class="cpub-reg-formwrap">
      <ContestRegistrationForm
        :template="template"
        :saved-fields="savedFields"
        :registering="registering"
        id-prefix="cpub-regpage"
        :save-label="alreadyFull ? 'Save details' : 'Complete registration'"
        @save="onSave"
      />
    </div>
  </div>
</template>

<style scoped>
.cpub-reg-page { max-width: 720px; margin: 0 auto; padding: var(--space-6) var(--space-4) var(--space-12); }
.cpub-reg-back { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); color: var(--text-dim); text-decoration: none; margin-bottom: var(--space-5); }
.cpub-reg-back:hover { color: var(--accent); }
.cpub-reg-head { margin-bottom: var(--space-6); padding-bottom: var(--space-5); border-bottom: var(--border-width-default) solid var(--border2); }
.cpub-reg-eyebrow { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-label); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: var(--tracking-wide); color: var(--accent-text); margin: 0 0 var(--space-2); }
.cpub-reg-title { font-size: var(--text-2xl); font-weight: var(--font-weight-bold); line-height: var(--leading-tight); margin: 0 0 var(--space-2); }
.cpub-reg-sub { font-size: var(--text-base); color: var(--text-dim); margin: 0 0 var(--space-3); }
.cpub-reg-note { font-size: var(--text-xs); color: var(--text-dim); line-height: var(--leading-normal); margin: 0; max-width: 60ch; }
.cpub-reg-closed { padding: var(--space-4); border: var(--border-width-default) solid var(--border2); background: var(--surface2); color: var(--text-dim); font-size: var(--text-sm); }
.cpub-reg-formwrap { display: block; }
</style>
