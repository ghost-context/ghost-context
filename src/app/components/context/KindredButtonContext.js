import { createContext, useState } from 'react';

export const KindredButtonContext = createContext();

export const FetchDataProvider = ({ children }) => {
  const [selectedCollectionsContext, setSelectedCollectionsContext] = useState([]);
  const [triggerKindredSpirits, setTriggerKindredSpirits] = useState(false);
  const [ownedCollections, setOwnedCollections] = useState([]);
  const [showKindredSpirits, setShowKindredSpirits] = useState(false);


  return (
    <KindredButtonContext.Provider
      value={{
        selectedCollectionsContext,
        setSelectedCollectionsContext,
        triggerKindredSpirits,
        setTriggerKindredSpirits,
        ownedCollections,
        setOwnedCollections,
        showKindredSpirits,
        setShowKindredSpirits
      }}
    >
      {children}
    </KindredButtonContext.Provider>
  );
};

