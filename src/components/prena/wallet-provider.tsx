'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { encodeFunctionData, erc20Abi, toHex } from 'viem';
import { prenaPublicConfig, shortAddress } from '@/lib/prena/config';

/**
 * All wallet and chain interaction lives here. Presentational components read
 * this context and never touch an RPC or a provider object themselves.
 */

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
};

export type WalletStatus = 'checking' | 'unavailable' | 'disconnected' | 'connecting' | 'connected';

export interface LinkedWallet {
  id: string;
  address: string;
  chainId: number;
  isPrimary: boolean;
  verifiedAt: string | null;
}

export interface WalletContextValue {
  status: WalletStatus;
  address: string | null;
  chainId: number | null;
  wrongNetwork: boolean;
  expectedChainId: number;
  expectedChainName: string;
  error: string | null;
  busy: boolean;
  /** Verified wallets on the Builder account, from the server. */
  linkedWallets: LinkedWallet[];
  /** True when the connected address is verified for this Builder. */
  isLinked: boolean;
  connect: () => Promise<string | null>;
  disconnect: () => void;
  switchNetwork: () => Promise<boolean>;
  linkWallet: () => Promise<boolean>;
  unlinkWallet: (walletId: string) => Promise<boolean>;
  signMessage: (message: string) => Promise<string | null>;
  sendTokenTransfer: (input: {
    tokenContract: string | null;
    to: string;
    amount: string;
  }) => Promise<{ txHash: string } | { error: string }>;
  refreshWallets: () => Promise<void>;
  clearError: () => void;
  mobileWalletUrl: string | null;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const REMEMBER_KEY = 'prena.wallet.connected';

function getProvider(): Eip1193Provider | null {
  if (typeof window === 'undefined') return null;
  const injected = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  return injected ?? null;
}

function remember(value: boolean) {
  try {
    if (value) window.localStorage.setItem(REMEMBER_KEY, '1');
    else window.localStorage.removeItem(REMEMBER_KEY);
  } catch {
    // Private browsing; connection simply will not auto-restore.
  }
}

function wasConnected(): boolean {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) === '1';
  } catch {
    return false;
  }
}

export function WalletProvider({
  children,
  initialWallets = [],
}: {
  children: ReactNode;
  initialWallets?: LinkedWallet[];
}) {
  const [status, setStatus] = useState<WalletStatus>('checking');
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkedWallets, setLinkedWallets] = useState<LinkedWallet[]>(initialWallets);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const readChain = useCallback(async (provider: Eip1193Provider) => {
    try {
      const raw = (await provider.request({ method: 'eth_chainId' })) as string;
      return Number.parseInt(raw, 16);
    } catch {
      return null;
    }
  }, []);

  // Silent reconnect. eth_accounts never prompts, so a returning Builder is
  // restored without a popup and a first-time visitor is left alone.
  useEffect(() => {
    const provider = getProvider();
    if (!provider) {
      setStatus('unavailable');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
        const next = accounts?.[0]?.toLowerCase() ?? null;
        const chain = await readChain(provider);
        if (cancelled || !mounted.current) return;
        setChainId(chain);
        if (next && wasConnected()) {
          setAddress(next);
          setStatus('connected');
        } else {
          setStatus('disconnected');
        }
      } catch {
        if (!cancelled && mounted.current) setStatus('disconnected');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [readChain]);

  useEffect(() => {
    const provider = getProvider();
    if (!provider?.on) return;

    const onAccounts = (...args: never[]) => {
      const accounts = args[0] as unknown as string[];
      const next = accounts?.[0]?.toLowerCase() ?? null;
      setAddress(next);
      setStatus(next ? 'connected' : 'disconnected');
      if (!next) remember(false);
    };
    const onChain = (...args: never[]) => {
      const hex = args[0] as unknown as string;
      setChainId(Number.parseInt(hex, 16));
    };

    provider.on('accountsChanged', onAccounts);
    provider.on('chainChanged', onChain);
    return () => {
      provider.removeListener?.('accountsChanged', onAccounts);
      provider.removeListener?.('chainChanged', onChain);
    };
  }, []);

  const refreshWallets = useCallback(async () => {
    try {
      const response = await fetch('/api/wallet/list', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = (await response.json()) as { wallets?: LinkedWallet[] };
      if (mounted.current && payload.wallets) setLinkedWallets(payload.wallets);
    } catch {
      // Keep the last known list; the page will re-render it on next load.
    }
  }, []);

  const connect = useCallback(async (): Promise<string | null> => {
    const provider = getProvider();
    if (!provider) {
      setStatus('unavailable');
      setError('wallet_unavailable');
      return null;
    }
    setBusy(true);
    setError(null);
    setStatus('connecting');
    try {
      const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
      const next = accounts?.[0]?.toLowerCase() ?? null;
      if (!next) {
        setStatus('disconnected');
        setError('connect_failed');
        return null;
      }
      const chain = await readChain(provider);
      if (!mounted.current) return next;
      setAddress(next);
      setChainId(chain);
      setStatus('connected');
      remember(true);
      return next;
    } catch (cause) {
      const code = (cause as { code?: number })?.code;
      setStatus('disconnected');
      setError(code === 4001 ? 'connect_rejected' : 'connect_failed');
      return null;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [readChain]);

  const disconnect = useCallback(() => {
    // EIP-1193 has no revoke; forget the session locally and stop reconnecting.
    remember(false);
    setAddress(null);
    setStatus('disconnected');
    setError(null);
  }, []);

  const switchNetwork = useCallback(async (): Promise<boolean> => {
    const provider = getProvider();
    if (!provider) return false;
    setBusy(true);
    setError(null);
    const hexChain = toHex(prenaPublicConfig.chainId);
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexChain }] });
      setChainId(prenaPublicConfig.chainId);
      return true;
    } catch (cause) {
      const code = (cause as { code?: number })?.code;
      // 4902 — the wallet does not know this chain yet.
      if (code === 4902 && prenaPublicConfig.rpcUrl) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: hexChain,
                chainName: prenaPublicConfig.chainName,
                rpcUrls: [prenaPublicConfig.rpcUrl],
                nativeCurrency: {
                  name: prenaPublicConfig.nativeSymbol,
                  symbol: prenaPublicConfig.nativeSymbol,
                  decimals: 18,
                },
                blockExplorerUrls: prenaPublicConfig.explorerUrl ? [prenaPublicConfig.explorerUrl] : undefined,
              },
            ],
          });
          setChainId(prenaPublicConfig.chainId);
          return true;
        } catch {
          setError('switch_failed');
          return false;
        }
      }
      setError(code === 4001 ? 'switch_rejected' : 'switch_failed');
      return false;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, []);

  const signMessage = useCallback(
    async (message: string): Promise<string | null> => {
      const provider = getProvider();
      if (!provider || !address) {
        setError('wallet_unavailable');
        return null;
      }
      try {
        const signature = (await provider.request({
          method: 'personal_sign',
          params: [toHex(message), address],
        })) as string;
        return signature;
      } catch {
        // 4001 (declined) and a provider failure are the same story to a user:
        // nothing was signed and nothing changed.
        setError('signature_rejected');
        return null;
      }
    },
    [address],
  );

  const linkWallet = useCallback(async (): Promise<boolean> => {
    const target = address ?? (await connect());
    if (!target) return false;
    setBusy(true);
    setError(null);
    try {
      const nonceResponse = await fetch('/api/wallet/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: target, chainId: chainId ?? prenaPublicConfig.chainId, purpose: 'link' }),
      });
      const challenge = (await nonceResponse.json().catch(() => null)) as
        | { nonce: string; message: string; error?: string }
        | null;
      if (!nonceResponse.ok || !challenge?.message) {
        setError(challenge?.error ?? 'connect_failed');
        return false;
      }

      const signature = await signMessage(challenge.message);
      if (!signature) return false;

      const linkResponse = await fetch('/api/wallet/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce: challenge.nonce, message: challenge.message, signature }),
      });
      const payload = (await linkResponse.json().catch(() => null)) as { error?: string } | null;
      if (!linkResponse.ok) {
        setError(payload?.error ?? 'connect_failed');
        return false;
      }
      remember(true);
      await refreshWallets();
      return true;
    } catch {
      setError('network_error');
      return false;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [address, chainId, connect, refreshWallets, signMessage]);

  const unlinkWallet = useCallback(
    async (walletId: string): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch('/api/wallet/unlink', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletId }),
        });
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) {
          setError(payload?.error ?? 'network_error');
          return false;
        }
        disconnect();
        await refreshWallets();
        return true;
      } catch {
        setError('network_error');
        return false;
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [disconnect, refreshWallets],
  );

  const sendTokenTransfer = useCallback<WalletContextValue['sendTokenTransfer']>(
    async ({ tokenContract, to, amount }) => {
      const provider = getProvider();
      if (!provider || !address) return { error: 'wallet_unavailable' };
      if (!tokenContract) return { error: 'prena_not_configured' };
      if (chainId !== null && chainId !== prenaPublicConfig.chainId) return { error: 'wrong_network' };
      try {
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [to as `0x${string}`, BigInt(amount)],
        });
        const txHash = (await provider.request({
          method: 'eth_sendTransaction',
          params: [{ from: address, to: tokenContract, data, value: '0x0' }],
        })) as string;
        return { txHash };
      } catch (cause) {
        const code = (cause as { code?: number })?.code;
        return { error: code === 4001 ? 'transaction_rejected' : 'transaction_failed' };
      }
    },
    [address, chainId],
  );

  const mobileWalletUrl = useMemo(() => {
    if (typeof window === 'undefined') return null;
    if (getProvider()) return null;
    const isMobile = /android|iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (!isMobile) return null;
    // Opens the current page inside a mobile wallet's in-app browser.
    return `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      status,
      address,
      chainId,
      wrongNetwork: status === 'connected' && chainId !== null && chainId !== prenaPublicConfig.chainId,
      expectedChainId: prenaPublicConfig.chainId,
      expectedChainName: prenaPublicConfig.chainName,
      error,
      busy,
      linkedWallets,
      isLinked: Boolean(
        address && linkedWallets.some((wallet) => wallet.address === address && wallet.verifiedAt),
      ),
      connect,
      disconnect,
      switchNetwork,
      linkWallet,
      unlinkWallet,
      signMessage,
      sendTokenTransfer,
      refreshWallets,
      clearError: () => setError(null),
      mobileWalletUrl,
    }),
    [
      status,
      address,
      chainId,
      error,
      busy,
      linkedWallets,
      connect,
      disconnect,
      switchNetwork,
      linkWallet,
      unlinkWallet,
      signMessage,
      sendTokenTransfer,
      refreshWallets,
      mobileWalletUrl,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used inside <WalletProvider>');
  return context;
}

export { shortAddress };
