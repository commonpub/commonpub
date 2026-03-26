import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const deployDir = resolve(__dirname, '..');

describe('Deployment scripts', () => {
  it('droplet-setup.sh exists and has required sections', () => {
    const script = readFileSync(resolve(deployDir, 'droplet-setup.sh'), 'utf-8');
    expect(script).toContain('docker');
    expect(script).toContain('ufw');
  });

  it('nginx.conf has proxy_pass and SSL blocks', () => {
    const conf = readFileSync(resolve(deployDir, 'nginx.conf'), 'utf-8');
    expect(conf).toContain('proxy_pass');
    expect(conf).toContain('ssl_certificate');
    expect(conf).toContain('Upgrade');
    expect(conf).toContain('Strict-Transport-Security');
  });
});
