import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getProductBySlug,
  listHubProducts,
  addContentProduct,
  removeContentProduct,
  listContentProducts,
  syncContentProducts,
} from '../product/product.js';
import { createHub } from '../hub/hub.js';

import { createContent } from '../content/content.js';

describe('product integration', () => {
  let db: DB;
  let userId: string;
  let hubId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db);
    userId = user.id;

    const hub = await createHub(db, userId, {
      name: 'Test Product Hub',
      description: 'Hub for product tests',
    });
    hubId = hub.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('creates a product', async () => {
    const product = await createProduct(db, userId, hubId, {
      name: 'Arduino Nano 33',
      description: 'A small dev board',
    });

    expect(product).toBeDefined();
    expect(product.id).toBeDefined();
    expect(product.name).toBe('Arduino Nano 33');
    expect(product.slug).toMatch(/^arduino-nano-33/);
  });

  it('gets product by slug', async () => {
    const created = await createProduct(db, userId, hubId, {
      name: 'ESP32-S3',
    });

    const found = await getProductBySlug(db, created.slug);
    expect(found).toBeDefined();
    expect(found!.name).toBe('ESP32-S3');
  });

  it('updates a product', async () => {
    const created = await createProduct(db, userId, hubId, {
      name: 'Old Name',
    });

    const updated = await updateProduct(db, created.id, userId, {
      name: 'New Name',
      description: 'Updated description',
    });

    expect(updated).toBeDefined();
    expect(updated!.name).toBe('New Name');
  });

  it('lists hub products', async () => {
    const result = await listHubProducts(db, hubId);

    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it('deletes a product', async () => {
    const created = await createProduct(db, userId, hubId, {
      name: 'To Delete',
    });

    const deleted = await deleteProduct(db, created.id, userId);
    expect(deleted).toBe(true);
  });

  it('links product to content and lists them', async () => {
    const product = await createProduct(db, userId, hubId, {
      name: 'Linked Board',
    });

    const content = await createContent(db, userId, {
      type: 'project',
      title: 'Product Test Project',
    });

    await addContentProduct(db, content.id, {
      productId: product.id,
      quantity: 2,
      notes: 'Main board',
    });

    const products = await listContentProducts(db, content.id, userId);
    expect(products.length).toBeGreaterThanOrEqual(1);
    const linked = products.find((p) => p.productId === product.id);
    expect(linked).toBeDefined();
    expect(linked!.quantity).toBe(2);
  });

  // The BOM is gated on the CONTENT's visibility. Before this, the join was by
  // contentId alone, so a draft or private project's parts list — names, slugs,
  // images, quantities, roles, notes — was readable by anyone holding the id.
  it('does not expose a draft project\'s BOM to an anonymous caller', async () => {
    const product = await createProduct(db, userId, hubId, { name: 'Secret Board' });
    const content = await createContent(db, userId, { type: 'project', title: 'Unpublished Project' });
    await addContentProduct(db, content.id, { productId: product.id, quantity: 1 });

    // The author still sees it.
    expect((await listContentProducts(db, content.id, userId)).length).toBeGreaterThanOrEqual(1);

    // Anonymous, and a different signed-in user, do not.
    expect(await listContentProducts(db, content.id)).toEqual([]);
    expect(await listContentProducts(db, content.id, '00000000-0000-4000-8000-000000000000')).toEqual([]);
  });

  it('removes product from content', async () => {
    const product = await createProduct(db, userId, hubId, {
      name: 'Removable Board',
    });

    const content = await createContent(db, userId, {
      type: 'project',
      title: 'Removal Test Project',
    });

    await addContentProduct(db, content.id, { productId: product.id });
    await removeContentProduct(db, content.id, product.id);

    const products = await listContentProducts(db, content.id, userId);
    const found = products.find((p) => p.productId === product.id);
    expect(found).toBeUndefined();
  });

  it('syncs content products (bulk replace)', async () => {
    const p1 = await createProduct(db, userId, hubId, { name: 'Sync Board 1' });
    const p2 = await createProduct(db, userId, hubId, { name: 'Sync Board 2' });

    const content = await createContent(db, userId, {
      type: 'project',
      title: 'Sync Test Project',
    });

    // First sync — add both
    await syncContentProducts(db, content.id, [
      { productId: p1.id, quantity: 1 },
      { productId: p2.id, quantity: 3 },
    ]);

    let products = await listContentProducts(db, content.id, userId);
    expect(products.length).toBe(2);

    // Second sync — only keep p2
    await syncContentProducts(db, content.id, [
      { productId: p2.id, quantity: 5 },
    ]);

    products = await listContentProducts(db, content.id, userId);
    expect(products.length).toBe(1);
    expect(products[0]!.productId).toBe(p2.id);
  });
});
