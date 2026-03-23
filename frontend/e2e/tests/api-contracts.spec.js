import { test, expect } from '@playwright/test';

test.describe('API Contracts', () => {
  test('health endpoint returns standard shape', async ({ request }) => {
    const resp = await request.get('http://localhost:8011/api/health/');
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body).toHaveProperty('status', 'ok');
  });

  test('protected endpoint returns 401 without auth', async ({ request }) => {
    const resp = await request.get('http://localhost:8011/api/notes/');
    expect(resp.status()).toBe(401);
  });

  test('stats endpoint returns expected shape', async ({ request }) => {
    // Register and login to get auth cookie
    const uniqueUser = `apitest_${Date.now()}`;
    await request.post('http://localhost:8011/api/auth/register/', {
      data: {
        username: uniqueUser,
        email: `${uniqueUser}@example.com`,
        first_name: 'API',
        last_name: 'Test',
        password: 'StrongPass123!',
        password_confirm: 'StrongPass123!',
      },
    });

    const loginResp = await request.post('http://localhost:8011/api/auth/login/', {
      data: { username: uniqueUser, password: 'StrongPass123!' },
    });
    expect(loginResp.ok()).toBeTruthy();

    const statsResp = await request.get('http://localhost:8011/api/stats/');
    expect(statsResp.ok()).toBeTruthy();
    const stats = await statsResp.json();
    expect(stats).toHaveProperty('success', true);
    expect(stats.data).toHaveProperty('total_notes');
    expect(stats.data).toHaveProperty('storage_used_mb');
  });

  test('notes list returns paginated response', async ({ request }) => {
    const uniqueUser = `pagtest_${Date.now()}`;
    await request.post('http://localhost:8011/api/auth/register/', {
      data: {
        username: uniqueUser,
        email: `${uniqueUser}@example.com`,
        first_name: 'Pag',
        last_name: 'Test',
        password: 'StrongPass123!',
        password_confirm: 'StrongPass123!',
      },
    });
    await request.post('http://localhost:8011/api/auth/login/', {
      data: { username: uniqueUser, password: 'StrongPass123!' },
    });

    const resp = await request.get('http://localhost:8011/api/notes/');
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body).toHaveProperty('count');
    expect(body).toHaveProperty('results');
    expect(Array.isArray(body.results)).toBeTruthy();
  });
});
