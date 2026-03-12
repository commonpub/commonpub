import { Node, mergeAttributes } from '@tiptap/core';

export interface ImageOptions {
  allowBase64: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    image: {
      setImage: (attributes: { src: string; alt?: string; caption?: string }) => ReturnType;
    };
  }
}

export const CommonPubImage = Node.create<ImageOptions>({
  name: 'image',
  group: 'block',
  atom: true,

  addOptions() {
    return {
      allowBase64: false,
    };
  },

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      caption: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
        getAttrs: (dom) => {
          const element = dom as HTMLElement;
          return {
            src: element.getAttribute('src'),
            alt: element.getAttribute('alt') || '',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'img',
      mergeAttributes(HTMLAttributes, { src: HTMLAttributes.src, alt: HTMLAttributes.alt }),
    ];
  },

  addCommands() {
    return {
      setImage:
        (attributes: { src: string; alt?: string; caption?: string }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          });
        },
    };
  },
});
