import { expect, test } from '@playwright/test';

test('Roman hero scroll frames, rapid scrolling and responsive layout', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.gateway-journey')).toHaveAttribute('data-mode', 'scroll');
  for (const progress of [0, .25, .6, .8, 1]) {
    await page.locator('.gateway-journey').evaluate((element, p) => window.scrollTo({ top: element.getBoundingClientRect().top + scrollY + (element.clientHeight - innerHeight) * p, behavior: 'instant' }), progress);
    await page.waitForTimeout(1000);
    await testInfo.attach('gateway-' + progress, { body: await page.screenshot(), contentType: 'image/png' });
  }
  await page.locator('.gateway-journey').evaluate(async (element) => {
    const top = element.getBoundingClientRect().top + scrollY;
    const distance = element.clientHeight - innerHeight;
    for (const p of [0, 1, .2, .9, .1, .8, 0]) {
      window.scrollTo({ top: top + distance * p, behavior: 'instant' });
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  });
  await expect.poll(() => page.locator('.gateway-journey').evaluate((element) => Number((element as HTMLElement).style.getPropertyValue('--hero-progress')))).toBeLessThan(.1);
  await expect(page.locator('.gateway-intro')).toHaveCSS('opacity', '1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const path of ['/', '/for-builders', '/arena/founding', '/rankings', '/about']) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await testInfo.attach(width + '-' + (path.replaceAll('/', '-') || 'home'), { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    }
  }
});
