import { Node } from '@tiptap/core';

export const SnaplifyText = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',

  parseHTML() {
    return [{ tag: 'p' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', HTMLAttributes, 0];
  },
});
