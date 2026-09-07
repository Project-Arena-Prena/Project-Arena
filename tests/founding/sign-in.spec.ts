import { expect, test } from '@playwright/test';

test('sign-in dialog traps focus, closes with Escape and restores the trigger', async ({ page }, testInfo) => {
  await page.goto('/about');
  const trigger = page.locator('header').getByRole('link', { name: 'Sign in', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Step inside.' })).toBeVisible();
  await expect(dialog.getByLabel('Email', { exact: true })).toBeFocused();
  await expect.poll(() => dialog.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await testInfo.attach('sign-in-desktop', { body: await page.screenshot(), contentType: 'image/png' });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await trigger.click();
  await page.mouse.click(2, 2);
  await expect(dialog).toHaveCount(0);
});

test('mobile sign-in remains usable with reduced motion and a short viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/about');
  await page.locator('header').getByRole('link', { name: 'Sign in', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCSS('animation-name', 'none');
  await dialog.getByLabel('Email', { exact: true }).fill('builder@example.com');
  // This suite has no Supabase credentials: verify an actionable failure without sending email.
  await dialog.getByRole('button', { name: 'Send sign-in code' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Sign-in is temporarily unavailable. Please try again later.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await testInfo.attach('sign-in-mobile', { body: await page.screenshot(), contentType: 'image/png' });
  await dialog.getByRole('button', { name: 'Close sign in' }).click();
  await expect(dialog).toHaveCount(0);
});

test('direct sign-in and contact links work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:' + (process.env.FOUNDING_TEST_PORT ?? 3215) + '/about');
  await expect(page.getByRole('link', { name: /@ProjectArenaXYZ/ }).first()).toHaveAttribute('href', 'https://x.com/ProjectArenaXYZ');
  await expect(page.getByRole('link', { name: /hello@projectarena.xyz/ }).first()).toHaveAttribute('href', 'mailto:hello@projectarena.xyz');
  await page.locator('header').getByRole('link', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Step inside.' })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await context.close();
});
