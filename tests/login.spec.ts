import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test('login with credentials', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.expectPageTitle();
  await loginPage.login(process.env.EMAIL!, process.env.PASSWORD!);
  await loginPage.expectToBeLoggedIn();
});