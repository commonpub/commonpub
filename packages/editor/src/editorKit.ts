import { Editor, type AnyExtension } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { Bold } from '@tiptap/extension-bold';
import { Italic } from '@tiptap/extension-italic';
import { Code } from '@tiptap/extension-code';
import { Link } from '@tiptap/extension-link';
import { History } from '@tiptap/extension-history';
import { Placeholder } from '@tiptap/extension-placeholder';
import { DOMSerializer } from '@tiptap/pm/model';
import { SnaplifyText } from './extensions/text';
import { SnaplifyHeading } from './extensions/heading';
import { SnaplifyCodeBlock } from './extensions/code';
import { SnaplifyImage } from './extensions/image';
import { SnaplifyQuote } from './extensions/quote';
import { SnaplifyCallout } from './extensions/callout';
import { blockTuplesToDoc, docToBlockTuples, buildEditorSchema } from './serialization';
import type { BlockTuple } from './blocks/types';

export interface CreateSnaplifyEditorOptions {
  content?: BlockTuple[];
  editable?: boolean;
  placeholder?: string;
  onUpdate?: (blocks: BlockTuple[]) => void;
  extensions?: AnyExtension[];
  element?: HTMLElement;
}

export function createSnaplifyEditor(
  options: CreateSnaplifyEditorOptions = {}
): Editor {
  const {
    content,
    editable = true,
    placeholder = 'Start writing...',
    onUpdate,
    extensions = [],
    element,
  } = options;

  // Build initial HTML content from BlockTuples if provided
  let htmlContent: string | undefined;
  if (content && content.length > 0) {
    const schema = buildEditorSchema();
    const doc = blockTuplesToDoc(content, schema);
    const fragment = DOMSerializer.fromSchema(schema).serializeFragment(doc.content);
    const wrapper = document.createElement('div');
    wrapper.appendChild(fragment);
    htmlContent = wrapper.innerHTML;
  }

  const coreExtensions: AnyExtension[] = [
    Document,
    Text,
    SnaplifyText,
    SnaplifyHeading,
    SnaplifyCodeBlock,
    SnaplifyImage,
    SnaplifyQuote,
    SnaplifyCallout,
    Bold,
    Italic,
    Code,
    Link.configure({ openOnClick: false }),
    History,
    Placeholder.configure({ placeholder }),
  ];

  const editor = new Editor({
    extensions: [...coreExtensions, ...extensions],
    content: htmlContent ?? '<p></p>',
    editable,
    element: element ?? document.createElement('div'),
    onUpdate: onUpdate
      ? ({ editor: e }) => {
          const blocks = docToBlockTuples(e.state.doc);
          onUpdate(blocks);
        }
      : undefined,
  });

  return editor;
}
