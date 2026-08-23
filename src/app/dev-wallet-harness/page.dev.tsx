'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Container, Label } from '@/components/ui';
import { ClaimRewardButton } from '@/components/prena/claim-reward-button';
import { PrenaBalance } from '@/components/prena/prena-balance';
import { PrenaEntryOption } from '@/components/prena/prena-entry-option';
import { WalletButton } from '@/components/prena/wallet-button';
import { WalletProvider, type LinkedWallet } from '@/components/prena/wallet-provider';
import { prenaPublicConfig } from '@/lib/prena/config';
import { LIVE_ARENA } from '@/lib/mock-data';

/**
 * Browser harness for the wallet components, driven by Playwright with a fake
 * EIP-1193 provider. The real hosts for these components (/enter, /dashboard)
 * sit behind a Supabase session the browser tests cannot mint, and the point of
 * these tests is the client state machine, not the auth boundary.
 *
 * The filename is `page.dev.tsx` deliberately: `dev.tsx` counts as a page
 * extension only outside production (see next.config.mjs), so a production
 * build finds no page file in this directory and the route does not exist.
 */

const HARNESS_ARENA = {
  ...LIVE_ARENA,
  slug: 'harness-arena',
  prenaPaymentEnabled: true,
  prenaDiscountPercent: 17,
};

/** `?linked=0xabc,0xdef` seeds wallets the server would report as verified. */
function parseLinked(raw: string | null): LinkedWallet[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .map((address, index) => ({
      id: `wal_${index}`,
      address,
      chainId: prenaPublicConfig.chainId,
      isPrimary: index === 0,
      verifiedAt: new Date().toISOString(),
    }));
}

function HarnessBody() {
  const params = useSearchParams();
  const panel = params.get('panel') ?? 'wallet';
  const linked = parseLinked(params.get('linked'));
  const projectId = params.get('project') ?? 'prj_harness';
  const expectedWallet = params.get('expected');

  return (
    <WalletProvider initialWallets={linked}>
      <Container className="flex flex-col gap-8 py-10">
        <Label>Wallet harness</Label>

        <section data-testid="wallet-panel" className="flex flex-col gap-3">
          <WalletButton />
        </section>

        {panel === 'balance' ? (
          <section data-testid="balance-panel">
            <PrenaBalance />
          </section>
        ) : null}

        {panel === 'entry' ? (
          <section data-testid="entry-panel">
            <PrenaEntryOption arena={HARNESS_ARENA} projectId={projectId} />
          </section>
        ) : null}

        {panel === 'claim' ? (
          <section data-testid="claim-panel">
            <ClaimRewardButton
              allocationId="alloc_harness"
              amountFormatted="1,200"
              expectedWallet={expectedWallet}
            />
          </section>
        ) : null}
      </Container>
    </WalletProvider>
  );
}

export default function WalletHarnessPage() {
  return (
    <Suspense fallback={<Container className="py-10">Loading harness</Container>}>
      <HarnessBody />
    </Suspense>
  );
}
