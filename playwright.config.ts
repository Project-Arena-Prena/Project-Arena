import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.WALLET_TEST_PORT ?? 3210);
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Browser tests for the $PRENA wallet components. They run against a real
 * `next dev` server with a fake EIP-1193 provider injected as `window.ethereum`
 * (tests/wallet/fake-wallet.ts) — there is no wallet extension in CI.
 *
 * The chain values below are pinned here rather than read from the developer's
 * .env so assertions about the expected network stay deterministic. The RPC url
 * matters: `switchNetwork` only offers wallet_addEthereumChain on a 4902 when
 * one is configured.
 */
export default defineConfig({
  testDir: './tests/wallet',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // The CI smoke suite values predictable startup over Turbopack's local
    // incremental performance. Webpack avoids the observed Turbopack harness
    // stall that can consume the entire 20-minute Actions job budget before
    // Playwright reaches its first assertion.
    command: `npx next dev --webpack -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NEXT_PUBLIC_PRENA_CHAIN_ID: '31337',
      NEXT_PUBLIC_PRENA_CHAIN_NAME: 'Arena Devnet',
      NEXT_PUBLIC_PRENA_NATIVE_SYMBOL: 'ETH',
      NEXT_PUBLIC_PRENA_RPC_URL: 'http://127.0.0.1:8545',
    },
  },
});

