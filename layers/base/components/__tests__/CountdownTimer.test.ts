import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { createSSRApp, h } from 'vue';
import { render, screen, waitFor } from '@testing-library/vue';
import CountdownTimer from '../CountdownTimer.vue';

/**
 * The countdown must never claim a deadline has passed just because the server
 * cannot know the time yet.
 *
 * This is the third of the three "0s on the contest tile" defects from session
 * 253, and the only one that had no test. `contestCounts.test.ts` asserted it
 * was "covered by its own test"; no test in the monorepo rendered this
 * component at all, so the docblock was the entire guard.
 *
 * The bug: the timer computed `target - Date.now()` during SSR, where the
 * elapsed diff is whatever the server clock says at render time, and clamped a
 * non-positive result to zeroes. Every contest tile server-rendered
 * "00h 00m left" for a contest that was open, and that is the markup crawlers
 * indexed and the first thing a visitor saw before hydration.
 *
 * The fix renders nothing live until mounted and keeps a machine-readable
 * `<time datetime>` in the SSR output, so the deadline is still in the markup
 * for a crawler without a number that is wrong.
 */
const FUTURE = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

/**
 * Render exactly what a crawler and a first paint receive: the SSR string.
 *
 * Props are typed to the component rather than `Record<string, unknown>`:
 * vitest transpiles with esbuild and would accept the loose type, while the CI
 * `vue-tsc` typecheck rejects it, so the looser version passes locally and
 * fails on the PR.
 */
async function ssr(props: { targetDate: string; compact?: boolean }): Promise<string> {
  const app = createSSRApp({ render: () => h(CountdownTimer, props) });
  return renderToString(app);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('CountdownTimer server-rendered output', () => {
  for (const compact of [false, true]) {
    const label = compact ? 'compact' : 'full';

    it(`(${label}) never server-renders a zeroed countdown for an open deadline`, async () => {
      const html = await ssr({ targetDate: FUTURE, compact });
      // The exact string the live contest tiles shipped.
      expect(html, 'a zeroed countdown must never reach the markup').not.toMatch(/00h\s*00m/);
      // Any all-zero unit rendering is the same defect in the other layout.
      expect(html).not.toMatch(/>00</);
    });

    it(`(${label}) still puts the real deadline in the markup for crawlers`, async () => {
      // Rendering nothing would also pass the assertion above while losing the
      // machine-readable deadline, so this pins the other half of the fix.
      const html = await ssr({ targetDate: FUTURE, compact });
      expect(html).toContain(`datetime="${FUTURE}"`);
      expect(html).toMatch(/<time/);
    });
  }
});

describe('CountdownTimer after hydration', () => {
  it('shows the real remaining time once mounted', async () => {
    render(CountdownTimer, { props: { targetDate: FUTURE, compact: true } });
    await waitFor(() => {
      expect(screen.getByText(/left/i)).toBeTruthy();
    });
    // Three days out, so it must report days rather than a zeroed clock.
    const el = screen.getByText(/\d+d/);
    expect(el.textContent).toMatch(/[123]d/);
  });

  it('does show zeroes once the deadline has genuinely passed', async () => {
    // The guard must not suppress a legitimately finished countdown, or an
    // ended contest would render blank forever.
    const past = new Date(Date.now() - 60_000).toISOString();
    const { container } = render(CountdownTimer, { props: { targetDate: past, compact: true } });
    await waitFor(() => {
      expect(container.textContent).toMatch(/00h\s*00m/);
    });
  });
});
