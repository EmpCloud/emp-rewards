import { test, Page } from '@playwright/test';

const BASE = 'http://localhost:5180';

async function login(page: Page) {
  await page.goto(BASE + '/login');
  await page.waitForLoadState('networkidle');

  // Clear and fill credentials
  const emailInput = page.locator('input[type="email"], #email');
  const passwordInput = page.locator('input[type="password"], #password');
  await emailInput.fill('ananya@technova.in');
  await passwordInput.fill('Welcome@123');

  // Click submit
  await page.click('button[type="submit"]');

  // Wait for the API response and navigation - use selector-based wait
  // The dashboard should render after successful login
  await page.waitForSelector('button[type="submit"]', { state: 'hidden', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // If we're still on login, try direct navigation with localStorage
  const url = page.url();
  if (url.includes('/login')) {
    // The login might have succeeded but navigation is slow - inject auth manually
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ananya@technova.in', password: 'Welcome@123' })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('access_token', data.data.tokens.accessToken);
        localStorage.setItem('refresh_token', data.data.tokens.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.data.user));
      }
      return data.success;
    });
    if (response) {
      await page.goto(BASE + '/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }
  }
}

test.describe('EMP Rewards Feature Screenshots', () => {
  test('01 - Dashboard', async ({ page }) => {
    await login(page);
    await page.goto(BASE + '/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/rewards-01-dashboard.png', fullPage: true });
  });

  test('02 - Social Feed / Kudos Wall', async ({ page }) => {
    await login(page);
    await page.goto(BASE + '/feed');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/rewards-02-feed.png', fullPage: true });
  });

  test('03 - Leaderboard', async ({ page }) => {
    await login(page);
    await page.goto(BASE + '/leaderboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/rewards-03-leaderboard.png', fullPage: true });
  });

  test('04 - Badges', async ({ page }) => {
    await login(page);
    await page.goto(BASE + '/badges');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/rewards-04-badges.png', fullPage: true });
  });

  test('05 - Reward Catalog', async ({ page }) => {
    await login(page);
    await page.goto(BASE + '/rewards');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/rewards-05-catalog.png', fullPage: true });
  });

  test('06 - Analytics', async ({ page }) => {
    await login(page);
    await page.goto(BASE + '/analytics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/rewards-06-analytics.png', fullPage: true });
  });

  test('07 - Settings', async ({ page }) => {
    await login(page);
    await page.goto(BASE + '/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/rewards-07-settings.png', fullPage: true });
  });
});
