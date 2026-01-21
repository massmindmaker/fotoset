/**
 * Packs API Tests - Verify pack listing and detail endpoints
 * Tests the Dynamic Packs System functionality
 */

import { test, expect } from '@playwright/test';

test.describe('Packs API', () => {
  test('GET /api/packs - returns list of active packs', async ({ request }) => {
    const response = await request.get('/api/packs');

    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('packs');
    expect(Array.isArray(data.packs)).toBe(true);

    // Verify pack structure if packs exist
    if (data.packs.length > 0) {
      const pack = data.packs[0];
      expect(pack).toHaveProperty('id');
      expect(pack).toHaveProperty('slug');
      expect(pack).toHaveProperty('name');
      expect(pack).toHaveProperty('promptCount');
    }
  });

  test('GET /api/packs/[slug] - returns pack details', async ({ request }) => {
    // First get list of packs
    const listResponse = await request.get('/api/packs');
    const listData = await listResponse.json();

    // Skip if no packs available
    if (!listData.packs || listData.packs.length === 0) {
      test.skip();
      return;
    }

    const pack = listData.packs[0];

    // Fetch pack detail by slug
    const detailResponse = await request.get(`/api/packs/${pack.slug}`);

    expect(detailResponse.ok()).toBe(true);

    const detail = await detailResponse.json();

    // Verify PackDetail interface structure
    expect(detail).toHaveProperty('id', pack.id);
    expect(detail).toHaveProperty('slug', pack.slug);
    expect(detail).toHaveProperty('name', pack.name);
    expect(detail).toHaveProperty('itemsCount');
    expect(typeof detail.itemsCount).toBe('number');
    expect(detail).toHaveProperty('previewImages');
    expect(Array.isArray(detail.previewImages)).toBe(true);

    // Optional fields should be present (even if null)
    expect(detail).toHaveProperty('description');
    expect(detail).toHaveProperty('emoji');
    expect(detail).toHaveProperty('coverUrl');
    expect(detail).toHaveProperty('isActive', true);
  });

  test('GET /api/packs/[slug] - returns 404 for non-existent pack', async ({ request }) => {
    const response = await request.get('/api/packs/non-existent-pack-slug-12345');

    expect(response.status()).toBe(404);
  });
});
