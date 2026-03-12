import { Node, wrappingInputRule } from '@tiptap/core';

export type CalloutVariant = 'info' | 'tip' | 'warning' | 'danger';

export interface CalloutOptions {
  variants: CalloutVariant[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attributes?: { variant?: CalloutVariant }) => ReturnType;
      toggleCallout: (attributes?: { variant?: CalloutVariant }) => ReturnType;
    };
  }
}

export const CommonPubCallout = Node.create<CalloutOptions>({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addOptions() {
    return {
      variants: ['info', 'tip', 'warning', 'danger'] as CalloutVariant[],
    };
  },

  addAttributes() {
    return {
      variant: {
        default: 'info',
        parseHTML: (element: HTMLElement) => {
          const classList = element.className.split(' ');
          for (const cls of classList) {
            const match = cls.match(/^callout-(\w+)$/);
            if (match?.[1]) return match[1];
          }
          return 'info';
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div.callout' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, class: `callout callout-${node.attrs.variant}` }, 0];
  },

  addCommands() {
    return {
      setCallout:
        (attributes?: { variant?: CalloutVariant }) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attributes);
        },
      toggleCallout:
        (attributes?: { variant?: CalloutVariant }) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attributes);
        },
    };
  },

  addInputRules() {
    return this.options.variants.map((variant) =>
      wrappingInputRule({
        find: new RegExp(`^:::${variant}\\s$`),
        type: this.type,
        getAttributes: () => ({ variant }),
      }),
    );
  },
});
