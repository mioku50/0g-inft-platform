'use client';

import * as React from 'react';
import {
  RainbowKitProvider,
  getDefaultWallets,
  connectorsForWallets,
  darkTheme,
} from '@rainbow-me/rainbowkit';
import {
  argentWallet,
  trustWallet,
  ledgerWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { configureChains, createConfig, WagmiConfig, useAccount } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';
import type { Chain } from 'wagmi';
import '@rainbow-me/rainbowkit/styles.css';

// Define 0G Newton Testnet
const ogNewton: Chain = {
  id: 16600,
  name: '0G Newton Testnet',
  network: '0g-newton-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'A0GI',
    symbol: 'A0GI',
  },
  rpcUrls: {
    default: {
      http: ['https://evmrpc-testnet.0g.ai'],
    },
    public: {
      http: ['https://evmrpc-testnet.0g.ai'],
    },
  },
  blockExplorers: {
    default: {
      name: '0G Explorer',
      url: 'https://chainscan-galileo.0g.ai',
    },
  },
  testnet: true,
};

// Configure chains with better caching
const { chains, publicClient, webSocketPublicClient } = configureChains(
  [ogNewton],
  [
    jsonRpcProvider({
      rpc: (chain) => ({
        http: chain.rpcUrls.default.http[0],
      }),
    }),
    publicProvider(),
  ],
  {
    pollingInterval: 10_000, // 10 seconds
    stallTimeout: 5_000,
  }
);

// Configure wallet connectors
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

const { wallets } = getDefaultWallets({
  appName: '0G INFT Platform',
  projectId,
  chains,
});

const connectors = connectorsForWallets([
  ...wallets,
  {
    groupName: 'Other',
    wallets: [
      argentWallet({ projectId, chains }),
      trustWallet({ projectId, chains }),
      ledgerWallet({ projectId, chains }),
    ],
  },
]);

// Create wagmi config with better settings
const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
  webSocketPublicClient,
});

// Hook to handle account changes
function AccountChangeHandler() {
  const { address } = useAccount();
  const prevAddressRef = React.useRef<string | undefined>();

  React.useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Check if address changed
    if (prevAddressRef.current !== undefined && prevAddressRef.current !== address) {
      console.log('Account changed from', prevAddressRef.current, 'to', address);
      
      // Clear any cached data
      if (window.localStorage) {
        // Clear specific wagmi cache items if needed
        const keysToRemove = ['wagmi.cache', 'wagmi.store'];
        keysToRemove.forEach(key => {
          try {
            window.localStorage.removeItem(key);
          } catch (e) {
            console.error('Failed to clear cache:', e);
          }
        });
      }
    }

    prevAddressRef.current = address;
  }, [address]);

  // Listen to MetaMask specific events
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      console.log('MetaMask accounts changed:', accounts);
      
      // Force wagmi to reconnect
      if (accounts.length === 0) {
        // User disconnected
        window.location.reload();
      } else if (prevAddressRef.current && accounts[0] !== prevAddressRef.current) {
        // Account switched - reload to ensure clean state
        window.location.reload();
      }
    };

    const handleChainChanged = (chainId: string) => {
      console.log('Chain changed to:', chainId);
      // Always reload on chain change to ensure proper state
      window.location.reload();
    };

    // Add listeners
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    // Cleanup
    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  return null;
}

// Main providers component
export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent SSR issues
  if (!mounted) {
    return null;
  }

  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider
        chains={chains}
        theme={darkTheme({
          accentColor: '#7b3ff2',
          accentColorForeground: 'white',
          borderRadius: 'medium',
          fontStack: 'system',
          overlayBlur: 'small',
        })}
        appInfo={{
          appName: '0G INFT Platform',
          learnMoreUrl: 'https://docs.0g.ai',
        }}
        showRecentTransactions={true}
      >
        <AccountChangeHandler />
        {children}
      </RainbowKitProvider>
    </WagmiConfig>
  );
}