<script setup lang="ts">
const props = defineProps<{
  targetType: string;
  targetId: string;
  targetTitle?: string;
  likeCount: number;
  commentCount: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
}>();

const emit = defineEmits<{
  like: [];
  bookmark: [];
  share: [];
  comment: [];
}>();

const contentId = computed(() => props.targetId);
const contentType = computed(() => props.targetType);
const { liked, bookmarked, likeCount, toggleLike, toggleBookmark, share, setInitialState } = useEngagement({ contentId, contentType });
const { isAuthenticated } = useAuth();
const showHubModal = ref(false);

// Sync initial state from props
watch(() => [props.isLiked, props.isBookmarked, props.likeCount] as const, ([l, b, c]) => {
  setInitialState(l ?? false, b ?? false, c);
}, { immediate: true });

async function handleLike(): Promise<void> {
  await toggleLike();
  emit('like');
}

async function handleBookmark(): Promise<void> {
  await toggleBookmark();
  emit('bookmark');
}

async function handleShare(): Promise<void> {
  await share();
  emit('share');
}
</script>

<template>
  <div class="cpub-engagement" role="toolbar" aria-label="Content actions">
    <button
      class="cpub-engage-btn"
      :class="{ 'cpub-engage-active': liked }"
      :aria-pressed="liked"
      aria-label="Like"
      @click="handleLike"
    >
      <i :class="liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart'"></i>
      <span>{{ likeCount }}</span>
    </button>

    <button class="cpub-engage-btn" aria-label="Comments" @click="$emit('comment')">
      <i class="fa-regular fa-comment"></i>
      <span>{{ commentCount }}</span>
    </button>

    <button
      class="cpub-engage-btn"
      :class="{ 'cpub-engage-active': bookmarked }"
      :aria-pressed="bookmarked"
      aria-label="Bookmark"
      @click="handleBookmark"
    >
      <i :class="bookmarked ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark'"></i>
    </button>

    <button v-if="isAuthenticated" class="cpub-engage-btn" aria-label="Share to Hub" @click="showHubModal = true">
      <i class="fa-solid fa-users"></i>
      <span>Hub</span>
    </button>

    <button class="cpub-engage-btn" aria-label="Share" @click="handleShare">
      <i class="fa-solid fa-share-nodes"></i>
    </button>

    <ShareToHubModal
      v-if="showHubModal"
      :content-id="targetId"
      :content-title="targetTitle || 'this content'"
      @close="showHubModal = false"
      @shared="showHubModal = false"
    />
  </div>
</template>

<style scoped>
.cpub-engagement {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-3) 0;
  border-top: var(--border-width-default) solid var(--border);
  border-bottom: var(--border-width-default) solid var(--border);
}

.cpub-engage-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: none;
  border: var(--border-width-default) solid transparent;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  color: var(--text-dim);
  cursor: pointer;
  transition: all 0.15s;
  min-height: 44px;
}

.cpub-engage-btn:hover {
  background: var(--surface2);
  border-color: var(--border2);
  color: var(--text);
}

.cpub-engage-active {
  color: var(--accent);
}

.cpub-engage-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
</style>
