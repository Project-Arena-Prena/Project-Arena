import { expect, test } from '@playwright/test';
import {
  ARENA_CHAIN_ID,
  FAKE_TX_HASH,
  REMEMBER_KEY,
  WALLET_A,
  WALLET_B,
  WALLET_B_SHORT,
  calledMethods,
  freshQuote,
  installFakeWallet,
  onchainIntent,
  stubApi,
} from './fake-wallet';

/**
 * The two components that spend a wallet: <PrenaEntryOption> (quote → intent →
 * transfer → poll) and <ClaimRewardButton> (challenge → signature → claim).
 */

const ARENA_SLUG = 'harness-arena';
const PROJECT_ID = 'prj_harness';
const PAYMENT_STORAGE_KEY = `prena.payment.${ARENA_SLUG}.${PROJECT_ID}`;

const entryHarness = `/dev-wallet-harness?panel=entry&linked=${WALLET_A}`;
const claimHarness = `/dev-wallet-harness?panel=claim&linked=${WALLET_A}`;

const linkedWallets = {
  wallets: [
    {
      id: 'wal_1',
      address: WALLET_A,
      chainId: ARENA_CHAIN_ID,
      isPrimary: true,
      verifiedAt: new Date().toISOString(),
    },
  ],
};

const richBalance = {
  balance: {
    raw: '999000000000000000000000',
    formatted: '999,000',
    symbol: 'PRENA',
    decimals: 18,
    chainId: ARENA_CHAIN_ID,
    mode: 'onchain',
  },
};

/** A wallet already connected and verified, so the pay/claim path is reachable. */
function connectedWallet(extra: Record<string, unknown> = {}) {
  return {
    accounts: [WALLET_A],
    authorized: true,
    storage: { [REMEMBER_KEY]: '1' },
    ...extra,
  };
}

test.describe('$PRENA entry', () => {
  test('pays, submits the transfer, and lands on the success page once confirmed', async ({ page }) => {
    await installFakeWallet(page, connectedWallet());
    const api = await stubApi(page, {
      list: { body: linkedWallets },
      balance: { body: richBalance },
      quote: { body: { quote: freshQuote() } },
      entry: { body: { intent: onchainIntent() } },
      payment: () => ({
        body: { status: 'confirmed', txHash: FAKE_TX_HASH, failureReason: null, entryStatus: 'pending_review' },
      }),
    });
    await page.goto(entryHarness);

    const pay = page.getByRole('button', { name: 'Pay with $PRENA' });
    await expect(pay).toBeEnabled();
    await pay.click();

    await page.waitForURL(new RegExp(`/enter/success\\?arena=${ARENA_SLUG}`));

    expect(await calledMethods(page)).toContain('eth_sendTransaction');
    expect(api.hit('quote')).toBe(true);
    expect(api.hit('entry')).toBe(true);
    expect(api.hit('verify')).toBe(true);
  });

  test('a declined transfer (4001) reports nothing was charged and releases the hold', async ({ page }) => {
    await installFakeWallet(page, connectedWallet({ rejectSend: true }));
    const api = await stubApi(page, {
      list: { body: linkedWallets },
      balance: { body: richBalance },
      quote: { body: { quote: freshQuote() } },
      entry: { body: { intent: onchainIntent() } },
    });
    await page.goto(entryHarness);

    await page.getByRole('button', { name: 'Pay with $PRENA' }).click();

    await expect(page.getByText('Transaction declined in your wallet. Nothing was charged.')).toBeVisible();
    expect(api.hit('verify')).toBe(true);
    // The held slot is released, so nothing is left to resume after a reload.
    expect(await page.evaluate((key) => window.localStorage.getItem(key), PAYMENT_STORAGE_KEY)).toBeNull();
  });

  test('an insufficient balance blocks payment and points at card entry', async ({ page }) => {
    await installFakeWallet(page, connectedWallet());
    await stubApi(page, {
      list: { body: linkedWallets },
      balance: {
        body: {
          balance: { ...richBalance.balance, raw: '1000000000000000000', formatted: '1' },
        },
      },
      quote: { body: { quote: freshQuote() } },
    });
    await page.goto(entryHarness);

    await expect(page.getByText('Insufficient $PRENA')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pay with $PRENA' })).toBeDisabled();
  });

  test('a stored payment id resumes the confirming state after a refresh', async ({ page }) => {
    await installFakeWallet(
      page,
      connectedWallet({
        storage: { [REMEMBER_KEY]: '1', [PAYMENT_STORAGE_KEY]: 'tpay_resumed' },
      }),
    );
    const api = await stubApi(page, {
      list: { body: linkedWallets },
      balance: { body: richBalance },
      quote: { body: { quote: freshQuote() } },
      payment: () => ({
        body: { status: 'confirming', txHash: FAKE_TX_HASH, failureReason: null, entryStatus: null },
      }),
    });
    await page.goto(entryHarness);

    await expect(page.getByText('Waiting for confirmation')).toBeVisible();
    await expect(page.getByText('Your spot is held. You can close this page — the entry completes on its own.')).toBeVisible();
    expect(api.hit('payment')).toBe(true);
  });

  /**
   * Regression: the resumed confirming state used to collapse.
   *
   * On mount the resume effect set phase `confirming`, then the quote effect —
   * reading `phase` from the same first-render closure, where it was still
   * `idle` — fetched a quote and drove phase back through `quoting` to `idle`.
   * The status panel vanished and "Pay with $PRENA" went live again while the
   * first payment was still confirming, so a Builder could start a second one.
   * An in-flight ref now marks the payment synchronously, which a same-commit
   * effect cannot read stale.
   */
  test('a resumed payment keeps Pay disabled while the payment is in flight', async ({ page }) => {
    await installFakeWallet(
      page,
      connectedWallet({
        storage: { [REMEMBER_KEY]: '1', [PAYMENT_STORAGE_KEY]: 'tpay_resumed' },
      }),
    );
    await stubApi(page, {
      list: { body: linkedWallets },
      balance: { body: richBalance },
      quote: { body: { quote: freshQuote() } },
      payment: () => ({
        body: { status: 'confirming', txHash: FAKE_TX_HASH, failureReason: null, entryStatus: null },
      }),
    });
    // Make the quote resolve AFTER the first poll tick. With instant stubs the
    // poll always answers first and masks the race; a real network gives no
    // such ordering guarantee, and reversed is exactly when this bites.
    await page.route('**/api/prena/payment/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'confirming', txHash: FAKE_TX_HASH, failureReason: null, entryStatus: null }),
      });
    });
    await page.goto(entryHarness);

    // The window is narrow and self-healing: the quote lands, phase falls to
    // idle, and the next 5s poll tick puts it back. Waiting it out would pass
    // against the unfixed code, so sample continuously across that gap instead
    // and fail on any moment where a second payment could have been started.
    // Read the DOM directly rather than through a locator: a locator call on a
    // button that is correctly absent auto-waits and eats the test budget.
    const payWentLive = async () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('button')).some(
          (button) => /pay with \$prena/i.test(button.textContent ?? '') && !button.disabled,
        ),
      );

    const deadline = Date.now() + 4500;
    while (Date.now() < deadline) {
      expect(await payWentLive(), 'Pay went live while a payment was still confirming').toBe(false);
      await page.waitForTimeout(100);
    }

    await expect(page.getByRole('button', { name: 'Processing' })).toBeDisabled();
  });
});

test.describe('reward claim', () => {
  test('a declined signature claims nothing and says nothing was changed', async ({ page }) => {
    await installFakeWallet(page, connectedWallet({ rejectSign: true }));
    const api = await stubApi(page, {
      list: { body: linkedWallets },
      challenge: { body: { nonce: 'nonce_claim', message: 'Claim 1,200 PRENA', address: WALLET_A } },
      claim: { body: { ok: true } },
    });
    await page.goto(claimHarness);

    await page.getByRole('button', { name: 'Claim Reward' }).click();

    await expect(page.getByText('Signature declined. Nothing was changed.').first()).toBeVisible();
    expect(api.hit('challenge')).toBe(true);
    expect(api.hit('claim')).toBe(false);
  });

  test('a reward addressed to another wallet names that wallet instead of claiming', async ({ page }) => {
    await installFakeWallet(page, connectedWallet());
    const api = await stubApi(page, {
      list: { body: linkedWallets },
      challenge: { body: { nonce: 'nonce_claim', message: 'Claim 1,200 PRENA', address: WALLET_B } },
    });
    await page.goto(`${claimHarness}&expected=${WALLET_B}`);

    await expect(page.getByText(`Addressed to ${WALLET_B_SHORT}. Switch to that wallet to claim.`)).toBeVisible();

    await page.getByRole('button', { name: 'Claim Reward' }).click();

    await expect(page.getByText('This reward is addressed to a different wallet.')).toBeVisible();
    expect(api.hit('challenge')).toBe(false);
  });

  test('a successful claim confirms and reports the amount', async ({ page }) => {
    await installFakeWallet(page, connectedWallet());
    const api = await stubApi(page, {
      list: { body: linkedWallets },
      challenge: { body: { nonce: 'nonce_claim', message: 'Claim 1,200 PRENA', address: WALLET_A } },
      claim: { body: { ok: true, settled: false } },
    });
    await page.goto(claimHarness);

    await page.getByRole('button', { name: 'Claim Reward' }).click();

    await expect(page.getByText('Claimed')).toBeVisible();
    await expect(
      page.getByText('Payout is queued. It lands in your wallet once the distributor settles.'),
    ).toBeVisible();
    expect(api.hit('claim')).toBe(true);
    expect(await calledMethods(page)).toContain('personal_sign');
  });
});
