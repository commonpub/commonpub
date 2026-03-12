import { z } from 'zod';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Schema, DOMParser, DOMSerializer } from '@tiptap/pm/model';
import type { BlockTuple } from './blocks/types.js';
import { lookupBlock, listBlocks } from './blocks/registry.js';

/** Zod schema for validating raw block tuples */
const blockTupleSchema = z.tuple([z.string(), z.record(z.string(), z.unknown())]);
const blockTuplesSchema = z.array(blockTupleSchema);

/** Validate raw input as BlockTuple[] using registered block schemas */
export function validateBlockTuples(raw: unknown): {
  success: boolean;
  data?: BlockTuple[];
  errors?: string[];
} {
  // First validate the structural shape
  const structResult = blockTuplesSchema.safeParse(raw);
  if (!structResult.success) {
    return { success: false, errors: [structResult.error.message] };
  }

  const tuples = structResult.data as BlockTuple[];
  const errors: string[] = [];

  for (let i = 0; i < tuples.length; i++) {
    const [type, content] = tuples[i]!;
    const definition = lookupBlock(type);
    if (!definition) {
      errors.push(`Block ${i}: unknown type "${type}"`);
      continue;
    }
    const result = definition.schema.safeParse(content);
    if (!result.success) {
      errors.push(`Block ${i} (${type}): ${result.error.message}`);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: tuples };
}

/** Build a ProseMirror Schema from registered block definitions */
export function buildEditorSchema(): Schema {
  const nodes: Record<string, any> = {
    doc: { content: 'block+' },
    // Text node type (ProseMirror's inline text)
    text: { group: 'inline', inline: true },
    // Paragraph (maps to our 'text' block type)
    paragraph: {
      group: 'block',
      content: 'inline*',
      parseDOM: [{ tag: 'p' }],
      toDOM: () => ['p', 0],
    },
    // Heading block
    heading: {
      group: 'block',
      attrs: { level: { default: 2 } },
      content: 'inline*',
      parseDOM: [
        { tag: 'h1', attrs: { level: 1 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } },
        { tag: 'h4', attrs: { level: 4 } },
      ],
      toDOM: (node: any) => [`h${node.attrs.level}`, 0],
    },
    // Code block
    code_block: {
      group: 'block',
      attrs: { language: { default: '' }, filename: { default: null } },
      content: 'text*',
      marks: '',
      code: true,
      parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' as const }],
      toDOM: () => ['pre', ['code', 0]],
    },
    // Image block
    image: {
      group: 'block',
      attrs: {
        src: { default: '' },
        alt: { default: '' },
        caption: { default: null },
      },
      parseDOM: [
        {
          tag: 'img[src]',
          getAttrs: (dom: any) => ({
            src: dom.getAttribute('src'),
            alt: dom.getAttribute('alt') || '',
          }),
        },
      ],
      toDOM: (node: any) => ['img', { src: node.attrs.src, alt: node.attrs.alt }],
    },
    // Blockquote (maps to our 'quote' block type)
    blockquote: {
      group: 'block',
      content: 'block+',
      attrs: { attribution: { default: null } },
      parseDOM: [{ tag: 'blockquote' }],
      toDOM: () => ['blockquote', 0],
    },
    // Callout block
    callout: {
      group: 'block',
      content: 'block+',
      attrs: { variant: { default: 'info' } },
      parseDOM: [{ tag: 'div.callout' }],
      toDOM: (node: any) => ['div', { class: `callout callout-${node.attrs.variant}` }, 0],
    },
    bullet_list: { group: 'block', content: 'list_item+', parseDOM: [{ tag: 'ul' }], toDOM: () => ['ul', 0] },
    ordered_list: { group: 'block', content: 'list_item+', attrs: { start: { default: 1 } }, parseDOM: [{ tag: 'ol' }], toDOM: () => ['ol', 0] },
    list_item: { content: 'paragraph block*', parseDOM: [{ tag: 'li' }], toDOM: () => ['li', 0] },
    horizontal_rule: { group: 'block', parseDOM: [{ tag: 'hr' }], toDOM: () => ['hr'] },
  };

  const marks: Record<string, any> = {
    bold: {
      parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
      toDOM: () => ['strong', 0],
    },
    italic: {
      parseDOM: [{ tag: 'em' }, { tag: 'i' }],
      toDOM: () => ['em', 0],
    },
    code: {
      parseDOM: [{ tag: 'code' }],
      toDOM: () => ['code', 0],
    },
    strike: {
      parseDOM: [{ tag: 's' }, { tag: 'del' }, { tag: 'strike' }],
      toDOM: () => ['s', 0],
    },
    link: {
      attrs: { href: { default: '' } },
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs: (dom: any) => ({ href: dom.getAttribute('href') }),
        },
      ],
      toDOM: (node: any) => ['a', { href: node.attrs.href }, 0],
    },
  };

  return new Schema({ nodes, marks });
}

/** Convert BlockTuple[] to a ProseMirror document Node */
export function blockTuplesToDoc(blocks: BlockTuple[], schema?: Schema): ProseMirrorNode {
  const s = schema ?? buildEditorSchema();
  const pmNodes: ProseMirrorNode[] = [];

  for (const [type, content] of blocks) {
    switch (type) {
      case 'text': {
        const c = content as { html: string };
        // Parse HTML into paragraph nodes
        const div = createDomElement(c.html || '<p></p>');
        const parsed = DOMParser.fromSchema(s).parse(div);
        // Extract child nodes from the parsed doc
        for (let i = 0; i < parsed.childCount; i++) {
          pmNodes.push(parsed.child(i));
        }
        break;
      }
      case 'heading': {
        const c = content as { text: string; level: number };
        const textNode = c.text ? s.text(c.text) : undefined;
        pmNodes.push(
          s.nodes.heading!.create({ level: c.level }, textNode ? [textNode] : undefined),
        );
        break;
      }
      case 'code': {
        const c = content as { code: string; language: string; filename?: string };
        const textNode = c.code ? s.text(c.code) : undefined;
        pmNodes.push(
          s.nodes.code_block!.create(
            { language: c.language, filename: c.filename ?? null },
            textNode ? [textNode] : undefined,
          ),
        );
        break;
      }
      case 'image': {
        const c = content as { src: string; alt: string; caption?: string };
        pmNodes.push(
          s.nodes.image!.create({
            src: c.src,
            alt: c.alt,
            caption: c.caption ?? null,
          }),
        );
        break;
      }
      case 'quote': {
        const c = content as { html: string; attribution?: string };
        const div = createDomElement(c.html || '<p></p>');
        const parsed = DOMParser.fromSchema(s).parse(div);
        const children: ProseMirrorNode[] = [];
        for (let i = 0; i < parsed.childCount; i++) {
          children.push(parsed.child(i));
        }
        pmNodes.push(s.nodes.blockquote!.create({ attribution: c.attribution ?? null }, children));
        break;
      }
      case 'callout': {
        const c = content as { html: string; variant: string };
        const div = createDomElement(c.html || '<p></p>');
        const parsed = DOMParser.fromSchema(s).parse(div);
        const children: ProseMirrorNode[] = [];
        for (let i = 0; i < parsed.childCount; i++) {
          children.push(parsed.child(i));
        }
        pmNodes.push(s.nodes.callout!.create({ variant: c.variant }, children));
        break;
      }
      case 'list': {
        const c = content as { ordered: boolean; items: string[] };
        const listType = c.ordered ? 'ordered_list' : 'bullet_list';
        const listItems = c.items.map((itemHtml: string) => {
          const div = createDomElement(itemHtml || '<p></p>');
          const parsed = DOMParser.fromSchema(s).parse(div);
          const children: ProseMirrorNode[] = [];
          for (let i = 0; i < parsed.childCount; i++) {
            children.push(parsed.child(i));
          }
          return s.nodes.list_item!.create(null, children);
        });
        pmNodes.push(s.nodes[listType]!.create(c.ordered ? { start: 1 } : null, listItems));
        break;
      }
      case 'divider': {
        pmNodes.push(s.nodes.horizontal_rule!.create());
        break;
      }
    }
  }

  return s.nodes.doc!.create(null, pmNodes);
}

/** Convert a ProseMirror document Node back to BlockTuple[] */
export function docToBlockTuples(doc: ProseMirrorNode): BlockTuple[] {
  const blocks: BlockTuple[] = [];

  doc.forEach((node) => {
    switch (node.type.name) {
      case 'paragraph': {
        const serializer = DOMSerializer.fromSchema(node.type.schema);
        const dom = serializer.serializeNode(node);
        const html = (dom as HTMLElement).outerHTML;
        blocks.push(['text', { html }]);
        break;
      }
      case 'heading': {
        blocks.push(['heading', { text: node.textContent, level: node.attrs.level }]);
        break;
      }
      case 'code_block': {
        const attrs: Record<string, unknown> = {
          code: node.textContent,
          language: node.attrs.language || '',
        };
        if (node.attrs.filename) {
          attrs.filename = node.attrs.filename;
        }
        blocks.push(['code', attrs]);
        break;
      }
      case 'image': {
        const attrs: Record<string, unknown> = {
          src: node.attrs.src,
          alt: node.attrs.alt,
        };
        if (node.attrs.caption) {
          attrs.caption = node.attrs.caption;
        }
        blocks.push(['image', attrs]);
        break;
      }
      case 'blockquote': {
        const serializer = DOMSerializer.fromSchema(node.type.schema);
        // Serialize children
        const fragment = serializer.serializeFragment(node.content);
        const wrapper = createDomElement('');
        wrapper.appendChild(fragment);
        const html = wrapper.innerHTML;
        const attrs: Record<string, unknown> = { html };
        if (node.attrs.attribution) {
          attrs.attribution = node.attrs.attribution;
        }
        blocks.push(['quote', attrs]);
        break;
      }
      case 'callout': {
        const serializer = DOMSerializer.fromSchema(node.type.schema);
        const fragment = serializer.serializeFragment(node.content);
        const wrapper = createDomElement('');
        wrapper.appendChild(fragment);
        const html = wrapper.innerHTML;
        blocks.push(['callout', { html, variant: node.attrs.variant }]);
        break;
      }
      case 'bullet_list':
      case 'ordered_list': {
        const items: string[] = [];
        node.forEach((child) => {
          const serializer = DOMSerializer.fromSchema(node.type.schema);
          const fragment = serializer.serializeFragment(child.content);
          const wrapper = createDomElement('');
          wrapper.appendChild(fragment);
          items.push(wrapper.innerHTML);
        });
        blocks.push(['list', { ordered: node.type.name === 'ordered_list', items }]);
        break;
      }
      case 'horizontal_rule': {
        blocks.push(['divider', {}]);
        break;
      }
    }
  });

  return blocks;
}

/** Helper to create a DOM element for parsing */
function createDomElement(html: string): HTMLElement {
  // Works in both browser and jsdom
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}
