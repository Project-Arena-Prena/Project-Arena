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

test('Higgsfield film follows scroll in both directions and rests at the requested frame', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const journey = page.locator('.gateway-journey');
  const video = page.locator('.gateway-video');
  await expect(journey).toHaveAttribute('data-mode', 'scroll');
  await expect(journey).toHaveAttribute('data-video', 'ready');
  await expect(video).toHaveAttribute('src', '/media/arena-scroll-desktop.mp4');
  await expect(video).toHaveJSProperty('paused', true);
  await journey.evaluate((element) => window.scrollTo({ top: element.getBoundingClientRect().top + scrollY + (element.clientHeight - innerHeight) * .7, behavior: 'instant' }));
  const progress = () => journey.evaluate((element) => Number((element as HTMLElement).style.getPropertyValue('--hero-progress')));
  await expect.poll(progress).toBe(.7);
  await expect(page.locator('.gateway-settle')).toHaveCSS('opacity', '1');
  await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(5.4);
  await expect(video).toHaveJSProperty('seeking', false);
  const settled = await video.evaluate((element) => (element as HTMLVideoElement).currentTime);
  await page.waitForTimeout(350);
  expect(await video.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBe(settled);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(progress).toBe(0);
  await expect(video).toHaveJSProperty('currentTime', 0);
  await expect(page.locator('h1')).toHaveCSS('opacity', '1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(journey).toHaveAttribute('data-mode', 'static');
  await expect(video).not.toHaveAttribute('src');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(journey).toHaveAttribute('data-mode', 'scroll');
});

test('mobile loads the small film and keeps navigation and the entry action accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.gateway-journey')).toHaveAttribute('data-video', 'ready');
  await expect(page.locator('.gateway-video')).toHaveAttribute('src', '/media/arena-scroll-mobile.mp4');
  await expect(page.locator('.hero-bottom a').first()).toBeInViewport();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'For Builders' }).click();
  await expect(page).toHaveURL(/\/for-builders$/);
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('reduced motion, short screens and limited connections never download the film', async ({ browser }) => {
  for (const mode of ['short-phone', 'reduced', 'landscape-phone', 'save-data', 'slow-connection']) {
    const context = await browser.newContext({
      viewport: mode === 'short-phone' ? { width: 320, height: 568 } : mode === 'landscape-phone' ? { width: 900, height: 420 } : { width: 1440, height: 900 },
      hasTouch: mode === 'landscape-phone', reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference',
    });
    if (mode === 'save-data' || mode === 'slow-connection') await context.addInitScript((slow) => Object.defineProperty(navigator, 'connection', { value: Object.assign(new EventTarget(), slow ? { effectiveType: '2g' } : { saveData: true }) }), mode === 'slow-connection');
    const page = await context.newPage();
    const mediaRequests: string[] = [];
    page.on('request', (request) => { if (/\.mp4(?:\?|$)/.test(request.url())) mediaRequests.push(request.url()); });
    await page.goto('/');
    await expect(page.locator('.founding-hero-art img')).toHaveJSProperty('complete', true);
    await expect(page.locator('.gateway-journey')).toHaveAttribute('data-mode', 'static');
    await expect(page.locator('.gateway-video')).not.toHaveAttribute('src');
    await expect(page.locator('h1')).toBeVisible();
    expect(mediaRequests).toEqual([]);
    await context.close();
  }
});

test('a failed film keeps the poster, readable text and working entry link', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/media/*.mp4', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('.gateway-journey')).toHaveAttribute('data-video', 'unavailable');
  await expect(page.locator('.founding-hero-art img')).toHaveJSProperty('complete', true);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.hero-bottom a').first()).toBeInViewport();
});
