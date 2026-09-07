import { expect, test } from '@playwright/test';

const draftKey = 'arena.project-preview.v1';

test('preview gives value before sign-in and restores only on request', async ({ page }) => {
  await page.goto('/for-builders#project-preview');
  await page.getByLabel('Project name', { exact: true }).fill('Garden Notes');
  await page.getByLabel('One-line description').fill('A home for ideas worth growing.');
  await expect(page.locator('.preview-card h3')).toHaveText('Garden Notes');
  await page.getByRole('button', { name: 'Continue with this Project' }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fprojects%2Fnew/, { timeout: 30_000 });
  expect(page.url()).not.toContain('Garden');
  await page.goto('/dev-founding-harness?view=project');
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Use your preview' }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Garden Notes');
  await expect(page.getByLabel('Tagline', { exact: true })).toHaveValue('A home for ideas worth growing.');
  await page.getByLabel('Website', { exact: true }).fill('https://example.com');
  await page.route('**/api/projects', (route) => route.abort('failed'));
  await page.getByRole('button', { name: 'Create Project', exact: true }).click();
  await expect(page.locator('form [role="alert"]')).toContainText('Your details are still here');
  await expect(page.getByRole('button', { name: 'Create Project', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Garden Notes');
  await page.route('**/api/projects', (route) => route.fulfill({ status: 400, json: { error: 'invalid_body' } }));
  await page.getByRole('button', { name: 'Create Project', exact: true }).click();
  await expect(page.locator('form [role="alert"]')).toHaveText('invalid_body');
  expect(await page.evaluate((key) => localStorage.getItem(key), draftKey)).not.toBeNull();
});

test('discard, expired and malformed drafts never replace form details', async ({ page }) => {
  await page.goto('/for-builders');
  for (const raw of ['not json', JSON.stringify({ version: 1, name: 'Expired', tagline: 'Old draft', expiresAt: 1 })]) {
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: draftKey, raw });
    await page.goto('/dev-founding-harness?view=project');
    await expect(page.getByRole('button', { name: 'Use your preview' })).toHaveCount(0);
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('');
  }
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ version: 1, name: 'My draft', tagline: 'Not published', expiresAt: Date.now() + 60_000 })), draftKey);
  await page.reload();
  await page.getByRole('button', { name: 'Discard preview' }).click();
  await expect(page.getByRole('button', { name: 'Use your preview' })).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), draftKey)).toBeNull();
});

test('blocked storage keeps the preview and explains the failed handoff', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('Storage disabled'); }; });
  await page.goto('/for-builders#project-preview');
  await page.getByLabel('Project name', { exact: true }).fill('Still here');
  await page.getByLabel('One-line description').fill('My work stays in view.');
  await page.getByRole('button', { name: 'Continue with this Project' }).click();
  await expect(page.locator('form [role="alert"]')).toContainText('Your text is still here');
  await expect(page.locator('.preview-card h3')).toHaveText('Still here');
  await expect(page).toHaveURL(/\/for-builders/);
});

test('reveals play on entry, retire delays and honor live reduced-motion changes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const title = page.locator('#approach h2');
  await expect(title).toHaveClass(/reveal-pending/);
  await title.scrollIntoViewIfNeeded();
  await expect(title).not.toHaveClass(/reveal-pending/);
  await expect(title).toHaveCSS('opacity', '1');
  await page.locator('.mechanics').scrollIntoViewIfNeeded();
  const lastStep = page.locator('.mechanics li').last();
  await expect(lastStep).toHaveClass(/reveal-settled/);
  await expect(lastStep).toHaveCSS('transition-delay', '0s');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.reveal-pending')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(title).toHaveClass(/reveal-pending/);
  const board = page.locator('.quiet-board');
  await board.focus();
  await expect(board).not.toHaveClass(/reveal-pending/);
  await expect(board).toHaveCSS('opacity', '1');
});

test('content stays readable with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/');
  for (const element of await page.locator('[data-reveal]').all()) await expect(element).toHaveCSS('opacity', '1');
  await expect(page.locator('h1')).toBeVisible();
  await context.close();
});

test('entry progress reflects selection and does not claim submission', async ({ page }) => {
  await page.goto('/dev-founding-harness');
  const progress = page.getByRole('list', { name: 'Entry progress' });
  await expect(progress).toContainText('Account ready');
  await expect(progress).toContainText('Project selected');
  await expect(progress.locator('[aria-current="step"]')).toHaveText('Review & submit');
});

test('Roman artwork follows scroll, rests, and resets across live gates', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let mediaRequests = 0;
  page.on('request', (request) => { if (/\\.mp4(?:\\?|$)/.test(request.url())) mediaRequests++; });
  await page.goto('/');
  const journey = page.locator('.gateway-journey');
  const art = page.locator('.founding-hero-art');
  await expect(journey).toHaveAttribute('data-mode', 'scroll');
  await expect(art.locator('img')).toHaveAttribute('src', /roman-hero/);
  await expect(page.locator('.founding-hero video')).toHaveCount(0);
  const initial = await art.evaluate((element) => getComputedStyle(element).transform);
  await journey.evaluate((element) => window.scrollTo({ top: element.getBoundingClientRect().top + scrollY + (element.clientHeight - innerHeight) * .7, behavior: 'instant' }));
  const progress = () => journey.evaluate((element) => Number((element as HTMLElement).style.getPropertyValue('--hero-progress')));
  await expect.poll(progress).toBeCloseTo(.7, 3);
  await expect(page.locator('.gateway-settle')).toHaveCSS('opacity', '1');
  const settled = await art.evaluate((element) => getComputedStyle(element).transform);
  expect(settled).not.toBe(initial);
  await page.waitForTimeout(350);
  expect(await art.evaluate((element) => getComputedStyle(element).transform)).toBe(settled);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(progress).toBe(0);
  await expect(page.locator('h1')).toHaveCSS('opacity', '1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(journey).toHaveAttribute('data-mode', 'static');
  await expect(art).toHaveCSS('transform', 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(journey).toHaveAttribute('data-mode', 'scroll');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(journey).toHaveAttribute('data-mode', 'static');
  expect(mediaRequests).toBe(0);
});

test('mobile and motion preferences keep the still Roman hero', async ({ browser }) => {
  for (const mode of ['mobile', 'reduced', 'portrait-tablet', 'landscape-phone', 'save-data', 'slow-connection']) {
    const context = await browser.newContext({
      viewport: mode === 'mobile' ? { width: 390, height: 844 } : mode === 'portrait-tablet' ? { width: 820, height: 1180 } : mode === 'landscape-phone' ? { width: 900, height: 420 } : { width: 1440, height: 900 },
      hasTouch: mode === 'landscape-phone',
      reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference',
    });
    if (mode === 'save-data' || mode === 'slow-connection') await context.addInitScript((slow) => Object.defineProperty(navigator, 'connection', { value: Object.assign(new EventTarget(), slow ? { effectiveType: '2g' } : { saveData: true }) }), mode === 'slow-connection');
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('.founding-hero-art img')).toHaveJSProperty('complete', true);
    await expect(page.locator('.gateway-journey')).toHaveAttribute('data-mode', 'static');
    await expect(page.locator('.founding-hero-art')).toHaveCSS('transform', 'none');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.founding-hero .hero-bottom a').first()).toBeVisible();
    await context.close();
  }
});
