import { test, expect } from '@playwright/test';

test.describe('Health Check', () => {
  test('API health endpoint returns ok', async ({ request }) => {
    const response = await request.get('http://localhost:8011/api/health/');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('ok');
  });
});
