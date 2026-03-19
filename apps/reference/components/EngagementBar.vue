<script setup lang="ts">
const props = defineProps<{
  targetType: string;
  targetId: string;
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

const liked = ref(props.isLiked ?? false);
const bookmarked = ref(props.isBookmarked ?? false);
const likes = ref(props.likeCount);

watch(() => props.isLiked, (v) => { liked.value = v ?? false; });
watch(() => props.isBookmarked, (v) => { bookmarked.value = v ?? false; });
watch(() => props.likeCount, (v) => { likes.value = v; });

async function toggleLike(): Promise<void> {
  const prev = liked.value;
  const prevCount = likes.value;
  liked.value = !liked.value;
  likes.value += liked.value ? 1 : -1;

  try {
    await $fetch('/api/social/like', {
      method: 'POST',
      body: { targetType: props.targetType, targetId: props.targetId },
    });
    emit('like');
  } catch {
    liked.value = prev;
    likes.value = prevCount;
  }
}

async function toggleBookmark(): Promise<void> {
  const prev = bookmarked.value;
  bookmarked.value = !bookmarked.value;

  try {
    await $fetch('/api/social/bookmark', {
      method: 'POST',
      body: { targetType: props.targetType, targetId: props.targetId },
    });
    emit('bookmark');
  } catch {
    bookmarked.value = prev;
  }
}
</script>

<template>
  <div class="cpub-engagement" role="toolbar" aria-label="Content actions">
    <button
      class="cpub-engage-btn"
      :class="{ 'cpub-engage-active': liked }"
      :aria-pressed="liked"
      aria-label="Like"
      @click="toggleLike"
    >
      <i :class="liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart'"></i>
      <span>{{ likes }}</span>
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
      @click="toggleBookmark"
    >
      <i :class="bookmarked ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark'"></i>
    </button>

    <button class="cpub-engage-btn" aria-label="Share" @click="$emit('share')">
      <i class="fa-solid fa-share-nodes"></i>
    </button>
  </div>
</template>

<style scoped>
.cpub-engagement {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-3) 0;
  border-top: 2px solid var(--border);
  border-bottom: 2px solid var(--border);
}

.cpub-engage-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: none;
  border: 2px solid transparent;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  color: var(--text-dim);
  cursor: pointer;
  transition: all 0.15s;
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
