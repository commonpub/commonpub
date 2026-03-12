import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/vue';
import Toolbar from '../Toolbar.vue';

describe('Toolbar', () => {
  it('has role="toolbar"', () => {
    render(Toolbar, {
      slots: { default: '<button>Bold</button>' },
    });
    expect(screen.getByRole('toolbar')).toBeTruthy();
  });

  it('has aria-label="Toolbar"', () => {
    render(Toolbar, {
      slots: { default: '<button>Bold</button>' },
    });
    expect(screen.getByRole('toolbar').getAttribute('aria-label')).toBe('Toolbar');
  });

  it('renders children via slot', () => {
    render(Toolbar, {
      slots: { default: '<button>Bold</button><button>Italic</button>' },
    });
    expect(screen.getByText('Bold')).toBeTruthy();
    expect(screen.getByText('Italic')).toBeTruthy();
  });

  it('has cpub-toolbar base class', () => {
    render(Toolbar, {
      slots: { default: '<button>Action</button>' },
    });
    expect(screen.getByRole('toolbar').classList.contains('cpub-toolbar')).toBe(true);
  });
});
