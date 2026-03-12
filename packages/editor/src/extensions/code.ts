import { Node, textblockTypeInputRule } from '@tiptap/core';

export interface CodeBlockOptions {
  defaultLanguage: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    codeBlock: {
      setCodeBlock: (attributes?: { language?: string }) => ReturnType;
      toggleCodeBlock: (attributes?: { language?: string }) => ReturnType;
    };
  }
}

export const CommonPubCodeBlock = Node.create<CodeBlockOptions>({
  name: 'code_block',
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,

  addOptions() {
    return {
      defaultLanguage: '',
    };
  },

  addAttributes() {
    return {
      language: {
        default: this.options.defaultLanguage,
        parseHTML: (element: HTMLElement) =>
          element.querySelector('code')?.getAttribute('class')?.replace('language-', '') ?? '',
      },
      filename: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-filename'),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.filename) return {};
          return { 'data-filename': attributes.filename as string };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'pre', preserveWhitespace: 'full' as const }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'pre',
      HTMLAttributes,
      ['code', { class: node.attrs.language ? `language-${node.attrs.language}` : null }, 0],
    ];
  },

  addCommands() {
    return {
      setCodeBlock:
        (attributes?: { language?: string }) =>
        ({ commands }) => {
          return commands.setNode(this.name, attributes);
        },
      toggleCodeBlock:
        (attributes?: { language?: string }) =>
        ({ commands }) => {
          return commands.toggleNode(this.name, 'paragraph', attributes);
        },
    };
  },

  addInputRules() {
    return [
      textblockTypeInputRule({
        find: /^```([a-z]*)\s$/,
        type: this.type,
        getAttributes: (match) => ({
          language: match[1] || this.options.defaultLanguage,
        }),
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-c': () => this.editor.commands.toggleNode(this.name, 'paragraph'),
      Tab: ({ editor }) => {
        if (editor.isActive(this.name)) {
          editor.commands.insertContent('\t');
          return true;
        }
        return false;
      },
    };
  },
});
