import { Node, mergeAttributes, textblockTypeInputRule } from '@tiptap/core';

export interface HeadingOptions {
  levels: number[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    heading: {
      setHeading: (attributes: { level: number }) => ReturnType;
      toggleHeading: (attributes: { level: number }) => ReturnType;
    };
  }
}

export const CommonPubHeading = Node.create<HeadingOptions>({
  name: 'heading',
  group: 'block',
  content: 'inline*',
  defining: true,

  addOptions() {
    return {
      levels: [1, 2, 3, 4],
    };
  },

  addAttributes() {
    return {
      level: {
        default: 2,
        rendered: false,
      },
    };
  },

  parseHTML() {
    return this.options.levels.map((level) => ({
      tag: `h${level}`,
      attrs: { level },
    }));
  },

  renderHTML({ node, HTMLAttributes }) {
    const level = node.attrs.level as number;
    return [`h${level}`, mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setHeading:
        (attributes: { level: number }) =>
        ({ commands }) => {
          return commands.setNode(this.name, attributes);
        },
      toggleHeading:
        (attributes: { level: number }) =>
        ({ commands }) => {
          return commands.toggleNode(this.name, 'paragraph', attributes);
        },
    };
  },

  addInputRules() {
    return this.options.levels.map((level) =>
      textblockTypeInputRule({
        find: new RegExp(`^(#{1,${level}})\\s$`),
        type: this.type,
        getAttributes: (match) => {
          const hashes = match[1]?.length ?? level;
          return { level: Math.min(hashes, 4) };
        },
      }),
    );
  },

  addKeyboardShortcuts() {
    return this.options.levels.reduce(
      (shortcuts, level) => ({
        ...shortcuts,
        [`Mod-Alt-${level}`]: () =>
          this.editor.commands.toggleNode(this.name, 'paragraph', { level }),
      }),
      {} as Record<string, () => boolean>,
    );
  },
});
