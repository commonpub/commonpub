import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import axe from 'axe-core';
import BlockHtmlView from '../BlockHtmlView.vue';

describe('BlockHtmlView', () => {
  it('renders allowed HTML into a .cpub-md-html container', () => {
    const { container } = render(BlockHtmlView, { props: { content: { html: '<p>Hello <strong>world</strong></p>' } } });
    expect(container.querySelector('.cpub-md-html')).toBeTruthy();
    expect(container.querySelector('strong')?.textContent).toBe('world');
  });

  it('strips <script> tags and their payload', () => {
    const evil = '<p>ok</p><script>alert(1)</scr' + 'ipt>';
    const { container } = render(BlockHtmlView, { props: { content: { html: evil } } });
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).not.toContain('alert(1)');
    expect(container.textContent).toContain('ok');
  });

  it('strips inline event handlers', () => {
    const { container } = render(BlockHtmlView, { props: { content: { html: '<a href="#" onclick="steal()">x</a>' } } });
    expect(container.innerHTML).not.toContain('onclick');
    expect(container.innerHTML).not.toContain('steal()');
  });

  it('neutralizes hardcoded inline colors (dark-safe)', () => {
    const { container } = render(BlockHtmlView, { props: { content: { html: '<p style="color:#ff0000">red</p>' } } });
    expect((container.querySelector('p')?.getAttribute('style') ?? '')).not.toContain('ff0000');
  });

  it('renders nothing for empty / non-string content', () => {
    const { container } = render(BlockHtmlView, { props: { content: {} } });
    expect(container.querySelector('.cpub-md-html')).toBeNull();
  });

  it('passes an axe scan', async () => {
    const { container } = render(BlockHtmlView, { props: { content: { html: '<p>Accessible content</p>' } } });
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
