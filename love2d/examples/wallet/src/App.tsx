import React from 'react';
import { WalletProvider, useWallet } from './wallet/context';
import { Welcome } from './screens/Welcome';
import { CreateWallet } from './screens/CreateWallet';
import { ImportWallet } from './screens/ImportWallet';
import { SetPassword } from './screens/SetPassword';
import { Unlock } from './screens/Unlock';
import { Dashboard } from './screens/Dashboard';
import { Send } from './screens/Send';
import { Receive } from './screens/Receive';
import { Settings } from './screens/Settings';

function Router() {
  const { state } = useWallet();

  switch (state.screen) {
    case 'welcome':
      return <Welcome />;
    case 'create':
    case 'create-confirm':
      return <CreateWallet />;
    case 'import':
      return <ImportWallet />;
    case 'create-password':
      return <SetPassword />;
    case 'unlock':
      return <Unlock />;
    case 'dashboard':
      return <Dashboard />;
    case 'send':
    case 'send-confirm':
      return <Send />;
    case 'receive':
      return <Receive />;
    case 'settings':
      return <Settings />;
    default:
      return <Welcome />;
  }
}

export function App() {
  return (
    <WalletProvider>
      <Router />
    </WalletProvider>
  );
}
