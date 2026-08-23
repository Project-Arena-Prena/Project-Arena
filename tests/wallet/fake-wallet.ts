import type { Page, Route } from '@playwright/test';

/**
 * A fake EIP-1193 provider injected as `window.ethereum` before the page loads.
 *
 * There is no wallet extension in CI, so every browser-side path in
 * src/components/prena would otherwise be unreachable. This stands in for the
 * extension: it records every `request` the app makes, can decline with the
 * real wallet error codes (4001 user-rejected, 4902 unknown chain), and lets a
 * test push `accountsChanged` / `chainChanged` the way a real wallet does.
 */

/** Values the harness dev server is started with — see playwright.config.ts. */
export const ARENA_CHAIN_ID = 31337;
export const ARENA_CHAIN_HEX = '0x7a69';
export const ARENA_CHAIN_NAME = 'Arena Devnet';
/** Ethereum mainnet: deliberately not the Arena chain. */
export const OTHER_CHAIN_HEX = '0x1';

export const WALLET_A = '0x7ac3e5b9c1f4d2a80e6f1b3c9d8a4f5e2c1b0a9d';
export const WALLET_B = '0x3d5f8b1c7e9a2046d8c1f3e5a7b9d0c2e4f68a1b';
/** What `shortAddress` renders for each. */
export const WALLET_A_SHORT = '0x7a…0A9D';
export const WALLET_B_SHORT = '0x3d…8A1B';

export const FAKE_SIGNATURE = `0x${'ab'.repeat(65)}`;
export const FAKE_TX_HASH = `0x${'11'.repeat(32)}`;

export const REMEMBER_KEY = 'prena.wallet.connected';

export interface FakeWalletOptions {
  /** Accounts the wallet holds and grants when asked. */
  accounts?: string[];
  /** True when the site is already permitted, so `eth_accounts` answers without a prompt. */
  authorized?: boolean;
  chainId?: string;
  /** eth_requestAccounts outcomes. */
  rejectConnect?: boolean;
  failConnect?: boolean;
  /** personal_sign outcome. */
  rejectSign?: boolean;
  /** wallet_switchEthereumChain outcomes. */
  rejectSwitch?: boolean;
  unknownChain?: boolean;
  rejectAddChain?: boolean;
  /** eth_sendTransaction outcomes. */
  rejectSend?: boolean;
  failSend?: boolean;
  /** Seed localStorage before the app boots — e.g. the remembered-connection flag. */
  storage?: Record<string, string>;
}

export interface RecordedCall {
  method: string;
  params?: unknown[];
}

declare global {
  interface Window {
    __fakeWallet?: {
      calls: RecordedCall[];
      emit: (event: string, ...args: unknown[]) => void;
      setAccounts: (accounts: string[]) => void;
      setChainId: (chainId: string) => void;
    };
  }
}

/**
 * Install the provider. Must run before the app's first render, so it uses
 * `addInitScript` rather than `evaluate`.
 */
export async function installFakeWallet(page: Page, options: FakeWalletOptions = {}): Promise<void> {
  await page.addInitScript((raw: FakeWalletOptions) => {
    const config = raw ?? {};
    const granted = config.accounts ?? [];
    const state = {
      accounts: config.authorized ? granted.slice() : ([] as string[]),
      chainId: config.chainId ?? '0x7a69',
    };
    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
    const calls: RecordedCall[] = [];

    // Seed storage once per tab so a reload inside a test does not undo what
    // the app itself wrote (disconnect clears the remembered flag).
    if (config.storage && !window.sessionStorage.getItem('__harness.seeded')) {
      for (const [key, value] of Object.entries(config.storage)) {
        window.localStorage.setItem(key, value);
      }
      window.sessionStorage.setItem('__harness.seeded', '1');
    }

    function providerError(code: number, message: string): Error {
      return Object.assign(new Error(message), { code });
    }

    function emit(event: string, ...args: unknown[]) {
      for (const handler of listeners[event] ?? []) handler(...args);
    }

    const provider = {
      isMetaMask: true,
      async request({ method, params }: { method: string; params?: unknown[] }): Promise<unknown> {
        calls.push({ method, params });
        switch (method) {
          case 'eth_accounts':
            return state.accounts.slice();

          case 'eth_requestAccounts':
            if (config.rejectConnect) throw providerError(4001, 'User rejected the request.');
            if (config.failConnect) throw providerError(-32603, 'Internal JSON-RPC error.');
            state.accounts = granted.slice();
            return state.accounts.slice();

          case 'eth_chainId':
            return state.chainId;

          case 'personal_sign':
            if (config.rejectSign) throw providerError(4001, 'User rejected the request.');
            return `0x${'ab'.repeat(65)}`;

          case 'eth_sendTransaction':
            if (config.rejectSend) throw providerError(4001, 'User denied transaction signature.');
            if (config.failSend) throw providerError(-32000, 'Insufficient funds.');
            return `0x${'11'.repeat(32)}`;

          case 'wallet_switchEthereumChain': {
            if (config.rejectSwitch) throw providerError(4001, 'User rejected the request.');
            if (config.unknownChain) {
              throw providerError(4902, 'Unrecognized chain ID.');
            }
            const target = (params?.[0] as { chainId?: string } | undefined)?.chainId;
            if (target) {
              state.chainId = target;
              emit('chainChanged', target);
            }
            return null;
          }

          case 'wallet_addEthereumChain': {
            if (config.rejectAddChain) throw providerError(4001, 'User rejected the request.');
            const added = (params?.[0] as { chainId?: string } | undefined)?.chainId;
            if (added) {
              state.chainId = added;
              emit('chainChanged', added);
            }
            return null;
          }

          default:
            throw providerError(-32601, `Unsupported method: ${method}`);
        }
      },
      on(event: string, handler: (...args: unknown[]) => void) {
        (listeners[event] ??= []).push(handler);
      },
      removeListener(event: string, handler: (...args: unknown[]) => void) {
        listeners[event] = (listeners[event] ?? []).filter((item) => item !== handler);
      },
    };

    Object.defineProperty(window, 'ethereum', { value: provider, configurable: true, writable: true });

    window.__fakeWallet = {
      calls,
      emit,
      setAccounts(accounts: string[]) {
        state.accounts = accounts.slice();
      },
      setChainId(chainId: string) {
        state.chainId = chainId;
      },
    };
  }, options);
}

/** Seed localStorage before load without installing a provider (no-wallet cases). */
export async function seedStorage(page: Page, storage: Record<string, string>): Promise<void> {
  await page.addInitScript((entries: Record<string, string>) => {
    if (window.sessionStorage.getItem('__harness.seeded')) return;
    for (const [key, value] of Object.entries(entries)) window.localStorage.setItem(key, value);
    window.sessionStorage.setItem('__harness.seeded', '1');
  }, storage);
}

export async function walletCalls(page: Page): Promise<RecordedCall[]> {
  return page.evaluate(() => window.__fakeWallet?.calls.map((call) => ({ ...call })) ?? []);
}

export async function calledMethods(page: Page): Promise<string[]> {
  return (await walletCalls(page)).map((call) => call.method);
}

export async function emitWalletEvent(page: Page, event: string, ...args: unknown[]): Promise<void> {
  await page.evaluate(
    ([name, payload]) => {
      window.__fakeWallet?.emit(name as string, ...(payload as unknown[]));
    },
    [event, args] as const,
  );
}

/* ----------------------------------------------------------------- api stubs */

/**
 * The harness runs against the real dev server, so the $PRENA and wallet API
 * routes would answer `auth_required` without a Supabase session. Fulfilling
 * them here keeps each test about the browser state machine.
 */
export interface ApiStubs {
  /** POST /api/wallet/nonce */
  nonce?: { status?: number; body: unknown };
  /** POST /api/wallet/link */
  link?: { status?: number; body: unknown };
  /** GET /api/wallet/list */
  list?: { status?: number; body: unknown };
  /** POST /api/wallet/unlink */
  unlink?: { status?: number; body: unknown };
  /** GET /api/wallet/balance */
  balance?: { status?: number; body: unknown };
  /** POST /api/prena/quote */
  quote?: { status?: number; body: unknown };
  /** POST /api/prena/entry */
  entry?: { status?: number; body: unknown };
  /** POST /api/prena/entry/verify */
  verify?: { status?: number; body: unknown };
  /** GET /api/prena/payment/:id — a function so a test can walk the status forward. */
  payment?: (hit: number) => { status?: number; body: unknown };
  /** POST /api/rewards/challenge */
  challenge?: { status?: number; body: unknown };
  /** POST /api/rewards/claim */
  claim?: { status?: number; body: unknown };
}

export interface ApiRecorder {
  /** Every stubbed endpoint the page actually hit, in order. */
  hits: string[];
  hit: (name: string) => boolean;
}

export async function stubApi(page: Page, stubs: ApiStubs): Promise<ApiRecorder> {
  const hits: string[] = [];

  async function serve(route: Route, name: string, stub?: { status?: number; body: unknown }) {
    hits.push(name);
    if (!stub) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'no_stub' }) });
      return;
    }
    await route.fulfill({
      status: stub.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(stub.body),
    });
  }

  let paymentHits = 0;

  await page.route('**/api/wallet/nonce', (route) => serve(route, 'nonce', stubs.nonce));
  await page.route('**/api/wallet/link', (route) => serve(route, 'link', stubs.link));
  await page.route('**/api/wallet/unlink', (route) => serve(route, 'unlink', stubs.unlink));
  await page.route('**/api/wallet/list*', (route) => serve(route, 'list', stubs.list ?? { body: { wallets: [] } }));
  await page.route('**/api/wallet/balance*', (route) =>
    serve(route, 'balance', stubs.balance ?? { body: { balance: null }, status: 503 }),
  );
  await page.route('**/api/prena/quote', (route) => serve(route, 'quote', stubs.quote));
  await page.route('**/api/prena/entry', (route) => serve(route, 'entry', stubs.entry));
  await page.route('**/api/prena/entry/verify', (route) => serve(route, 'verify', stubs.verify ?? { body: { ok: true } }));
  await page.route('**/api/prena/payment/*', (route) => {
    paymentHits += 1;
    return serve(route, 'payment', stubs.payment?.(paymentHits));
  });
  await page.route('**/api/rewards/challenge', (route) => serve(route, 'challenge', stubs.challenge));
  await page.route('**/api/rewards/claim', (route) => serve(route, 'claim', stubs.claim));

  return { hits, hit: (name: string) => hits.includes(name) };
}

/** A quote the entry option will accept as fresh. */
export function freshQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: 'qte_harness',
    usdAmount: 49,
    discountPercent: 17,
    discountedUsdAmount: 40.67,
    tokenAmount: '4067000000000000000000',
    tokenAmountFormatted: '4,067',
    tokenSymbol: 'PRENA',
    tokenContract: '0x000000000000000000000000000000000000dead',
    tokenDecimals: 18,
    chainId: ARENA_CHAIN_ID,
    expiresAt: new Date(Date.now() + 180_000).toISOString(),
    mode: 'onchain',
    ...overrides,
  };
}

export function onchainIntent(overrides: Record<string, unknown> = {}) {
  return {
    tokenPaymentId: 'tpay_harness',
    tokenAmount: '4067000000000000000000',
    tokenAmountFormatted: '4,067',
    tokenContract: '0x000000000000000000000000000000000000dead',
    chainId: ARENA_CHAIN_ID,
    recipientAddress: '0x000000000000000000000000000000000000beef',
    mode: 'onchain',
    ...overrides,
  };
}
