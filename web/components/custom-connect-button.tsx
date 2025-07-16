import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useNetwork, useSwitchNetwork, useDisconnect } from 'wagmi';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export const CustomConnectButton = () => {
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  const { switchNetwork } = useSwitchNetwork();
  const { disconnect } = useDisconnect();

  // Auto-switch to 0G Galileo if on wrong network
  useEffect(() => {
    if (isConnected && chain && chain.id !== 16601 && switchNetwork) {
      console.log('Wrong network detected, switching to 0G Galileo...');
      switchNetwork(16601);
    }
  }, [chain, isConnected, switchNetwork]);

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus ||
            authenticationStatus === 'authenticated');

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              'style': {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <Button onClick={openConnectModal} variant="default">
                    Connect Wallet
                  </Button>
                );
              }

              if (chain.unsupported) {
                return (
                  <Button 
                    onClick={openChainModal} 
                    variant="destructive"
                    className="gap-2"
                  >
                    <AlertCircle className="h-4 w-4" />
                    Wrong network
                  </Button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={openChainModal}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    {chain.hasIcon && (
                      <div
                        className="h-4 w-4 rounded-full overflow-hidden"
                        style={{ background: chain.iconBackground }}
                      >
                        {chain.iconUrl && (
                          <img
                            alt={chain.name ?? 'Chain icon'}
                            src={chain.iconUrl}
                            className="h-4 w-4"
                          />
                        )}
                      </div>
                    )}
                    {chain.name}
                  </Button>

                  <Button
                    onClick={openAccountModal}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    {account.displayName}
                    {account.displayBalance
                      ? ` (${account.displayBalance})`
                      : ''}
                  </Button>

                  <Button
                    onClick={() => disconnect()}
                    variant="ghost"
                    size="sm"
                  >
                    Disconnect
                  </Button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};