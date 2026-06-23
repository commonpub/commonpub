import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import HtmlBlock from '../HtmlBlock.vue';

describe('HtmlBlock', () => {
  it('shows the current html in the textarea', () => {
    const { container } = render(HtmlBlock, { props: { content: { html: '<p>hi</p>' } } });
    expect((container.querySelector('textarea') as HTMLTextAreaElement).value).toBe('<p>hi</p>');
  });

  it('emits update with the new html on input', async () => {
    const { container, emitted } = render(HtmlBlock, { props: { content: { html: '' } } });
    await fireEvent.update(container.querySelector('textarea')!, '<p>new</p>');
    expect(emitted().update?.[0]).toEqual([{ html: '<p>new</p>' }]);
  });

  it('renders a sanitized live preview (scripts stripped)', () => {
    const evil = '<p>safe</p><script>bad()</scr' + 'ipt>';
    const { container } = render(HtmlBlock, { props: { content: { html: evil } } });
    const preview = container.querySelector('.cpub-md-html');
    expect(preview).toBeTruthy();
    expect(preview?.querySelector('script')).toBeNull();
    expect(preview?.textContent).not.toContain('bad()');
  });

  it('passes an axe scan', async () => {
    const { container } = render(HtmlBlock, { props: { content: { html: '<p>x</p>' } } });
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
