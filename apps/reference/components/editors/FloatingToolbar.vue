<script setup lang="ts">
defineProps<{
  editor?: any;
}>();

const isVisible = ref(false);
const position = ref({ top: 0, left: 0 });

function handleSelectionChange(): void {
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    position.value = {
      top: rect.top - 40,
      left: rect.left + rect.width / 2 - 100,
    };
    isVisible.value = true;
  } else {
    isVisible.value = false;
  }
}

onMounted(() => {
  document.addEventListener('selectionchange', handleSelectionChange);
});

onUnmounted(() => {
  document.removeEventListener('selectionchange', handleSelectionChange);
});
</script>

<template>
  <div
    v-show="isVisible"
    class="cpub-floating-toolbar"
    :style="{ top: position.top + 'px', left: position.left + 'px' }"
    role="toolbar"
    aria-label="Text formatting"
  >
    <button class="cpub-ft-btn" aria-label="Bold" @click="editor?.chain().focus().toggleBold().run()">
      <i class="fa-solid fa-bold"></i>
    </button>
    <button class="cpub-ft-btn" aria-label="Italic" @click="editor?.chain().focus().toggleItalic().run()">
      <i class="fa-solid fa-italic"></i>
    </button>
    <button class="cpub-ft-btn" aria-label="Underline" @click="editor?.chain().focus().toggleUnderline?.().run()">
      <i class="fa-solid fa-underline"></i>
    </button>
    <div class="cpub-ft-sep" aria-hidden="true"></div>
    <button class="cpub-ft-btn" aria-label="Link" @click="editor?.chain().focus().toggleLink?.({ href: '' }).run()">
      <i class="fa-solid fa-link"></i>
    </button>
    <button class="cpub-ft-btn" aria-label="Code" @click="editor?.chain().focus().toggleCode().run()">
      <i class="fa-solid fa-code"></i>
    </button>
    <button class="cpub-ft-btn" aria-label="Heading" @click="editor?.chain().focus().toggleHeading?.({ level: 2 }).run()">
      <i class="fa-solid fa-heading"></i>
    </button>
  </div>
</template>

<style scoped>
.cpub-floating-toolbar {
  position: fixed;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--surface);
  border: 2px solid var(--border);
  box-shadow: var(--shadow-md);
}

.cpub-ft-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 2px solid transparent;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 11px;
}

.cpub-ft-btn:hover {
  background: var(--surface2);
  border-color: var(--border);
  color: var(--text);
}

.cpub-ft-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.cpub-ft-sep {
  width: 1px;
  height: 18px;
  background: var(--border2);
  margin: 0 2px;
}
</style>
