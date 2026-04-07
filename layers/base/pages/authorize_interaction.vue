<script setup lang="ts">
/**
 * /authorize_interaction — Standard ActivityPub remote interaction endpoint.
 * When a user on another instance wants to follow/interact with content on this instance,
 * their instance redirects them here with ?uri=<actor-or-object-uri>.
 *
 * If logged in: show the resource and offer to follow/interact.
 * If not logged in: redirect to login first, then back here.
 */
const route = useRoute();
const uri = computed(() => (route.query.uri as string) || '');

const { isAuthenticated } = useAuth();
const toast = useToast();

const loading = ref(false);
const resolved = ref<{ type: string; name: string; url: string } | null>(null);
const error = ref('');
const actionDone = ref(false);

onMounted(async () => {
  if (!uri.value) {
    error.value = 'No URI provided.';
    return;
  }

  if (!isAuthenticated.value) {
    // Redirect to login, then back here
    navigateTo(`/auth/login?redirect=${encodeURIComponent(route.fullPath)}`);
    return;
  }

  // Try to resolve what the URI points to
  loading.value = true;
  try {
    // Check if it's a hub actor URI
    const result = await $fetch<{ type: string; name: string; url: string }>('/api/federation/resolve-uri', {
      method: 'POST',
      body: { uri: uri.value },
    }).catch(() => null);

    if (result) {
      resolved.value = result;
    } else {
      // Fallback: just show the URI and offer to open it
      resolved.value = { type: 'unknown', name: uri.value, url: uri.value };
    }
  } catch {
    error.value = 'Could not resolve the remote resource.';
  } finally {
    loading.value = false;
  }
});

async function handleFollow(): Promise<void> {
  if (!uri.value) return;
  loading.value = true;
  try {
    // Try to follow as a remote actor (user or hub)
    await $fetch('/api/federation/remote-follow', {
      method: 'POST',
      body: { uri: uri.value },
    });
    actionDone.value = true;
    toast.success('Follow request sent');
  } catch {
    toast.error('Failed to send follow request');
  } finally {
    loading.value = false;
  }
}

useSeoMeta({
  title: 'Authorize Interaction',
  robots: 'noindex',
});
</script>

<template>
  <div class="cpub-authorize-page">
    <div class="cpub-authorize-card">
      <h1 class="cpub-authorize-title">Authorize Interaction</h1>

      <div v-if="loading" class="cpub-authorize-loading">
        <i class="fa-solid fa-spinner fa-spin"></i> Resolving...
      </div>

      <div v-else-if="error" class="cpub-authorize-error">
        <i class="fa-solid fa-triangle-exclamation"></i> {{ error }}
      </div>

      <div v-else-if="resolved" class="cpub-authorize-content">
        <p class="cpub-authorize-desc">
          You are about to interact with a remote resource:
        </p>
        <div class="cpub-authorize-resource">
          <strong>{{ resolved.name }}</strong>
          <span v-if="resolved.type !== 'unknown'" class="cpub-authorize-type">{{ resolved.type }}</span>
        </div>
        <code class="cpub-authorize-uri">{{ uri }}</code>

        <div v-if="actionDone" class="cpub-authorize-success">
          <i class="fa-solid fa-check"></i> Follow request sent successfully.
        </div>
        <div v-else class="cpub-authorize-actions">
          <button class="cpub-btn cpub-btn-primary" :disabled="loading" @click="handleFollow">
            <i class="fa-solid fa-user-plus"></i> Follow
          </button>
          <a :href="uri" target="_blank" rel="noopener noreferrer" class="cpub-btn cpub-btn-sm">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> View Original
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-authorize-page {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 60px 16px;
  min-height: 60vh;
}
.cpub-authorize-card {
  max-width: 520px;
  width: 100%;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  padding: 32px;
}
.cpub-authorize-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 20px;
}
.cpub-authorize-loading {
  color: var(--text-dim);
  font-size: 14px;
}
.cpub-authorize-error {
  color: var(--red, #ef4444);
  font-size: 14px;
}
.cpub-authorize-desc {
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 16px;
}
.cpub-authorize-resource {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.cpub-authorize-resource strong {
  font-size: 15px;
}
.cpub-authorize-type {
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  background: var(--accent-bg);
  padding: 2px 6px;
}
.cpub-authorize-uri {
  display: block;
  font-size: 11px;
  color: var(--text-faint);
  word-break: break-all;
  margin-bottom: 20px;
  padding: 8px;
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border);
}
.cpub-authorize-success {
  color: var(--green, #22c55e);
  font-size: 14px;
  font-weight: 600;
}
.cpub-authorize-actions {
  display: flex;
  gap: 8px;
}
</style>
