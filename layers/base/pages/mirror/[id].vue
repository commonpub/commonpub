<script setup lang="ts">
definePageMeta({ layout: 'default' });

const route = useRoute();
const id = route.params.id as string;

const { data: fedContent, error, pending } = await useFetch<Record<string, unknown>>(`/api/federation/content/${id}`);

const {
  contentType,
  actor,
  transformedContent,
  originDomain,
  originUrl,
  authorHandle,
} = useMirrorContent(fedContent);

const { user } = useAuth();
const following = ref(false);
const followState = ref<'idle' | 'sent' | 'error'>('idle');
const remoteFollowRef = ref<{ show: () => void } | null>(null);

async function followAuthor(): Promise<void> {
  const uri = actor.value?.actorUri as string | undefined;
  if (!uri) return;
  following.value = true;
  followState.value = 'idle';
  try {
    await $fetch('/api/federation/follow', { method: 'POST', body: { actorUri: uri } });
    followState.value = 'sent';
  } catch {
    followState.value = 'error';
  } finally {
    following.value = false;
  }
}

// SEO
if (originUrl.value) {
  useHead({
    link: [{ rel: 'canonical', href: originUrl.value }],
    meta: [{ name: 'robots', content: 'noindex, follow' }],
  });
}

/** Strip HTML tags from remote actor bio (unsanitized — XSS risk with v-html) */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

// Track view
onMounted(() => {
  $fetch(`/api/federation/content/${id}/view`, { method: 'POST' }).catch(() => {});
});

useSeoMeta({
  title: transformedContent.value?.title ?? 'Mirrored Content',
  description: transformedContent.value?.description ?? '',
});
</script>

<template>
  <div v-if="pending" class="cpub-loading" style="padding: 64px 24px; text-align: center">Loading content...</div>
  <div v-else-if="error" class="cpub-not-found">
    <h1>Content not found</h1>
    <p>This mirrored content may have been removed or is unavailable.</p>
    <NuxtLink to="/">Back to home</NuxtLink>
  </div>

  <template v-else-if="transformedContent">
    <!-- Federation banner -->
    <div class="cpub-fed-banner">
      <div class="cpub-fed-banner-inner">
        <i class="fa-solid fa-globe"></i>
        <span>
          Federated from <strong>{{ originDomain }}</strong>
          <span v-if="authorHandle" class="cpub-fed-banner-handle">{{ authorHandle }}</span>
        </span>
        <button
          v-if="user && actor?.actorUri && followState !== 'sent'"
          class="cpub-fed-banner-follow"
          :class="{ 'cpub-fed-banner-follow-error': followState === 'error' }"
          :disabled="following"
          @click="followAuthor"
        >
          <i :class="followState === 'error' ? 'fa-solid fa-rotate-right' : 'fa-solid fa-user-plus'"></i>
          {{ following ? 'Following...' : followState === 'error' ? 'Retry' : 'Follow' }}
        </button>
        <span v-if="followState === 'sent'" class="cpub-fed-banner-followed"><i class="fa-solid fa-check"></i> Follow sent</span>
        <button v-if="actor?.actorUri && !user" class="cpub-fed-banner-follow" @click="remoteFollowRef?.show()">
          <i class="fa-solid fa-user-plus"></i> Follow from your instance
        </button>
        <a v-if="originUrl" :href="originUrl" target="_blank" rel="noopener noreferrer" class="cpub-fed-banner-link">
          View Original <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      </div>
    </div>

    <!-- Reuse existing content view components by type -->
    <ViewsProjectView v-if="contentType === 'project'" :content="transformedContent" :federated-id="id" />
    <ViewsArticleView v-else-if="contentType === 'article'" :content="transformedContent" :federated-id="id" />
    <ViewsBlogView v-else-if="contentType === 'blog'" :content="transformedContent" :federated-id="id" />
    <ViewsExplainerView v-else-if="contentType === 'explainer'" :content="transformedContent" :federated-id="id" />

    <!-- Fallback for non-CommonPub content (Mastodon notes, Lemmy posts, etc.) -->
    <article v-else class="cpub-mirror-fallback">
      <div class="cpub-mirror-container">
        <img v-if="transformedContent.coverImageUrl" :src="transformedContent.coverImageUrl" :alt="transformedContent.title" class="cpub-mirror-cover" />
        <h1 class="cpub-mirror-title">{{ transformedContent.title }}</h1>
        <p v-if="transformedContent.description" class="cpub-mirror-desc">{{ transformedContent.description }}</p>
        <div class="cpub-mirror-author">
          <img v-if="transformedContent.author.avatarUrl" :src="transformedContent.author.avatarUrl" :alt="transformedContent.author.displayName || ''" class="cpub-mirror-author-avatar" />
          <div>
            <strong>{{ transformedContent.author.displayName }}</strong>
            <span v-if="authorHandle" class="cpub-mirror-handle">{{ authorHandle }}</span>
            <span v-if="transformedContent.author.followerCount" class="cpub-mirror-handle">&middot; {{ transformedContent.author.followerCount }} followers</span>
            <p v-if="transformedContent.author.bio" class="cpub-mirror-bio">{{ stripHtml(transformedContent.author.bio) }}</p>
          </div>
        </div>
        <!-- Content is sanitized on ingest (inboxHandlers.ts → sanitizeHtml). Safe for v-html. -->
        <div v-if="typeof transformedContent.content === 'string'" class="cpub-mirror-body prose" v-html="transformedContent.content" />
        <ContentAttachments v-if="transformedContent.attachments?.length" :attachments="transformedContent.attachments" />
        <div v-if="transformedContent.tags?.length" class="cpub-mirror-tags">
          <NuxtLink v-for="tag in transformedContent.tags" :key="tag.name" :to="`/tags/${tag.slug || tag.name.toLowerCase().replace(/\s+/g, '-')}`" class="cpub-mirror-tag">{{ tag.name }}</NuxtLink>
        </div>
      </div>
    </article>
  </template>

  <RemoteFollowDialog v-if="actor?.actorUri" ref="remoteFollowRef" :actor-uri="(actor.actorUri as string)" :label="transformedContent?.author?.displayName || authorHandle" />
</template>

<style scoped>
.cpub-fed-banner {
  background: var(--accent-bg); border-bottom: 1px solid var(--accent-border);
}
.cpub-fed-banner-inner {
  max-width: 1200px; margin: 0 auto; padding: 8px 24px;
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: var(--text-dim);
}
.cpub-fed-banner-inner > i { color: var(--accent); flex-shrink: 0; }
.cpub-fed-banner-handle { color: var(--text-faint); margin-left: 4px; }
.cpub-fed-banner-link {
  margin-left: auto; color: var(--accent); font-weight: 600;
  text-decoration: none; white-space: nowrap;
  display: flex; align-items: center; gap: 4px; font-size: 11px;
}
.cpub-fed-banner-follow {
  margin-left: auto; background: var(--accent); color: var(--accent-text, #fff); border: none;
  font-size: 11px; font-weight: 600; padding: 3px 10px; cursor: pointer;
  display: flex; align-items: center; gap: 4px; white-space: nowrap;
}
.cpub-fed-banner-follow:hover { opacity: 0.9; }
.cpub-fed-banner-follow:disabled { opacity: 0.6; cursor: default; }
.cpub-fed-banner-followed { margin-left: auto; font-size: 11px; color: var(--green, #22c55e); font-weight: 600; display: flex; align-items: center; gap: 4px; }
.cpub-fed-banner-link:hover { text-decoration: underline; }

/* Fallback for non-CommonPub content */
.cpub-mirror-fallback { max-width: 780px; margin: 0 auto; padding: 32px 16px 60px; }
.cpub-mirror-cover { width: 100%; max-height: 400px; object-fit: cover; margin-bottom: 20px; }
.cpub-mirror-title { font-size: 2rem; font-weight: 800; line-height: 1.2; margin-bottom: 12px; }
.cpub-mirror-desc { font-size: 1.0625rem; color: var(--text-dim); line-height: 1.6; margin-bottom: 16px; }
.cpub-mirror-author { font-size: 0.875rem; color: var(--text-dim); margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border); display: flex; align-items: flex-start; gap: 12px; }
.cpub-mirror-author-avatar { width: 40px; height: 40px; object-fit: cover; border: var(--border-width-default) solid var(--border); flex-shrink: 0; }
.cpub-mirror-bio { font-size: 0.8125rem; color: var(--text-faint); line-height: 1.5; margin-top: 4px; }
.cpub-mirror-bio :deep(a) { color: var(--accent); }
.cpub-mirror-handle { color: var(--text-faint); margin-left: 6px; }
.cpub-mirror-body { font-size: 1rem; line-height: 1.75; margin-bottom: 32px; }
.cpub-mirror-body :deep(img) { max-width: 100%; }
.cpub-mirror-body :deep(a) { color: var(--accent); }
.cpub-mirror-body :deep(pre) { background: var(--surface2); padding: 12px; overflow-x: auto; }
.cpub-mirror-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.cpub-mirror-tag { font-size: 0.75rem; padding: 3px 8px; background: var(--surface2); color: var(--text-dim); text-decoration: none; }
.cpub-mirror-tag:hover { color: var(--accent); }

.cpub-not-found { text-align: center; padding: 60px 20px; color: var(--text-dim); }
.cpub-not-found h1 { font-size: 1.5rem; color: var(--text); margin-bottom: 8px; }
</style>
