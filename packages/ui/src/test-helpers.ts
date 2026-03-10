import { expect } from 'vitest';
import axe from 'axe-core';

export async function expectNoA11yViolations(container: HTMLElement): Promise<void> {
  const results = await axe.run(container);
  const violations = results.violations.map(
    (v) => `${v.id}: ${v.description} (${v.nodes.length} nodes)`
  );
  expect(violations).toEqual([]);
}
