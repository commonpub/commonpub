import { Editor, type AnyExtension } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { Bold } from '@tiptap/extension-bold';
import { Italic } from '@tiptap/extension-italic';
import { Code } from '@tiptap/extension-code';
import { Strike } from '@tiptap/extension-strike';
import { BulletList } from '@tiptap/extension-bullet-list';
import { OrderedList } from '@tiptap/extension-ordered-list';
import { ListItem } from '@tiptap/extension-list-item';
import { HorizontalRule } from '@tiptap/extension-horizontal-rule';
import { Link } from '@tiptap/extension-link';
import { History } from '@tiptap/extension-history';
import { Placeholder } from '@tiptap/extension-placeholder';
import { DOMSerializer } from '@tiptap/pm/model';
import { CommonPubText } from './extensions/text.js';
import { CommonPubHeading } from './extensions/heading.js';
import { CommonPubCodeBlock } from './extensions/code.js';
import { CommonPubImage } from './extensions/image.js';
import { CommonPubQuote } from './extensions/quote.js';
import { CommonPubCallout } from './extensions/callout.js';
import { blockTuplesToDoc, docToBlockTuples, buildEditorSchema } from './serialization.js';
import type { BlockTuple } from './blocks/types.js';

export interface CreateCommonPubEditorOptions {
  content?: BlockTuple[];
  editable?: boolean;
  placeholder?: string;
  onUpdate?: (blocks: BlockTuple[]) => void;
  extensions?: AnyExtension[];
  element?: HTMLElement;
}

export function createCommonPubEditor(options: CreateCommonPubEditorOptions = {}): Editor {
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
    CommonPubText,
    CommonPubHeading,
    CommonPubCodeBlock,
    CommonPubImage,
    CommonPubQuote,
    CommonPubCallout,
    Bold,
    Italic,
    Code,
    Strike,
    BulletList,
    OrderedList,
    ListItem,
    HorizontalRule,
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
