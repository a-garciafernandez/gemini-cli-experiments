import { test, expect } from '@playwright/test';

test('login with credentials', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Celonis/);

  // Login
  await page.getByLabel('Email').fill(process.env.EMAIL!);
  await page.getByLabel('Password').fill(process.env.PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for the main content to load
  await page.locator('main').waitFor();

  // Add an assertion to verify successful login, for example, by checking for a specific element on the dashboard
  await expect(page.locator('main')).toBeVisible();
});
