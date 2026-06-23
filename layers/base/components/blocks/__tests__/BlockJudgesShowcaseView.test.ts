import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/vue';
import BlockJudgesShowcaseView from '../BlockJudgesShowcaseView.vue';

describe('BlockJudgesShowcaseView', () => {
  it('renders heading + judge cards (name, title, bio, avatar, link)', () => {
    const content = {
      heading: 'Meet the Judges',
      judges: [
        { name: 'Ada Lovelace', title: 'Lead Judge', bio: 'Pioneer.', avatarUrl: 'https://x/ada.png', link: 'https://ada.example' },
        { name: 'Bob' },
      ],
    };
    const { getByText, container } = render(BlockJudgesShowcaseView, { props: { content } });
    expect(getByText('Meet the Judges')).toBeTruthy();
    expect(getByText('Ada Lovelace')).toBeTruthy();
    expect(getByText('Lead Judge')).toBeTruthy();
    expect(getByText('Pioneer.')).toBeTruthy();
    expect(getByText('Bob')).toBeTruthy();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://x/ada.png');
    expect(container.querySelector('a.cpub-jshow-name')?.getAttribute('href')).toBe('https://ada.example');
  });

  it('renders nothing when there are no named judges', () => {
    const { container } = render(BlockJudgesShowcaseView, { props: { content: { judges: [] } } });
    expect(container.querySelector('.cpub-jshow')).toBeNull();
  });

  it('does not render a javascript: link as an anchor (only http(s))', () => {
    const { container, getByText } = render(BlockJudgesShowcaseView, {
      props: { content: { judges: [{ name: 'Eve', link: 'javascript:alert(1)' }] } },
    });
    expect(getByText('Eve').tagName.toLowerCase()).toBe('span');
    expect(container.querySelector('a.cpub-jshow-name')).toBeNull();
  });
});
