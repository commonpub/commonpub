import { test, expect } from '@playwright/test';

/**
 * API tests — verify public endpoints respond correctly.
 * Uses Playwright's request context (no browser needed).
 *
 * Feature-gated endpoints (contests, learning, etc.) accept either 200 or 404
 * since they may be disabled in CI configuration.
 */

test.describe('Health endpoint', () => {
  test('GET /api/health returns 200', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status');
  });
});

test.describe('Stats endpoint', () => {
  test('GET /api/stats returns counts', async ({ request }) => {
    const response = await request.get('/api/stats');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('users');
    expect(body).toHaveProperty('content');
    expect(typeof body.users.total).toBe('number');
    expect(typeof body.content.total).toBe('number');
  });
});

test.describe('Content listing', () => {
  test('GET /api/content returns paginated items', async ({ request }) => {
    const response = await request.get('/api/content?limit=5');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);
  });

  test('GET /api/content filters by type', async ({ request }) => {
    const response = await request.get('/api/content?type=project&limit=5');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);
    for (const item of body.items) {
      expect(item.type).toBe('project');
    }
  });
});

test.describe('Hubs listing', () => {
  test('GET /api/hubs returns paginated items', async ({ request }) => {
    const response = await request.get('/api/hubs?limit=5');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);
  });
});

test.describe('Search endpoint', () => {
  test('GET /api/search returns results structure', async ({ request }) => {
    const response = await request.get('/api/search?q=test&limit=5');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);
  });
});

test.describe('Feature-gated endpoints', () => {
  test('GET /api/contests returns 200 or 404 (feature-gated)', async ({ request }) => {
    const response = await request.get('/api/contests?limit=5');
    expect([200, 404]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty('items');
      expect(Array.isArray(body.items)).toBe(true);
    }
  });

  test('GET /api/learn returns 200 or 404 (feature-gated)', async ({ request }) => {
    const response = await request.get('/api/learn?limit=5');
    expect([200, 404]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty('items');
      expect(Array.isArray(body.items)).toBe(true);
    }
  });

  test('GET /api/videos returns 200 or 404 (feature-gated)', async ({ request }) => {
    const response = await request.get('/api/videos?limit=5');
    expect([200, 404]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty('items');
      expect(Array.isArray(body.items)).toBe(true);
    }
  });

  test('GET /api/videos/categories returns 200 or 404 (feature-gated)', async ({ request }) => {
    const response = await request.get('/api/videos/categories');
    expect([200, 404]).toContain(response.status());
  });

  test('GET /api/docs returns 200 or 404 (feature-gated)', async ({ request }) => {
    const response = await request.get('/api/docs');
    expect([200, 404]).toContain(response.status());
  });
});

test.describe('Protected endpoints require auth', () => {
  test('GET /api/profile returns 401 without auth', async ({ request }) => {
    const response = await request.get('/api/profile');
    expect(response.status()).toBe(401);
  });

  test('PUT /api/profile returns 401 without auth', async ({ request }) => {
    const response = await request.put('/api/profile', {
      data: { bio: 'test' },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/content returns 401 without auth', async ({ request }) => {
    const response = await request.post('/api/content', {
      data: { title: 'Test', type: 'article' },
    });
    expect(response.status()).toBe(401);
  });

  test('GET /api/notifications/count returns 401 without auth', async ({ request }) => {
    const response = await request.get('/api/notifications/count');
    expect(response.status()).toBe(401);
  });
});

test.describe('Products listing', () => {
  test('GET /api/products returns items', async ({ request }) => {
    const response = await request.get('/api/products?limit=5');
    expect(response.status()).toBe(200);

    const body = await response.json();
    if (body.items) {
      expect(Array.isArray(body.items)).toBe(true);
    } else {
      expect(Array.isArray(body)).toBe(true);
    }
  });
});

test.describe('Certificate verification', () => {
  test('GET /api/cert/invalid-code returns 404', async ({ request }) => {
    const response = await request.get('/api/cert/invalid-code-123');
    expect(response.status()).toBe(404);
  });
});

test.describe('User learning data', () => {
  test('GET /api/users/nonexistent/learning returns 404', async ({ request }) => {
    const response = await request.get('/api/users/nonexistent-user-xyz/learning');
    expect(response.status()).toBe(404);
  });
});

test.describe('New protected endpoints require auth', () => {
  test('PUT /api/learn/test/lessons/test returns 401', async ({ request }) => {
    const response = await request.put('/api/learn/test/lessons/test', {
      data: { title: 'Test' },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/docs/test/pages/reorder returns 401', async ({ request }) => {
    const response = await request.post('/api/docs/test/pages/reorder', {
      data: { pageIds: [] },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe('Federation endpoints', () => {
  test('GET /.well-known/webfinger returns 400 without resource param', async ({ request }) => {
    const response = await request.get('/.well-known/webfinger');
    expect([400, 404, 422]).toContain(response.status());
  });

  test('GET /.well-known/nodeinfo returns nodeinfo links', async ({ request }) => {
    const response = await request.get('/.well-known/nodeinfo');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('links');
    expect(Array.isArray(body.links)).toBe(true);
  });
});
