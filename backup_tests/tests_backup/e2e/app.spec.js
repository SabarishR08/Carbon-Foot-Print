import { test, expect } from '@playwright/test';

test.describe('EcoTrack E2E', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('EcoTrack')).toBeVisible();
    await expect(page.getByText('Continue with Google')).toBeVisible();
  });

  test('login page has accessible form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('health endpoint responds', async ({ request }) => {
    const apiUrl = process.env.API_URL || 'http://localhost:8080';
    const res = await request.get(`${apiUrl}/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('healthy');
  });
});
