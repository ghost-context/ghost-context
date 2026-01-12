'use client';
import { useState, useMemo } from 'react';
import { Web3Provider } from './providers';
import Hero from './components/Hero';
import TableList from './components/NftTableList';
import KindredSpiritsList from './components/KindredSpiritsList';
import { EnsContext } from './components/context/EnsContext';
import { FetchDataProvider } from './components/context/KindredButtonContext';

export default function App() {
  const [ensAddress, setEnsAddress] = useState(null);

  // Memoize context value to prevent unnecessary re-renders
  const ensContextValue = useMemo(
    () => ({ ensAddress, setEnsAddress }),
    [ensAddress]
  );

  return (
    <Web3Provider>
      <EnsContext.Provider value={ensContextValue}>
        <FetchDataProvider>
          <Hero />
          <KindredSpiritsList />
          <TableList />
        </FetchDataProvider>
      </EnsContext.Provider>
    </Web3Provider>
  );
}
