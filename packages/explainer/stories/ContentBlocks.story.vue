<script setup lang="ts">
import TextBlock from '../vue/components/blocks/TextBlock.vue';
import HeadingBlock from '../vue/components/blocks/HeadingBlock.vue';
import CodeBlock from '../vue/components/blocks/CodeBlock.vue';
import ImageBlock from '../vue/components/blocks/ImageBlock.vue';
import CalloutBlock from '../vue/components/blocks/CalloutBlock.vue';
import QuoteBlock from '../vue/components/blocks/QuoteBlock.vue';
import DividerBlock from '../vue/components/blocks/DividerBlock.vue';
import SectionHeader from '../vue/components/blocks/SectionHeader.vue';
</script>

<template>
  <Story title="Blocks/Content" group="blocks">
    <Variant title="Text Block">
      <TextBlock :content="{ html: '<p>This is a paragraph with <strong>bold</strong>, <em>italic</em>, and <code>inline code</code>. It also supports <a href=\'#\'>links</a>.</p><p>Multiple paragraphs are spaced naturally.</p>' }" />
    </Variant>

    <Variant title="Headings">
      <div style="display: flex; flex-direction: column;">
        <HeadingBlock :content="{ level: 1, text: 'Heading Level 1' }" />
        <HeadingBlock :content="{ level: 2, text: 'Heading Level 2' }" />
        <HeadingBlock :content="{ level: 3, text: 'Heading Level 3' }" />
        <HeadingBlock :content="{ level: 4, text: 'Heading Level 4' }" />
      </div>
    </Variant>

    <Variant title="Code Block">
      <CodeBlock :content="{ language: 'typescript', filename: 'example.ts', code: 'function fibonacci(n: number): number {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nconsole.log(fibonacci(10)); // 55' }" />
    </Variant>

    <Variant title="Image">
      <ImageBlock :content="{ src: 'https://picsum.photos/800/400', alt: 'Sample image', caption: 'A random sample image from picsum.photos' }" />
    </Variant>

    <Variant title="Callout Variants">
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <CalloutBlock :content="{ variant: 'info', html: '<p>This is an informational note.</p>' }" />
        <CalloutBlock :content="{ variant: 'tip', html: '<p>This is a helpful tip!</p>' }" />
        <CalloutBlock :content="{ variant: 'warning', html: '<p>Be careful with this approach.</p>' }" />
        <CalloutBlock :content="{ variant: 'danger', html: '<p>This will break your production database.</p>' }" />
      </div>
    </Variant>

    <Variant title="Quote">
      <QuoteBlock :content="{ html: '<p>The best way to predict the future is to invent it.</p>', attribution: 'Alan Kay' }" />
    </Variant>

    <Variant title="Divider">
      <div>
        <p style="color: var(--text-dim);">Content above divider.</p>
        <DividerBlock :content="{}" />
        <p style="color: var(--text-dim);">Content below divider.</p>
      </div>
    </Variant>

    <Variant title="Section Header">
      <SectionHeader :content="{ tag: '§ 01', title: 'Understanding Transformers', body: 'In this section, we explore the architecture behind modern language models.' }" />
    </Variant>
  </Story>
</template>
