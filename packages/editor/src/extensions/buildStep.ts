import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    buildStep: {
      setBuildStep: (attributes: { stepNumber: number; title?: string; time?: string; children?: Array<[string, Record<string, unknown>]> }) => ReturnType;
    };
  }
}

export const CommonPubBuildStep = Node.create({
  name: 'buildStep',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      stepNumber: { default: 1 },
      title: { default: '' },
      time: { default: null },
      children: {
        default: [],
        parseHTML: (element: HTMLElement) => {
          try {
            return JSON.parse(element.getAttribute('data-children') || '[]');
          } catch {
            return [];
          }
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-children': JSON.stringify(attributes.children),
        }),
      },
      // Legacy attributes — kept for migration from old format
      instructions: { default: null },
      image: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div.cpub-build-step' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'cpub-build-step' }),
      ['span', { class: 'cpub-build-step-number' }, `Step ${node.attrs.stepNumber}`],
      ['span', { class: 'cpub-build-step-title' }, node.attrs.title || ''],
    ];
  },

  addCommands() {
    return {
      setBuildStep:
        (attributes) =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, attrs: attributes });
        },
    };
  },
});
