import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workflowsDir = resolve(__dirname, '../../.github/workflows');

describe('CI/CD workflows', () => {
  it('ci.yml has build step', () => {
    const content = readFileSync(resolve(workflowsDir, 'ci.yml'), 'utf-8');
    expect(content).toContain('pnpm build');
    expect(content).toContain('name: Build');
  });

  it('docker.yml exists with correct triggers', () => {
    const content = readFileSync(resolve(workflowsDir, 'docker.yml'), 'utf-8');
    expect(content).toContain('push:');
    expect(content).toContain('branches: [main]');
    expect(content).toContain("tags: ['v*']");
    expect(content).toContain('ghcr.io');
  });

  it('deploy.yml exists with push trigger', () => {
    const content = readFileSync(resolve(workflowsDir, 'deploy.yml'), 'utf-8');
    expect(content).toContain('push:');
    expect(content).toContain('branches: [main]');
  });
});
