'use client';
import { useState } from 'react';
import { Web3Provider } from './providers';
import Hero from './components/Hero';
import TableList from './components/NftTableList';
import KindredSpiritsList from './components/KindredSpiritsList';
import { EnsContext } from './components/context/EnsContext';
import { FetchDataProvider } from './components/context/KindredButtonContext';

export default function App() {
  const [ensAddress, setEnsAddress] = useState(null);

  return (
    <Web3Provider>
      <EnsContext.Provider value={{ ensAddress, setEnsAddress }}>
        <FetchDataProvider>
          <Hero />
          <KindredSpiritsList />
          <TableList />
        </FetchDataProvider>
      </EnsContext.Provider>
    </Web3Provider>
  );
}
