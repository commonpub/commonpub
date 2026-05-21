import { Node, mergeAttributes } from '@tiptap/core';

export interface ImageOptions {
  allowBase64: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    image: {
      setImage: (attributes: {
        src: string;
        alt?: string;
        caption?: string;
        size?: 's' | 'm' | 'l' | 'full';
      }) => ReturnType;
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
      // Rendered-width preset. Default `m` for new uploads; existing
      // pre-picker BlockTuples lack this attr and render at `l` via the
      // viewer's fallback to preserve their visual width.
      size: { default: 'm' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
        getAttrs: (dom) => {
          const element = dom as HTMLElement;
          const sizeAttr = element.getAttribute('data-size');
          const size =
            sizeAttr === 's' || sizeAttr === 'm' || sizeAttr === 'l' || sizeAttr === 'full'
              ? sizeAttr
              : 'm';
          return {
            src: element.getAttribute('src'),
            alt: element.getAttribute('alt') || '',
            size,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'img',
      mergeAttributes(HTMLAttributes, {
        src: HTMLAttributes.src,
        alt: HTMLAttributes.alt,
        // Serialize as `data-size` so it survives roundtripping without
        // conflicting with the HTML5 `width` attribute (we intentionally
        // don't set width; CSS handles sizing via .cpub-image-size-* class).
        'data-size': HTMLAttributes.size || 'm',
      }),
    ];
  },

  addCommands() {
    return {
      setImage:
        (attributes: {
          src: string;
          alt?: string;
          caption?: string;
          size?: 's' | 'm' | 'l' | 'full';
        }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { size: 'm', ...attributes },
          });
        },
    };
  },
});
