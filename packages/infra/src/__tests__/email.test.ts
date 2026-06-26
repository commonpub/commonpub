import { describe, it, expect, vi } from 'vitest';
import { ConsoleEmailAdapter, ResendEmailAdapter, emailTemplates } from '../email.js';

describe('ConsoleEmailAdapter', () => {
  it('logs email to console', async () => {
    const adapter = new ConsoleEmailAdapter();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await adapter.send({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('test@example.com'));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Test'));
    spy.mockRestore();
  });

  it('falls back to HTML snippet when no text', async () => {
    const adapter = new ConsoleEmailAdapter();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await adapter.send({
      to: 'a@b.com',
      subject: 'Sub',
      html: '<p>HTML content here</p>',
    });

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('HTML content'));
    spy.mockRestore();
  });
});

describe('ResendEmailAdapter', () => {
  it('sends email via Resend API', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"id":"re_123"}'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new ResendEmailAdapter({
      apiKey: 're_test_key',
      from: 'noreply@example.com',
    });

    await adapter.send({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(mockFetch).toHaveBeenCalledWith('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer re_test_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'noreply@example.com',
        to: ['user@example.com'],
        subject: 'Test',
        html: '<p>Hello</p>',
        text: 'Hello',
      }),
      // A request timeout was added (EMAIL_HTTP_TIMEOUT_MS) so a hung call can't
      // outlive the outbox worker's row lock.
      signal: expect.any(AbortSignal),
    });

    vi.unstubAllGlobals();
  });

  it('throws on API error with status and body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve('{"message":"Invalid email"}'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new ResendEmailAdapter({
      apiKey: 're_test_key',
      from: 'noreply@example.com',
    });

    await expect(
      adapter.send({ to: 'bad', subject: 'Test', html: '<p>Hi</p>' }),
    ).rejects.toThrow('Resend API error (422)');

    vi.unstubAllGlobals();
  });

  it('sends to array with single recipient', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{}'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new ResendEmailAdapter({
      apiKey: 'key',
      from: 'from@test.com',
    });
    await adapter.send({ to: 'a@b.com', subject: 'S', html: '<p>X</p>' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.to).toEqual(['a@b.com']);

    vi.unstubAllGlobals();
  });

  it('propagates network errors from fetch', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('fetch failed'));
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new ResendEmailAdapter({
      apiKey: 're_test_key',
      from: 'noreply@example.com',
    });

    await expect(
      adapter.send({ to: 'user@example.com', subject: 'Test', html: '<p>Hi</p>' }),
    ).rejects.toThrow('fetch failed');

    vi.unstubAllGlobals();
  });

  it('sendBatch attributes per-message results from the batch response (partial success)', async () => {
    // Resend returns 200 with one data entry per ACCEPTED message, in order. A
    // missing/absent id means that message was rejected and must be retried.
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
      json: () => Promise.resolve({ data: [{ id: 'a' }, {}, { id: 'c' }] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new ResendEmailAdapter({ apiKey: 'k', from: 'f@t.com' });
    const results = await adapter.sendBatch([
      { to: '1@t.com', subject: 's', html: '<p>1</p>' },
      { to: '2@t.com', subject: 's', html: '<p>2</p>' },
      { to: '3@t.com', subject: 's', html: '<p>3</p>' },
    ]);

    expect(results.map((r) => r.ok)).toEqual([true, false, true]);
    expect(mockFetch).toHaveBeenCalledWith('https://api.resend.com/emails/batch', expect.objectContaining({ method: 'POST' }));
    vi.unstubAllGlobals();
  });

  it('sendBatch throws on a transport-level (non-2xx) failure', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('boom'),
    });
    vi.stubGlobal('fetch', mockFetch);
    const adapter = new ResendEmailAdapter({ apiKey: 'k', from: 'f@t.com' });
    await expect(adapter.sendBatch([{ to: '1@t.com', subject: 's', html: '<p>1</p>' }])).rejects.toThrow(/Resend batch API error \(500\)/);
    vi.unstubAllGlobals();
  });

  it('ConsoleEmailAdapter.sendBatch returns ok for every message', async () => {
    const adapter = new ConsoleEmailAdapter();
    const results = await adapter.sendBatch([
      { to: 'a@t.com', subject: 's', html: 'h' },
      { to: 'b@t.com', subject: 's', html: 'h' },
    ]);
    expect(results).toEqual([{ ok: true }, { ok: true }]);
  });
});

describe('email branding (Phase 2)', () => {
  it('applies the accent color (header + button) and custom header text', () => {
    const t = emailTemplates.verification('Site', 'https://x/y', { accentColor: '#aa0000', headerText: 'Brandy' });
    expect(t.html).toContain('#aa0000'); // header border + button use the accent
    expect(t.html).toContain('Brandy');
    expect(t.html).not.toContain('#5b9cf6'); // default accent fully replaced
  });

  it('renders a logo image when logoUrl is set', () => {
    const t = emailTemplates.verification('Site', 'https://x/y', { logoUrl: 'https://cdn.example.com/logo.png' });
    expect(t.html).toContain('<img src="https://cdn.example.com/logo.png"');
  });

  it('escapes header/footer text and ignores a non-hex accent (injection safety)', () => {
    const t = emailTemplates.notificationDigest(
      'Site',
      'u',
      [{ text: 'a', url: '#' }],
      undefined,
      { headerText: '<script>x</script>', footerText: '<b>f</b>', accentColor: 'red;}body{x' },
    );
    expect(t.html).not.toContain('<script>x</script>');
    expect(t.html).toContain('&lt;script&gt;');
    expect(t.html).not.toContain('red;}body{x'); // non-hex accent rejected at render
    expect(t.html).toContain('#5b9cf6'); // fell back to the default accent
  });

  it('falls back to defaults when no branding is given', () => {
    const t = emailTemplates.verification('Site', 'https://x/y');
    expect(t.html).toContain('#5b9cf6');
    expect(t.html).toContain('Site');
  });
});

describe('emailTemplates.verification', () => {
  it('returns a verification email with correct structure', () => {
    const result = emailTemplates.verification('TestSite', 'https://example.com/verify?token=abc');
    expect(result.to).toBe('');
    expect(result.subject).toContain('Verify your email');
    expect(result.subject).toContain('TestSite');
    expect(result.html).toContain('Verify your email');
    expect(result.html).toContain('https://example.com/verify?token=abc');
    expect(result.text).toContain('https://example.com/verify?token=abc');
  });

  it('escapes HTML in siteName', () => {
    const result = emailTemplates.verification('<script>alert(1)</script>', 'https://example.com');
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
  });

  it('escapes all 5 HTML entities correctly', () => {
    const result = emailTemplates.verification('A&B<C>D"E\'F', 'https://example.com');
    expect(result.html).toContain('A&amp;B');
    expect(result.html).toContain('&lt;C&gt;');
    expect(result.html).toContain('D&quot;E');
    expect(result.html).toContain('E&#x27;F');
  });
});

describe('emailTemplates.passwordReset', () => {
  it('returns a password reset email', () => {
    const result = emailTemplates.passwordReset('TestSite', 'https://example.com/reset?token=xyz');
    expect(result.subject).toContain('Reset your password');
    expect(result.html).toContain('Reset your password');
    expect(result.html).toContain('1 hour');
    expect(result.text).toContain('https://example.com/reset?token=xyz');
  });
});

describe('emailTemplates.notificationDigest', () => {
  it('returns digest with notification list', () => {
    const result = emailTemplates.notificationDigest('TestSite', 'alice', [
      { text: 'Bob liked your post', url: 'https://example.com/post/1' },
      { text: 'Carol followed you', url: 'https://example.com/profile/carol' },
    ]);
    expect(result.subject).toContain('2 new notifications');
    expect(result.html).toContain('alice');
    expect(result.html).toContain('Bob liked your post');
    expect(result.html).toContain('Carol followed you');
    expect(result.text).toContain('Bob liked your post');
  });

  it('uses singular for single notification', () => {
    const result = emailTemplates.notificationDigest('TestSite', 'alice', [
      { text: 'New comment', url: 'https://example.com/1' },
    ]);
    expect(result.subject).toContain('1 new notification --');
    expect(result.subject).not.toContain('notifications');
  });

  it('escapes HTML in notification text', () => {
    const result = emailTemplates.notificationDigest('TestSite', 'alice', [
      { text: '<img onerror=alert(1)>', url: 'https://example.com' },
    ]);
    expect(result.html).not.toContain('<img onerror');
    expect(result.html).toContain('&lt;img');
  });

  it('formats text version with newlines between items', () => {
    const result = emailTemplates.notificationDigest('TestSite', 'alice', [
      { text: 'First', url: 'https://a.com' },
      { text: 'Second', url: 'https://b.com' },
    ]);
    expect(result.text).toContain('- First: https://a.com\n- Second: https://b.com');
  });
});

describe('emailTemplates.contestAnnouncement', () => {
  it('returns a contest announcement email', () => {
    const result = emailTemplates.contestAnnouncement(
      'TestSite',
      'Build Challenge 2026',
      'https://example.com/contest/1',
      'Join our latest build challenge!',
    );
    expect(result.subject).toContain('Build Challenge 2026');
    expect(result.html).toContain('Build Challenge 2026');
    expect(result.html).toContain('Join our latest build challenge!');
    expect(result.text).toContain('https://example.com/contest/1');
  });
});

describe('emailTemplates.certificateIssued', () => {
  it('returns a certificate email', () => {
    const result = emailTemplates.certificateIssued(
      'TestSite',
      'Electronics 101',
      'CERT-ABC-123',
      'https://example.com/cert/abc',
    );
    expect(result.subject).toContain('Certificate earned');
    expect(result.subject).toContain('Electronics 101');
    expect(result.html).toContain('Congratulations');
    expect(result.html).toContain('CERT-ABC-123');
    expect(result.html).toContain('Electronics 101');
    expect(result.text).toContain('CERT-ABC-123');
  });

  it('escapes HTML in all fields', () => {
    const result = emailTemplates.certificateIssued(
      '<script>x</script>',
      '<b>Path</b>',
      '<code>',
      'https://example.com',
    );
    expect(result.html).not.toContain('<script>x</script>');
    expect(result.html).not.toContain('<b>Path</b>');
    expect(result.html).toContain('&lt;b&gt;Path&lt;/b&gt;');
  });
});
