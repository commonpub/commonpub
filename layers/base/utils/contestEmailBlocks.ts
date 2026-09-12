import type { BlockTypeGroup } from '@commonpub/editor/vue';

/**
 * The email-safe block palette, shared by every contest email composer (the
 * per-contest template editor and the announcement composer).
 *
 * This list must stay a SUBSET of what the server's `renderEmailBlocks`
 * (packages/server/src/emailBlocks.ts) actually renders. A type offered here but
 * not handled there renders perfectly in the editor and is then silently DROPPED
 * from the delivered email, which is invisible until a recipient reports a
 * missing section. Extracted to one module precisely so a second composer cannot
 * drift from the first: change the renderer, change this, once.
 *
 * Currently rendered by the server: text/paragraph, heading, blockquote/quote,
 * callout, image, horizontal_rule/divider, registrationLink. Everything else
 * (video, quiz, slider, gallery, embed) is dropped by design, because email
 * clients cannot show it.
 */
export const emailBlockGroups: BlockTypeGroup[] = [
  {
    name: 'Text',
    blocks: [
      { type: 'paragraph', label: 'Text', icon: 'fa-align-left', description: 'Body text' },
      { type: 'heading', label: 'Heading', icon: 'fa-heading', description: 'Section heading' },
      { type: 'blockquote', label: 'Quote', icon: 'fa-quote-left', description: 'Quotation' },
    ],
  },
  {
    name: 'Blocks',
    blocks: [
      { type: 'callout', label: 'Callout', icon: 'fa-circle-info', description: 'Highlighted note', attrs: { variant: 'info' } },
      { type: 'image', label: 'Image', icon: 'fa-image', description: 'Upload or link an image' },
      { type: 'horizontal_rule', label: 'Divider', icon: 'fa-minus', description: 'Horizontal rule' },
      { type: 'registrationLink', label: 'Registration Link', icon: 'fa-user-plus', description: 'Button to this contest’s registration page' },
    ],
  },
];
