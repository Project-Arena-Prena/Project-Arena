import { expect, test } from '@playwright/test';
import {
  ARENA_CHAIN_ID,
  ARENA_CHAIN_NAME,
  OTHER_CHAIN_HEX,
  REMEMBER_KEY,
  WALLET_A,
  WALLET_A_SHORT,
  calledMethods,
  emitWalletEvent,
  installFakeWallet,
  stubApi,
} from './fake-wallet';

/**
 * The wallet state machine in src/components/prena/wallet-provider.tsx, driven
 * through <WalletButton> on the dev-only /dev-wallet-harness route.
 */

const HARNESS = '/dev-wallet-harness';

function verifiedWallet(address: string) {
  return {
    wallets: [
      {
        id: 'wal_1',
        address,
        chainId: ARENA_CHAIN_ID,
        isPrimary: true,
        verifiedAt: new Date().toISOString(),
      },
    ],
  };
}

const challenge = { nonce: 'nonce_harness', message: 'Project Arena wants you to sign in.' };

test.describe('wallet availability', () => {
  test('no wallet installed: says a wallet is optional and offers no connect path', async ({ page }) => {
    await stubApi(page, {});
    await page.goto(HARNESS);

    const panel = page.getByTestId('wallet-panel');
    await expect(panel.getByText('No wallet detected')).toBeVisible();
    await expect(panel.getByText('A wallet is optional. Card entry works without one.')).toBeVisible();
    await expect(panel.getByRole('button', { name: /connect wallet/i })).toHaveCount(0);
  });
});

test.describe('connecting', () => {
  test('declined connection (4001) surfaces the declined copy and a retry', async ({ page }) => {
    await installFakeWallet(page, { accounts: [WALLET_A], rejectConnect: true });
    await stubApi(page, {});
    await page.goto(HARNESS);

    await page.getByRole('button', { name: 'Connect Wallet' }).click();

    await expect(page.getByText('Wallet connection was declined.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  test('successful connection shows the shortened address', async ({ page }) => {
    await installFakeWallet(page, { accounts: [WALLET_A] });
    await stubApi(page, {
      nonce: { body: challenge },
      link: { body: { ok: true } },
      list: { body: verifiedWallet(WALLET_A) },
    });
    await page.goto(HARNESS);

    await page.getByRole('button', { name: 'Connect Wallet' }).click();

    await expect(page.getByRole('button', { name: WALLET_A_SHORT })).toBeVisible();
    expect(await calledMethods(page)).toContain('eth_requestAccounts');
  });

  test('declined signature links nothing and says nothing was changed', async ({ page }) => {
    // An already-connected wallet, verifying from the "Verify wallet" button.
    // This is the only route into linkWallet that reaches personal_sign today —
    // see the connect-then-link test below.
    await installFakeWallet(page, {
      accounts: [WALLET_A],
      authorized: true,
      rejectSign: true,
      storage: { [REMEMBER_KEY]: '1' },
    });
    const api = await stubApi(page, { nonce: { body: challenge }, link: { body: { ok: true } } });
    await page.goto(HARNESS);

    await page.getByRole('button', { name: 'Verify wallet' }).click();

    await expect(page.getByText('Signature declined. Nothing was changed.').first()).toBeVisible();
    expect(await calledMethods(page)).toContain('personal_sign');
    expect(api.hit('nonce')).toBe(true);
    expect(api.hit('link')).toBe(false);
  });

  /**
   * BUG (reported, not fixed): connecting and linking in a single click never
   * asks the wallet to sign.
   *
   * `WalletButton`'s Connect button calls `linkWallet()`. With no address in
   * state yet, that closure's `signMessage` is the one built for `address =
   * null`, so its own `if (!provider || !address)` guard short-circuits — even
   * though `connect()` just returned the address and the nonce request used it.
   * The Builder sees "No wallet detected in this browser." next to their own
   * connected address, and has to click "Verify wallet" a second time.
   *
   * This test asserts the observed behaviour so the defect is recorded. It
   * should be deleted, and the previous test extended to cover the one-click
   * path, once linkWallet passes `target` down to the signature.
   */
  test('connect-then-link in one click never reaches personal_sign', async ({ page }) => {
    await installFakeWallet(page, { accounts: [WALLET_A], rejectSign: true });
    const api = await stubApi(page, { nonce: { body: challenge }, link: { body: { ok: true } } });
    await page.goto(HARNESS);

    await page.getByRole('button', { name: 'Connect Wallet' }).click();

    // The wallet is connected — its address is on screen — yet the UI claims
    // there is no wallet, and no signature was ever requested.
    await expect(page.getByRole('button', { name: WALLET_A_SHORT })).toBeVisible();
    await expect(page.getByText('No wallet detected in this browser.')).toBeVisible();
    expect(await calledMethods(page)).not.toContain('personal_sign');
    expect(api.hit('nonce')).toBe(true);
    expect(api.hit('link')).toBe(false);
  });
});

test.describe('silent reconnect', () => {
  test('a remembered wallet is restored on load without prompting', async ({ page }) => {
    await installFakeWallet(page, {
      accounts: [WALLET_A],
      authorized: true,
      storage: { [REMEMBER_KEY]: '1' },
    });
    await stubApi(page, { list: { body: verifiedWallet(WALLET_A) } });
    await page.goto(HARNESS);

    await expect(page.getByRole('button', { name: WALLET_A_SHORT })).toBeVisible();

    const methods = await calledMethods(page);
    expect(methods).toContain('eth_accounts');
    expect(methods).not.toContain('eth_requestAccounts');
  });

  test('a first-time visitor is never prompted', async ({ page }) => {
    // The wallet would answer eth_accounts, but nothing was remembered, so the
    // app must leave the visitor alone.
    await installFakeWallet(page, { accounts: [WALLET_A], authorized: true });
    await stubApi(page, {});
    await page.goto(HARNESS);

    await expect(page.getByRole('button', { name: 'Connect Wallet' })).toBeVisible();
    expect(await calledMethods(page)).not.toContain('eth_requestAccounts');
  });
});

test.describe('network', () => {
  test('a chain that is not the Arena chain offers a switch', async ({ page }) => {
    await installFakeWallet(page, {
      accounts: [WALLET_A],
      authorized: true,
      chainId: OTHER_CHAIN_HEX,
      storage: { [REMEMBER_KEY]: '1' },
    });
    await stubApi(page, { list: { body: verifiedWallet(WALLET_A) } });
    await page.goto(HARNESS);

    await expect(page.getByRole('button', { name: `Switch to ${ARENA_CHAIN_NAME}` })).toBeVisible();
  });

  test('declined switch (4001) surfaces the declined copy and keeps the affordance', async ({ page }) => {
    await installFakeWallet(page, {
      accounts: [WALLET_A],
      authorized: true,
      chainId: OTHER_CHAIN_HEX,
      rejectSwitch: true,
      storage: { [REMEMBER_KEY]: '1' },
    });
    await stubApi(page, { list: { body: verifiedWallet(WALLET_A) } });
    await page.goto(HARNESS);

    await page.getByRole('button', { name: `Switch to ${ARENA_CHAIN_NAME}` }).click();

    await expect(page.getByText('Network switch was declined.')).toBeVisible();
    await expect(page.getByRole('button', { name: `Switch to ${ARENA_CHAIN_NAME}` })).toBeVisible();
  });

  test('an unknown chain (4902) falls back to wallet_addEthereumChain', async ({ page }) => {
    await installFakeWallet(page, {
      accounts: [WALLET_A],
      authorized: true,
      chainId: OTHER_CHAIN_HEX,
      unknownChain: true,
      storage: { [REMEMBER_KEY]: '1' },
    });
    await stubApi(page, { list: { body: verifiedWallet(WALLET_A) } });
    await page.goto(HARNESS);

    await page.getByRole('button', { name: `Switch to ${ARENA_CHAIN_NAME}` }).click();

    await expect(page.getByRole('button', { name: `Switch to ${ARENA_CHAIN_NAME}` })).toHaveCount(0);
    const methods = await calledMethods(page);
    expect(methods).toContain('wallet_switchEthereumChain');
    expect(methods).toContain('wallet_addEthereumChain');
  });

  test('a declined wallet_addEthereumChain reports a failed switch', async ({ page }) => {
    await installFakeWallet(page, {
      accounts: [WALLET_A],
      authorized: true,
      chainId: OTHER_CHAIN_HEX,
      unknownChain: true,
      rejectAddChain: true,
      storage: { [REMEMBER_KEY]: '1' },
    });
    await stubApi(page, { list: { body: verifiedWallet(WALLET_A) } });
    await page.goto(HARNESS);

    await page.getByRole('button', { name: `Switch to ${ARENA_CHAIN_NAME}` }).click();

    await expect(page.getByText('Could not switch network. Change it in your wallet and retry.')).toBeVisible();
  });

  test('a chainChanged onto the Arena chain clears the wrong-network state', async ({ page }) => {
    await installFakeWallet(page, {
      accounts: [WALLET_A],
      authorized: true,
      chainId: OTHER_CHAIN_HEX,
      storage: { [REMEMBER_KEY]: '1' },
    });
    await stubApi(page, { list: { body: verifiedWallet(WALLET_A) } });
    await page.goto(HARNESS);

    await expect(page.getByRole('button', { name: `Switch to ${ARENA_CHAIN_NAME}` })).toBeVisible();
    await emitWalletEvent(page, 'chainChanged', '0x7a69');

    await expect(page.getByRole('button', { name: `Switch to ${ARENA_CHAIN_NAME}` })).toHaveCount(0);
  });
});

test.describe('account changes', () => {
  test('accountsChanged to an empty list returns to disconnected', async ({ page }) => {
    await installFakeWallet(page, {
      accounts: [WALLET_A],
      authorized: true,
      storage: { [REMEMBER_KEY]: '1' },
    });
    await stubApi(page, { list: { body: verifiedWallet(WALLET_A) } });
    await page.goto(HARNESS);

    await expect(page.getByRole('button', { name: WALLET_A_SHORT })).toBeVisible();

    await emitWalletEvent(page, 'accountsChanged', []);

    await expect(page.getByRole('button', { name: 'Connect Wallet' })).toBeVisible();
    await expect(page.getByRole('button', { name: WALLET_A_SHORT })).toHaveCount(0);
    // The locked wallet must not silently reconnect on the next load.
    expect(await page.evaluate((key) => window.localStorage.getItem(key), REMEMBER_KEY)).toBeNull();
  });

  test('disconnect forgets the session so the next load does not restore it', async ({ page }) => {
    await installFakeWallet(page, {
      accounts: [WALLET_A],
      authorized: true,
      storage: { [REMEMBER_KEY]: '1' },
    });
    await stubApi(page, { list: { body: verifiedWallet(WALLET_A) } });
    await page.goto(HARNESS);

    await page.getByRole('button', { name: WALLET_A_SHORT }).click();
    await page.getByRole('button', { name: 'Disconnect' }).click();

    await expect(page.getByRole('button', { name: 'Connect Wallet' })).toBeVisible();
    expect(await page.evaluate((key) => window.localStorage.getItem(key), REMEMBER_KEY)).toBeNull();

    await page.reload();
    await expect(page.getByRole('button', { name: 'Connect Wallet' })).toBeVisible();
  });
});
