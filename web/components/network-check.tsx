import { useNetwork, useSwitchNetwork } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

const GALILEO_CHAIN_ID = 16601;

export function NetworkCheck() {
  const { chain } = useNetwork();
  const { switchNetwork, isLoading, error } = useSwitchNetwork();

  const isCorrectNetwork = chain?.id === GALILEO_CHAIN_ID;

  if (!chain) {
    return null; // Don't show if not connected
  }

  if (isCorrectNetwork) {
    return (
      <Card className="border-green-500 bg-green-50 dark:bg-green-950">
        <CardContent className="flex items-center gap-2 pt-6">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-sm text-green-700 dark:text-green-300">
            Connected to 0G Galileo Testnet
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
          <AlertCircle className="h-5 w-5" />
          Wrong Network
        </CardTitle>
        <CardDescription>
          Please switch to 0G Galileo Testnet to continue
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Network:</span>
            <span className="font-medium">{chain.name} (ID: {chain.id})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Required Network:</span>
            <span className="font-medium">0G Galileo (ID: {GALILEO_CHAIN_ID})</span>
          </div>
        </div>

        {switchNetwork && (
          <Button
            onClick={() => switchNetwork(GALILEO_CHAIN_ID)}
            disabled={isLoading}
            className="w-full"
            variant="default"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Switching...
              </>
            ) : (
              'Switch to 0G Galileo'
            )}
          </Button>
        )}

        {error && (
          <p className="text-sm text-destructive">
            Error: {error.message}
          </p>
        )}

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-2">
            Or add the network manually:
          </p>
          <div className="text-xs space-y-1 bg-muted p-3 rounded-md font-mono">
            <p>Network: 0G-Galileo-Testnet</p>
            <p>RPC: https://evmrpc-testnet.0g.ai</p>
            <p>Chain ID: 16601</p>
            <p>Symbol: OG</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}