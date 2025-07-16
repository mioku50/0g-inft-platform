import { useAccount, useNetwork, useBalance } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';

export function WalletTest() {
  const { address, isConnected, connector } = useAccount();
  const { chain } = useNetwork();
  const { data: balance } = useBalance({ address });
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const logEvent = (event: string) => {
      const timestamp = new Date().toLocaleTimeString();
      setEvents(prev => [`${timestamp}: ${event}`, ...prev.slice(0, 9)]);
    };

    const handleAccountsChanged = (accounts: string[]) => {
      logEvent(`Accounts changed: ${accounts.join(', ') || 'none'}`);
    };

    const handleChainChanged = (chainId: string) => {
      logEvent(`Chain changed: ${chainId}`);
    };

    const handleConnect = (info: any) => {
      logEvent(`Connected: ${JSON.stringify(info)}`);
    };

    const handleDisconnect = (error: any) => {
      logEvent(`Disconnected: ${error?.message || 'user action'}`);
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('connect', handleConnect);
    window.ethereum.on('disconnect', handleDisconnect);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
      window.ethereum.removeListener('connect', handleConnect);
      window.ethereum.removeListener('disconnect', handleDisconnect);
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet Connection Test</CardTitle>
        <CardDescription>
          Debug information for wallet connection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Connection Status</span>
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>

        {/* Connector */}
        {connector && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Connector</span>
            <span className="text-sm text-muted-foreground">
              {connector.name} (ID: {connector.id})
            </span>
          </div>
        )}

        {/* Address */}
        {address && (
          <div className="space-y-1">
            <span className="text-sm font-medium">Address</span>
            <p className="text-xs font-mono bg-muted p-2 rounded">
              {address}
            </p>
          </div>
        )}

        {/* Chain */}
        {chain && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Chain</span>
            <Badge variant={chain.id === 16600 ? 'default' : 'destructive'}>
              {chain.name} ({chain.id})
            </Badge>
          </div>
        )}

        {/* Balance */}
        {balance && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Balance</span>
            <span className="text-sm text-muted-foreground">
              {balance.formatted} {balance.symbol}
            </span>
          </div>
        )}

        {/* MetaMask Status */}
        <div className="space-y-2">
          <span className="text-sm font-medium">MetaMask Status</span>
          <div className="text-xs space-y-1 bg-muted p-2 rounded">
            <p>Installed: {typeof window !== 'undefined' && window.ethereum ? 'Yes' : 'No'}</p>
            {typeof window !== 'undefined' && window.ethereum && (
              <>
                <p>Connected: {window.ethereum.isConnected() ? 'Yes' : 'No'}</p>
                <p>Selected Address: {window.ethereum.selectedAddress || 'None'}</p>
                <p>Chain ID: {window.ethereum.chainId || 'Unknown'}</p>
              </>
            )}
          </div>
        </div>

        {/* Events Log */}
        <div className="space-y-2">
          <span className="text-sm font-medium">Events Log</span>
          <div className="text-xs space-y-1 bg-muted p-2 rounded max-h-32 overflow-y-auto">
            {events.length > 0 ? (
              events.map((event, i) => (
                <p key={i} className="font-mono">{event}</p>
              ))
            ) : (
              <p className="text-muted-foreground">No events yet...</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 space-y-2">
          <button
            onClick={() => window.location.reload()}
            className="w-full text-sm bg-secondary hover:bg-secondary/80 p-2 rounded"
          >
            Reload Page
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('wagmi.cache');
              localStorage.removeItem('wagmi.store');
              localStorage.removeItem('wagmi.wallet');
              window.location.reload();
            }}
            className="w-full text-sm bg-secondary hover:bg-secondary/80 p-2 rounded"
          >
            Clear Cache & Reload
          </button>
        </div>
      </CardContent>
    </Card>
  );
}