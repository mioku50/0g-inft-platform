import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NATIVE_SYMBOL } from '@/lib/constants';

interface SystemStatus {
  network: {
    connected: boolean;
    blockNumber: number;
  };
  wallets: {
    storage: {
      configured: boolean;
      address: string;
      balance: string;
      sufficient: boolean;
    };
    compute: {
      configured: boolean;
      address: string;
      balance: string;
      sufficient: boolean;
    };
  };
  storage: {
    healthy: boolean;
    details: any;
  };
}

export function SystemCheck() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkSystem = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/storage/health');
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Health check failed');
      }
      
      setStatus(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSystem();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            System Check Failed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={checkSystem} variant="outline" size="sm">
            Retry Check
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!status) return null;

  const allGood = 
    status.network.connected &&
    status.wallets.storage.configured &&
    status.wallets.storage.sufficient &&
    status.wallets.compute.configured &&
    status.wallets.compute.sufficient &&
    status.storage.healthy;

  return (
    <Card className={allGood ? 'border-green-500' : 'border-yellow-500'}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {allGood ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-500" />
              System Ready
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              System Check
            </>
          )}
        </CardTitle>
        <CardDescription>
          Platform status and wallet balances
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Network Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">0G Network</span>
          <div className="flex items-center gap-2">
            {status.network.connected ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            <span className="text-sm text-muted-foreground">
              Block #{status.network.blockNumber}
            </span>
          </div>
        </div>

        {/* Storage Wallet */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Storage Wallet</span>
            {status.wallets.storage.configured ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
          </div>
          {status.wallets.storage.configured && (
            <div className="text-xs space-y-1 ml-4">
              <p className="font-mono text-muted-foreground">
                {status.wallets.storage.address}
              </p>
              <p className={status.wallets.storage.sufficient ? 'text-green-600' : 'text-destructive'}>
                Balance: {status.wallets.storage.balance}
                {!status.wallets.storage.sufficient && ` (Insufficient - need 0.1+ ${NATIVE_SYMBOL})`}
              </p>
            </div>
          )}
        </div>

        {/* Compute Wallet */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Compute Wallet</span>
            {status.wallets.compute.configured ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
          </div>
          {status.wallets.compute.configured && (
            <div className="text-xs space-y-1 ml-4">
              <p className="font-mono text-muted-foreground">
                {status.wallets.compute.address}
              </p>
              <p className={status.wallets.compute.sufficient ? 'text-green-600' : 'text-destructive'}>
                Balance: {status.wallets.compute.balance}
                {!status.wallets.compute.sufficient && ` (Insufficient - need 0.1+ ${NATIVE_SYMBOL})`}
              </p>
            </div>
          )}
        </div>

        {/* Storage Health */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">0G Storage</span>
          <div className="flex items-center gap-2">
            {status.storage.healthy ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            <span className="text-sm text-muted-foreground">
              {status.storage.healthy ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        {!allGood && (
          <div className="pt-2 space-y-2">
            {(!status.wallets.storage.sufficient || !status.wallets.compute.sufficient) && (
              <div className="p-3 bg-yellow-50 rounded-md">
                <p className="text-sm text-yellow-800">
                  ⚠️ Please add funds to your wallets:
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Visit <a href="https://faucet.0g.ai" target="_blank" rel="noopener noreferrer" className="underline">0G Faucet</a> to get testnet tokens
                </p>
              </div>
            )}
            
            <Button onClick={checkSystem} variant="outline" size="sm" className="w-full">
              Refresh Status
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}