// Editor composable — wraps @commonpub/editor for content pages
import { createCommonPubEditor, type CreateCommonPubEditorOptions } from '@commonpub/editor';

export function useEditor(options?: Partial<CreateCommonPubEditorOptions>) {
  const editor = ref<ReturnType<typeof createCommonPubEditor> | null>(null);

  onMounted(() => {
    editor.value = createCommonPubEditor({
      content: options?.content,
      editable: options?.editable ?? true,
      ...options,
    });
  });

  onBeforeUnmount(() => {
    editor.value?.destroy();
    editor.value = null;
  });

  return { editor };
}
