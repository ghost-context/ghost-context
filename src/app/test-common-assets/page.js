'use client';

import { useState, useEffect } from 'react';
import { NeynarClient } from '../neynar';
import { AlchemyMultichainClient } from '../alchemy-multichain-client';
import { PoapClient } from '../poap-client';

const neynar = new NeynarClient();

// Simplified components for test page
const SimpleAddress = ({ address }) => {
  const [ensName, setEnsName] = useState(null);
  
  useEffect(() => {
    const fetchENS = async () => {
      try {
        const response = await fetch(`https://api.ensideas.com/ens/resolve/${address}`);
        const data = await response.json();
        if (data.name) setEnsName(data.name);
      } catch (error) {
        // Silently fail
      }
    };
    if (address && address.startsWith('0x')) {
      fetchENS();
    }
  }, [address]);

  const displayAddress = ensName || `${address.slice(0, 6)}...${address.slice(-4)}`;
  
  return <span>{displayAddress}</span>;
};

const TestSocialCard = ({ address, count }) => {
  const [socials, setSocials] = useState([]);
  const [image, setImage] = useState("/kindredSpirit.png");

  useEffect(() => {
    const fetchSocials = async () => {
      try {
        const result = await neynar.socialLookup(address);
        const farcasterOnly = Array.isArray(result) ? result.filter(s => s.dappName === 'farcaster') : [];
        setSocials(farcasterOnly);
        const profileImage = farcasterOnly.find(social => (social.profileImage || '').startsWith('http'))?.profileImage;
        if (profileImage) setImage(profileImage);
      } catch (error) {
        // Silently fail
      }
    };
    fetchSocials();
  }, [address]);

  return (
    <div className="flex items-center gap-x-3">
      <img
        src={image}
        alt={`Kindred Spirit`}
        className="h-6 w-6 flex-none rounded-full bg-gray-800"
      />
      <div>
        <h3 className="truncate text-sm font-semibold leading-6">
          <SimpleAddress address={address} />
        </h3>
        <div className="flex flex-wrap">
          {Array.isArray(socials) && socials.map((social, index) => (
            <div key={index} className="flex items-center mr-2">
              <a href={social.link} target="_blank" rel="noopener noreferrer">
                <img 
                  src={`/networks/farcaster.svg`} 
                  alt={social.dappName} 
                  title={social.profileName} 
                  className="h-4 w-4 mr-2" 
                />
              </a>
              <div className="flex flex-col text-sm leading-6">
                <a target="_blank" href={social.link} className="text-purple-400 hover:text-purple-300">
                  {social.profileName}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function TestCommonAssetsPage() {
  const [walletAddress, setWalletAddress] = useState('0x1b4a302D15412655877d86ae82823D8F6d085ddD');
  const [ensName, setEnsName] = useState('');
  const [walletInput, setWalletInput] = useState('0x1b4a302D15412655877d86ae82823D8F6d085ddD');
  const [step, setStep] = useState(1); // 1 = fetch, 2 = select assets, 3 = select spirits, 4 = show common assets
  const [loading, setLoading] = useState(false);
  
  // Asset lists
  const [nftCollections, setNftCollections] = useState([]);
  const [poapEvents, setPoapEvents] = useState([]);
  const [erc20Tokens, setErc20Tokens] = useState([]);
  
  // Selected assets (for kindred spirit analysis)
  const [selectedNFTs, setSelectedNFTs] = useState(new Set());
  const [selectedPOAPs, setSelectedPOAPs] = useState(new Set());
  const [selectedERC20s, setSelectedERC20s] = useState(new Set());
  
  // Search filters
  const [erc20Search, setErc20Search] = useState('');
  const [nftSearch, setNftSearch] = useState('');
  const [poapSearch, setPoapSearch] = useState('');
  
  // Kindred spirit results
  const [kindredSpirits, setKindredSpirits] = useState([]);
  const [analysisResults, setAnalysisResults] = useState(null);
  
  // Selected spirits (for common asset analysis)
  const [selectedSpirits, setSelectedSpirits] = useState(new Set());
  
  // Include source wallet in common assets analysis
  const [includeSourceWallet, setIncludeSourceWallet] = useState(true);
  
  // Common assets results
  const [commonAssets, setCommonAssets] = useState(null);
  
  // Selected common assets (for recursive kindred spirit analysis)
  const [selectedCommonNFTs, setSelectedCommonNFTs] = useState(new Set());
  const [selectedCommonPOAPs, setSelectedCommonPOAPs] = useState(new Set());
  const [selectedCommonERC20s, setSelectedCommonERC20s] = useState(new Set());
  
  // Search filters for common assets
  const [commonErc20Search, setCommonErc20Search] = useState('');
  const [commonNftSearch, setCommonNftSearch] = useState('');
  const [commonPoapSearch, setCommonPoapSearch] = useState('');
  
  const [error, setError] = useState('');
  
  // Progress tracking
  const [progress, setProgress] = useState({
    show: false,
    stage: '',
    current: 0,
    total: 0,
    message: '',
    isProcessing: false,
    elapsedSeconds: 0
  });

  // Timer effect for processing stages
  useEffect(() => {
    let interval;
    if (progress.isProcessing) {
      interval = setInterval(() => {
        setProgress(prev => ({
          ...prev,
          elapsedSeconds: prev.elapsedSeconds + 1
        }));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [progress.isProcessing]);

  // Resolve ENS name to address
  const resolveENSToAddress = async (input) => {
    try {
      const response = await fetch(`https://api.ensideas.com/ens/resolve/${input}`);
      const data = await response.json();
      return data.address || null;
    } catch (error) {
      return null;
    }
  };

  // Resolve address to ENS name
  const resolveAddressToENS = async (address) => {
    try {
      const response = await fetch(`https://api.ensideas.com/ens/resolve/${address}`);
      const data = await response.json();
      return data.name || '';
    } catch (error) {
      return '';
    }
  };

  // Step 1: Fetch all assets
  const fetchAssets = async (addressOverride = null) => {
    // Use addressOverride if provided, otherwise use walletInput from state
    let targetInput = addressOverride || walletInput;
    
    if (!targetInput || targetInput.trim() === '') {
      setError('Please enter a wallet address or ENS name');
      return;
    }

    targetInput = targetInput.trim();
    let targetAddress = targetInput;
    
    // If input doesn't look like an address, try to resolve as ENS
    if (!targetInput.startsWith('0x')) {
      setError('Resolving ENS name...');
      const resolved = await resolveENSToAddress(targetInput);
      if (!resolved) {
        setError('Invalid ENS name or wallet address');
        return;
      }
      targetAddress = resolved;
      setEnsName(targetInput); // Store the ENS name
    } else if (!targetInput.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Invalid wallet address format');
      return;
    } else {
      // Resolve address to ENS name
      const ens = await resolveAddressToENS(targetAddress);
      setEnsName(ens);
    }
    
    // Update state with resolved address
    setWalletAddress(targetAddress);
    setWalletInput(targetAddress);
    
    setLoading(true);
    setError('');
    setNftCollections([]);
    setPoapEvents([]);
    setErc20Tokens([]);
    setSelectedNFTs(new Set());
    setSelectedPOAPs(new Set());
    setSelectedERC20s(new Set());
    setKindredSpirits([]);
    setSelectedSpirits(new Set());
    setCommonAssets(null);
    setAnalysisResults(null);
    
    setProgress({
      show: true,
      stage: 'Fetching Assets',
      current: 0,
      total: 3,
      message: 'Loading your tokens, NFTs, and POAPs...'
    });

    try {
      let hasAssets = false;

      // 1. Fetch ERC-20 tokens
      setProgress(prev => ({ ...prev, current: 1, message: 'Fetching ERC-20 tokens...' }));
      try {
        const erc20Response = await fetch(`/api/get-filtered-tokens?address=${targetAddress}`);
        const erc20Data = await erc20Response.json();
        if (erc20Response.ok && erc20Data.filteredTokens?.length > 0) {
          setErc20Tokens(erc20Data.filteredTokens);
          hasAssets = true;
        }
      } catch (err) {
        console.warn('Failed to fetch ERC-20 tokens:', err.message);
      }

      // 2. Fetch NFT Collections
      setProgress(prev => ({ ...prev, current: 2, message: 'Fetching NFT collections...' }));
      try {
        const alchemy = new AlchemyMultichainClient();
        const collections = await alchemy.getCollectionsForOwner(targetAddress, 'relevant');
        
        // Extract POAPs
        const alchemyPOAPs = collections.filter(nft => 
          nft.network === 'POAP' || nft.network?.toLowerCase().includes('poap')
        );
        
        const alchemyPOAPEvents = alchemyPOAPs.map(poap => {
          const eventId = poap.contract_address?.replace('poap:', '') || '';
          return {
            eventId: eventId,
            name: poap.name || 'Unknown POAP',
            image: poap.image_small_url || poap.image,
            ownerCount: poap.distinct_owner_count || 0,
            source: 'alchemy'
          };
        }).filter(p => p.eventId);
        
        // Filter out POAPs from NFT collections
        const filteredCollections = collections.filter(nft => 
          nft.network !== 'POAP' && !nft.network?.toLowerCase().includes('poap')
        );
        
        const allNFTs = filteredCollections.map(nft => ({
          id: `${nft.network}-${nft.contract_address}`,
          address: nft.contract_address,
          network: nft.network,
          name: nft.name || 'Unknown Collection',
          image: nft.image_small_url || nft.image,
          totalBalance: nft.totalBalance,
          tokenType: nft.token_type || 'UNKNOWN'
        }));
        
        if (allNFTs.length > 0) {
          setNftCollections(allNFTs);
          hasAssets = true;
        }
        
        window.__alchemyPOAPs = alchemyPOAPEvents;
      } catch (err) {
        console.warn('Failed to fetch NFT collections:', err.message);
      }

      // 3. Fetch POAP Events
      setProgress(prev => ({ ...prev, current: 3, message: 'Fetching POAP events...' }));
      try {
        const poapClient = new PoapClient();
        const poapData = await poapClient.scanAddress(targetAddress);
        // API returns 'events' not 'poaps'
        const poaps = poapData?.events || poapData?.poaps || [];
        
        const uniqueEvents = new Map();
        for (const poap of poaps) {
          // API returns flat structure: { id, name, image_url }
          const eventId = poap.id || poap.event?.id || poap.eventId;
          const eventName = poap.name || poap.event?.name || 'Unknown Event';
          
          if (eventId && !uniqueEvents.has(String(eventId))) {
            uniqueEvents.set(String(eventId), {
              eventId: String(eventId),
              name: eventName,
              image: poap.image_url || poap.event?.image_url || poap.imageUrl,
              source: 'poap-api'
            });
          }
        }
        
        // Merge with Alchemy POAPs
        const alchemyPOAPs = window.__alchemyPOAPs || [];
        for (const poap of alchemyPOAPs) {
          if (poap.eventId) {
            const existing = uniqueEvents.get(String(poap.eventId));
            if (!existing) {
              uniqueEvents.set(String(poap.eventId), poap);
            } else if (poap.ownerCount && !existing.ownerCount) {
              existing.ownerCount = poap.ownerCount;
            }
          }
        }
        
        const poapArray = Array.from(uniqueEvents.values());
        
        if (poapArray.length > 0) {
          setPoapEvents(poapArray);
          hasAssets = true;
        }
      } catch (err) {
        console.warn('Failed to fetch POAPs:', err.message);
      }

      if (hasAssets) {
        setStep(2);
      } else {
        setError('No assets found for this wallet');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress({ show: false, stage: '', current: 0, total: 0, message: '', isProcessing: false, elapsedSeconds: 0 });
    }
  };

  // Fetch NFT owner counts (batch processing)
  const fetchNFTOwnerCounts = async () => {
    if (nftCollections.length === 0) return;
    
    setLoading(true);
    setProgress({
      show: true,
      stage: 'Fetching Owner Counts',
      current: 0,
      total: nftCollections.length,
      message: 'Loading owner counts for NFT collections...',
      isProcessing: false,
      elapsedSeconds: 0
    });

    const alchemy = new AlchemyMultichainClient();
    const BATCH_SIZE = 10;
    const updatedNFTs = [...nftCollections];

    for (let i = 0; i < updatedNFTs.length; i += BATCH_SIZE) {
      const batch = updatedNFTs.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (nft, idx) => {
        try {
          const ownerCount = await alchemy.getOwnersCountForContract(nft.network, nft.address);
          updatedNFTs[i + idx].ownerCount = ownerCount;
        } catch (err) {
          // Silently skip errors
        }
      }));
      
      setProgress(prev => ({ ...prev, current: Math.min(i + BATCH_SIZE, updatedNFTs.length) }));
    }

    setNftCollections(updatedNFTs);
    setLoading(false);
    setProgress({ show: false, stage: '', current: 0, total: 0, message: '', isProcessing: false, elapsedSeconds: 0 });
  };

  // Step 2: Analyze selected assets for kindred spirits
  const analyzeOverlap = async () => {
    setLoading(true);
    setError('');
    setKindredSpirits([]);
    setAnalysisResults(null);

    try {
      const nftsToAnalyze = Array.from(selectedNFTs).map(id => 
        nftCollections.find(n => n.id === id)
      ).filter(Boolean);
      const poapsToAnalyze = Array.from(selectedPOAPs).map(eventId => 
        poapEvents.find(p => p.eventId === eventId)
      ).filter(Boolean);
      const erc20sToAnalyze = Array.from(selectedERC20s).map(address => 
        erc20Tokens.find(t => t.address === address)
      ).filter(Boolean);

      const totalAssets = nftsToAnalyze.length + poapsToAnalyze.length + erc20sToAnalyze.length;
      
      setProgress({
        show: true,
        stage: 'Analyzing Overlap',
        current: 0,
        total: totalAssets,
        message: `Finding kindred spirits across ${totalAssets} asset${totalAssets !== 1 ? 's' : ''}...`,
        isProcessing: true,
        elapsedSeconds: 0
      });

      const response = await fetch('/api/analyze-combined-overlap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: walletAddress,
          nfts: nftsToAnalyze,
          poaps: poapsToAnalyze,
          erc20s: erc20sToAnalyze
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to analyze overlap');
      } else {
        setKindredSpirits(data.kindredSpirits || []);
        setAnalysisResults(data);
        if ((data.kindredSpirits || []).length > 0) {
          setStep(3);
        } else {
          setError('No kindred spirits found with the selected assets');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress({ show: false, stage: '', current: 0, total: 0, message: '', isProcessing: false, elapsedSeconds: 0 });
    }
  };

  // Toggle asset selection
  const toggleAsset = (type, id) => {
    const setterMap = {
      nft: [selectedNFTs, setSelectedNFTs],
      poap: [selectedPOAPs, setSelectedPOAPs],
      erc20: [selectedERC20s, setSelectedERC20s]
    };
    
    const [selected, setSelected] = setterMap[type];
    const newSelected = new Set(selected);
    
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    
    setSelected(newSelected);
  };

  // Toggle spirit selection
  const toggleSpirit = (address) => {
    const newSelected = new Set(selectedSpirits);
    if (newSelected.has(address)) {
      newSelected.delete(address);
    } else {
      if (newSelected.size >= 20) {
        setError('Maximum 20 wallets can be selected');
        return;
      }
      newSelected.add(address);
    }
    setSelectedSpirits(newSelected);
    setError('');
  };

  // Select/Deselect all spirits
  const selectAllSpirits = () => {
    const addresses = kindredSpirits.slice(0, 20).map(s => s.address);
    setSelectedSpirits(new Set(addresses));
  };

  const clearAllSpirits = () => {
    setSelectedSpirits(new Set());
  };

  // Chain analysis: Fetch assets from a single kindred spirit
  const analyzeKindredSpirit = (spiritAddress, event) => {
    // Prevent event bubbling
    if (event && event.stopPropagation) {
      event.stopPropagation();
      event.preventDefault();
    }
    
    // Validate address
    if (!spiritAddress || typeof spiritAddress !== 'string') {
      return;
    }
    
    // Reset state to Step 1
    setStep(1);
    setNftCollections([]);
    setPoapEvents([]);
    setErc20Tokens([]);
    setSelectedNFTs(new Set());
    setSelectedPOAPs(new Set());
    setSelectedERC20s(new Set());
    setKindredSpirits([]);
    setAnalysisResults(null);
    setSelectedSpirits(new Set());
    setCommonAssets(null);
    setSelectedCommonNFTs(new Set());
    setSelectedCommonPOAPs(new Set());
    setSelectedCommonERC20s(new Set());
    setError('');
    
    // Set new wallet address
    setWalletAddress(spiritAddress);
    
    // Fetch assets for the new address
    fetchAssets(spiritAddress);
  };

  // Toggle common asset selection
  const toggleCommonAsset = (type, id) => {
    const setterMap = {
      nft: [selectedCommonNFTs, setSelectedCommonNFTs],
      poap: [selectedCommonPOAPs, setSelectedCommonPOAPs],
      erc20: [selectedCommonERC20s, setSelectedCommonERC20s]
    };
    
    const [selected, setSelected] = setterMap[type];
    const newSelected = new Set(selected);
    
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    
    setSelected(newSelected);
  };

  // Analyze selected common assets (find NEW kindred spirits)
  const analyzeCommonAssets = async () => {
    const totalSelected = selectedCommonNFTs.size + selectedCommonPOAPs.size + selectedCommonERC20s.size;
    
    if (totalSelected === 0) {
      setError('Please select at least one common asset to analyze');
      return;
    }

    setLoading(true);
    setError('');
    setKindredSpirits([]);
    setAnalysisResults(null);
    setSelectedSpirits(new Set()); // Clear spirit selection for new analysis

    try {
      // Build arrays from selected common assets
      const nftsToAnalyze = Array.from(selectedCommonNFTs).map(id => 
        commonAssets.nfts.find(n => n.id === id)
      ).filter(Boolean);
      
      const poapsToAnalyze = Array.from(selectedCommonPOAPs).map(eventId => 
        commonAssets.poaps.find(p => p.eventId === eventId)
      ).filter(Boolean);
      
      const erc20sToAnalyze = Array.from(selectedCommonERC20s).map(address => 
        commonAssets.erc20s.find(t => t.address === address)
      ).filter(Boolean);

      setProgress({
        show: true,
        stage: 'Finding New Kindred Spirits',
        current: 0,
        total: totalSelected,
        message: `Analyzing ${totalSelected} common asset${totalSelected !== 1 ? 's' : ''}...`,
        isProcessing: true,
        elapsedSeconds: 0
      });

      const response = await fetch('/api/analyze-combined-overlap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: walletAddress,
          nfts: nftsToAnalyze,
          poaps: poapsToAnalyze,
          erc20s: erc20sToAnalyze
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to analyze common assets');
      } else {
        setKindredSpirits(data.kindredSpirits || []);
        setAnalysisResults(data);
        
        if ((data.kindredSpirits || []).length > 0) {
          // Clear common asset selections and go back to step 3
          setSelectedCommonNFTs(new Set());
          setSelectedCommonPOAPs(new Set());
          setSelectedCommonERC20s(new Set());
          setCommonAssets(null);
          setStep(3);
        } else {
          setError('No kindred spirits found with the selected common assets');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress({ show: false, stage: '', current: 0, total: 0, message: '', isProcessing: false, elapsedSeconds: 0 });
    }
  };

  // Step 3: Find common assets among selected spirits
  const findCommonAssets = async () => {
    // Determine minimum required selections based on includeSourceWallet
    const minRequired = includeSourceWallet ? 1 : 2;
    const totalWallets = includeSourceWallet ? selectedSpirits.size + 1 : selectedSpirits.size;
    
    if (selectedSpirits.size < minRequired) {
      setError(`Please select at least ${minRequired} wallet${minRequired > 1 ? 's' : ''}`);
      return;
    }

    setLoading(true);
    setError('');
    setCommonAssets(null);

    // Build list of addresses to analyze
    const selectedAddresses = Array.from(selectedSpirits);
    if (includeSourceWallet) {
      selectedAddresses.unshift(walletAddress); // Add source wallet at beginning
    }
    
    const totalSteps = selectedAddresses.length * 3;

    setProgress({
      show: true,
      stage: 'Fetching Assets',
      current: 0,
      total: totalSteps,
      message: `Fetching assets for ${selectedAddresses.length} wallets...`,
      isProcessing: false,
      elapsedSeconds: 0
    });

    try {
      const alchemy = new AlchemyMultichainClient();
      const poapClient = new PoapClient();
      
      // Fetch assets for all selected wallets
      const walletsAssets = [];
      let currentStep = 0;

      for (let walletIndex = 0; walletIndex < selectedAddresses.length; walletIndex++) {
        const address = selectedAddresses[walletIndex];
        const walletNumber = walletIndex + 1;
        const walletAssets = { address, nfts: [], poaps: [], erc20s: [] };

        // Fetch NFTs
        currentStep++;
        setProgress(prev => ({ ...prev, current: currentStep, message: `Fetching NFTs for wallet ${walletNumber}/${selectedAddresses.length}...` }));
        try {
          const collections = await alchemy.getCollectionsForOwner(address, 'relevant');
          const nftOnly = collections.filter(nft => 
            nft.network !== 'POAP' && !nft.network?.toLowerCase().includes('poap')
          );
          walletAssets.nfts = nftOnly.map(nft => ({
            id: `${nft.network}-${nft.contract_address}`,
            address: nft.contract_address,
            network: nft.network,
            name: nft.name || 'Unknown Collection',
            image: nft.image_small_url || nft.image
          }));
        } catch (err) {
          console.warn(`Failed to fetch NFTs for ${address}:`, err.message);
        }

        // Fetch POAPs
        currentStep++;
        setProgress(prev => ({ ...prev, current: currentStep, message: `Fetching POAPs for wallet ${walletNumber}/${selectedAddresses.length}...` }));
        try {
          const poapData = await poapClient.scanAddress(address);
          console.log(`POAP data for ${address.slice(0, 8)}...`, poapData);
          // API returns 'events' not 'poaps'
          const poaps = poapData?.events || poapData?.poaps || [];
          console.log(`Found ${poaps.length} POAPs for ${address.slice(0, 8)}...`);
          
          const uniqueEvents = new Map();
          for (const poap of poaps) {
            // API returns flat structure: { id, name, image_url }
            const eventId = poap.id || poap.event?.id || poap.eventId;
            if (eventId && !uniqueEvents.has(String(eventId))) {
              uniqueEvents.set(String(eventId), {
                eventId: String(eventId),
                name: poap.name || poap.event?.name || 'Unknown Event',
                image: poap.image_url || poap.event?.image_url || poap.imageUrl
              });
            }
          }
          walletAssets.poaps = Array.from(uniqueEvents.values());
          console.log(`Unique POAP events for ${address.slice(0, 8)}...:`, walletAssets.poaps.length);
        } catch (err) {
          console.error(`Failed to fetch POAPs for ${address}:`, err.message);
          console.error('Full error:', err);
        }

        // Fetch ERC-20s
        currentStep++;
        setProgress(prev => ({ ...prev, current: currentStep, message: `Fetching ERC-20s for wallet ${walletNumber}/${selectedAddresses.length}...` }));
        try {
          const erc20Response = await fetch(`/api/get-filtered-tokens?address=${address}`);
          const erc20Data = await erc20Response.json();
          if (erc20Response.ok && erc20Data.filteredTokens?.length > 0) {
            walletAssets.erc20s = erc20Data.filteredTokens.map(token => ({
              address: token.address,
              symbol: token.symbol,
              name: token.name,
              logo: token.logo,
              holderCount: token.holderCount // Preserve holder count for display
            }));
          }
        } catch (err) {
          console.warn(`Failed to fetch ERC-20s for ${address}:`, err.message);
        }

        walletsAssets.push(walletAssets);
      }

      // Calculate strict intersection
      setProgress({
        show: true,
        stage: 'Calculating Intersection',
        current: 0,
        total: 1,
        message: 'Finding assets common to all selected wallets...',
        isProcessing: true,
        elapsedSeconds: 0
      });

      // Debug: Log what we fetched for each wallet
      console.log('🔍 Common Assets Analysis - Fetched Assets:');
      walletsAssets.forEach((wallet, idx) => {
        console.log(`Wallet ${idx + 1} (${wallet.address.slice(0, 8)}...):`, {
          nfts: wallet.nfts.length,
          poaps: wallet.poaps.length,
          erc20s: wallet.erc20s.length,
          erc20Symbols: wallet.erc20s.map(t => t.symbol).join(', ')
        });
      });

      // NFT intersection - optimized: start with smallest set
      const nftSets = walletsAssets.map(w => new Set(w.nfts.map(nft => nft.id)));
      const sortedNFTSets = [...nftSets].sort((a, b) => a.size - b.size); // Smallest first
      const nftIntersectionIds = sortedNFTSets.reduce((acc, set) => 
        new Set([...acc].filter(x => set.has(x)))
      );
      // Get full objects from the wallet with smallest NFT count
      const smallestNFTWallet = walletsAssets.reduce((min, w) => 
        w.nfts.length < min.nfts.length ? w : min
      );
      const commonNFTs = smallestNFTWallet.nfts.filter(nft => nftIntersectionIds.has(nft.id));

      // POAP intersection - optimized: start with smallest set
      const poapSets = walletsAssets.map(w => new Set(w.poaps.map(p => p.eventId)));
      const sortedPOAPSets = [...poapSets].sort((a, b) => a.size - b.size); // Smallest first
      const poapIntersectionIds = sortedPOAPSets.reduce((acc, set) => 
        new Set([...acc].filter(x => set.has(x)))
      );
      // Get full objects from the wallet with smallest POAP count
      const smallestPOAPWallet = walletsAssets.reduce((min, w) => 
        w.poaps.length < min.poaps.length ? w : min
      );
      const commonPOAPs = smallestPOAPWallet.poaps.filter(poap => poapIntersectionIds.has(poap.eventId));

      // ERC-20 intersection - optimized: start with smallest set
      const erc20Sets = walletsAssets.map(w => new Set(w.erc20s.map(t => t.address.toLowerCase())));
      console.log('🪙 ERC-20 Sets:', erc20Sets.map((s, idx) => ({
        wallet: idx + 1,
        count: s.size,
        addresses: Array.from(s)
      })));
      
      const sortedERC20Sets = [...erc20Sets].sort((a, b) => a.size - b.size); // Smallest first
      const erc20IntersectionAddrs = sortedERC20Sets.reduce((acc, set) => 
        new Set([...acc].filter(x => set.has(x)))
      );
      console.log('🔗 ERC-20 Intersection:', {
        commonAddresses: Array.from(erc20IntersectionAddrs),
        count: erc20IntersectionAddrs.size
      });
      
      // Get full objects from the wallet with smallest ERC-20 count
      const smallestERC20Wallet = walletsAssets.reduce((min, w) => 
        w.erc20s.length < min.erc20s.length ? w : min
      );
      const commonERC20s = smallestERC20Wallet.erc20s.filter(token => 
        erc20IntersectionAddrs.has(token.address.toLowerCase())
      );
      console.log('✅ Common ERC-20s:', commonERC20s.map(t => `${t.symbol} (${t.address})`));

      const totalCommon = commonNFTs.length + commonPOAPs.length + commonERC20s.length;

      // Fetch owner/holder counts for common assets (in background, don't block results)
      setTimeout(async () => {
        try {
          // Fetch NFT owner counts
          if (commonNFTs.length > 0) {
            for (const nft of commonNFTs) {
              try {
                const ownerCount = await alchemy.getOwnersCountForContract(nft.network, nft.address);
                nft.ownerCount = ownerCount;
              } catch (err) {
                // Silently fail for individual NFTs
              }
            }
          }

          // Fetch POAP supply counts
          if (commonPOAPs.length > 0) {
            for (const poap of commonPOAPs) {
              try {
                const details = await poapClient.getEventDetails(poap.eventId);
                poap.supply = details.supply;
              } catch (err) {
                // Silently fail for individual POAPs
              }
            }
          }

          // Update state with all counts
          setCommonAssets(prev => ({
            ...prev,
            nfts: [...commonNFTs],
            poaps: [...commonPOAPs]
          }));
        } catch (err) {
          console.warn('Failed to fetch owner/holder counts:', err.message);
        }
      }, 100);

      // Calculate total assets across all wallets (before intersection)
      const totalNFTsAnalyzed = walletsAssets.reduce((sum, w) => sum + w.nfts.length, 0);
      const totalPOAPsAnalyzed = walletsAssets.reduce((sum, w) => sum + w.poaps.length, 0);
      const totalERC20sAnalyzed = walletsAssets.reduce((sum, w) => sum + w.erc20s.length, 0);
      const totalAssetsAnalyzed = totalNFTsAnalyzed + totalPOAPsAnalyzed + totalERC20sAnalyzed;

      console.log('📊 Common Assets Summary:', {
        totalWallets: selectedAddresses.length,
        totalAssetsAnalyzed,
        totalNFTsAnalyzed,
        totalPOAPsAnalyzed,
        totalERC20sAnalyzed,
        commonNFTs: commonNFTs.length,
        commonPOAPs: commonPOAPs.length,
        commonERC20s: commonERC20s.length,
        totalCommon
      });

      setCommonAssets({
        walletCount: selectedAddresses.length,
        wallets: selectedAddresses,
        totalAssets: totalCommon,
        totalAssetsAnalyzed,
        totalNFTsAnalyzed,
        totalPOAPsAnalyzed,
        totalERC20sAnalyzed,
        nfts: commonNFTs,
        poaps: commonPOAPs,
        erc20s: commonERC20s
      });

      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress({ show: false, stage: '', current: 0, total: 0, message: '', isProcessing: false, elapsedSeconds: 0 });
    }
  };

  const resetAnalysis = () => {
    setStep(1);
    setNftCollections([]);
    setPoapEvents([]);
    setErc20Tokens([]);
    setSelectedNFTs(new Set());
    setSelectedPOAPs(new Set());
    setSelectedERC20s(new Set());
    setErc20Search('');
    setNftSearch('');
    setPoapSearch('');
    setKindredSpirits([]);
    setSelectedSpirits(new Set());
    setCommonAssets(null);
    setAnalysisResults(null);
    setError('');
  };

  const totalSelectedAssets = selectedNFTs.size + selectedPOAPs.size + selectedERC20s.size;

  // Filtered asset lists based on search
  const filteredERC20s = erc20Tokens.filter(token => 
    token.name.toLowerCase().includes(erc20Search.toLowerCase()) ||
    token.symbol.toLowerCase().includes(erc20Search.toLowerCase())
  );
  
  const filteredNFTs = nftCollections.filter(nft => 
    nft.name.toLowerCase().includes(nftSearch.toLowerCase())
  );
  
  const filteredPOAPs = poapEvents.filter(poap => 
    poap.name.toLowerCase().includes(poapSearch.toLowerCase()) ||
    poap.eventId.includes(poapSearch)
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-8">
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">🔍 Common Assets Finder</h1>
        <p className="text-gray-400 mb-8">
          Find assets shared by multiple kindred spirits (4-step workflow)
        </p>

        {/* Progress Bar */}
        {progress.show && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-purple-500/30">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-lg">{progress.stage}</h3>
                <p className="text-sm text-gray-400">{progress.message}</p>
              </div>
              <div className="text-sm text-purple-400 font-mono">
                {progress.isProcessing ? (
                  <span className="animate-pulse">
                    ⏱️ {progress.elapsedSeconds}s
                  </span>
                ) : (
                  <span>{progress.current}/{progress.total}</span>
                )}
              </div>
            </div>
            {progress.isProcessing ? (
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 opacity-50" 
                     style={{
                       backgroundSize: '200% 100%',
                       animation: 'shimmer 2s infinite'
                     }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse opacity-40" />
              </div>
            ) : (
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500 ease-out flex items-center justify-center"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                >
                  <span className="text-xs font-bold text-white drop-shadow-lg">
                    {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-400">❌ {error}</p>
          </div>
        )}

        {/* Step 1: Fetch Assets */}
        {step === 1 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Step 1: Fetch Your Assets</h2>
            <label className="block mb-2 text-sm font-medium">Wallet Address or ENS Name</label>
            <input
              type="text"
              value={walletInput}
              onChange={(e) => setWalletInput(e.target.value)}
              placeholder="0x... or vitalik.eth"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg mb-4"
            />
            {ensName && step !== 1 && (
              <div className="mb-4 text-sm text-gray-400">
                Analyzing: <span className="text-purple-400 font-medium">{ensName}</span>
                {' '}({walletAddress.slice(0, 6)}...{walletAddress.slice(-4)})
              </div>
            )}
            <button
              onClick={() => fetchAssets()}
              disabled={loading || !walletInput}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {loading ? 'Fetching Assets...' : 'Fetch NFTs + POAPs + ERC-20s'}
            </button>
          </div>
        )}

        {/* Step 2: Select Assets */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold">Step 2: Select Assets to Analyze</h2>
                  <p className="text-sm text-gray-400">
                    {totalSelectedAssets} assets selected • These will be used to find kindred spirits
                  </p>
                </div>
                <button
                  onClick={resetAnalysis}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  ← Back
                </button>
              </div>

              {/* Asset Selection UI - Simplified version */}
              {/* ERC-20 Tokens */}
              {erc20Tokens.length > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold">
                      🪙 ERC-20 Tokens ({erc20Tokens.length})
                      <span className="text-sm text-gray-400">• {selectedERC20s.size} selected</span>
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedERC20s(new Set(filteredERC20s.map(t => t.address)))}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                      >
                        Select All {erc20Search && `(${filteredERC20s.length})`}
                      </button>
                      <button
                        onClick={() => setSelectedERC20s(new Set())}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  {/* Search Bar */}
                  <div className="mb-3">
                    <input
                      type="text"
                      value={erc20Search}
                      onChange={(e) => setErc20Search(e.target.value)}
                      placeholder="🔍 Search tokens by name or symbol..."
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                    />
                    {erc20Search && (
                      <div className="text-xs text-gray-400 mt-1">
                        Showing {filteredERC20s.length} of {erc20Tokens.length} tokens
                      </div>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {filteredERC20s.map((token) => (
                      <div
                        key={token.address}
                        onClick={() => toggleAsset('erc20', token.address)}
                        className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedERC20s.has(token.address)
                            ? 'bg-green-900/30 border-2 border-green-500'
                            : 'bg-gray-700 border-2 border-transparent hover:bg-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedERC20s.has(token.address)}
                          readOnly
                          className="w-4 h-4"
                        />
                        {token.logo && <img src={token.logo} alt={token.symbol} className="w-6 h-6 rounded-full" />}
                        <div className="flex-1">
                          <div className="font-medium text-sm">{token.symbol}</div>
                          <div className="text-xs text-gray-400">{token.name}</div>
                        </div>
                        {token.holderCount && (
                          <div className="text-xs text-gray-400">{token.holderCount.toLocaleString()} holders</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* NFT Collections */}
              {nftCollections.length > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      🖼️ NFT Collections ({nftCollections.length})
                      <span className="text-sm text-gray-400">• {selectedNFTs.size} selected</span>
                      {!nftCollections.some(n => n.ownerCount) && (
                        <button
                          onClick={fetchNFTOwnerCounts}
                          disabled={loading}
                          className="px-2 py-1 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-600 rounded text-xs"
                          title="Load owner counts for all NFT collections"
                        >
                          📊 Load Owner Counts
                        </button>
                      )}
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedNFTs(new Set(filteredNFTs.map(n => n.id)))}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                      >
                        Select All {nftSearch && `(${filteredNFTs.length})`}
                      </button>
                      <button
                        onClick={() => setSelectedNFTs(new Set())}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  {/* Search Bar */}
                  <div className="mb-3">
                    <input
                      type="text"
                      value={nftSearch}
                      onChange={(e) => setNftSearch(e.target.value)}
                      placeholder="🔍 Search NFT collections by name..."
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                    />
                    {nftSearch && (
                      <div className="text-xs text-gray-400 mt-1">
                        Showing {filteredNFTs.length} of {nftCollections.length} collections
                      </div>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {filteredNFTs.map((nft) => (
                      <div
                        key={nft.id}
                        onClick={() => toggleAsset('nft', nft.id)}
                        className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedNFTs.has(nft.id)
                            ? 'bg-blue-900/30 border-2 border-blue-500'
                            : 'bg-gray-700 border-2 border-transparent hover:bg-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedNFTs.has(nft.id)}
                          readOnly
                          className="w-4 h-4"
                        />
                        {nft.image && <img src={nft.image} alt={nft.name} className="w-6 h-6 rounded" />}
                        <div className="flex-1">
                          <div className="font-medium text-sm">{nft.name}</div>
                          <div className="text-xs text-gray-400 flex items-center gap-2">
                            <span>{nft.network?.replace('_MAINNET', '').replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</span>
                            {nft.tokenType && nft.tokenType !== 'UNKNOWN' && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                nft.tokenType === 'ERC721' ? 'bg-blue-900/40 text-blue-300' : 
                                nft.tokenType === 'ERC1155' ? 'bg-purple-900/40 text-purple-300' : 
                                'bg-gray-700 text-gray-400'
                              }`}>
                                {nft.tokenType}
                              </span>
                            )}
                            {nft.totalBalance && <span> • You own: {nft.totalBalance}</span>}
                          </div>
                        </div>
                        {nft.ownerCount && (
                          <div className="text-xs text-gray-400">{nft.ownerCount.toLocaleString()} owners</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* POAP Events */}
              {poapEvents.length > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold">
                      🎫 POAP Events ({poapEvents.length})
                      <span className="text-sm text-gray-400">• {selectedPOAPs.size} selected</span>
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedPOAPs(new Set(filteredPOAPs.map(p => p.eventId)))}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                      >
                        Select All {poapSearch && `(${filteredPOAPs.length})`}
                      </button>
                      <button
                        onClick={() => setSelectedPOAPs(new Set())}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  {/* Search Bar */}
                  <div className="mb-3">
                    <input
                      type="text"
                      value={poapSearch}
                      onChange={(e) => setPoapSearch(e.target.value)}
                      placeholder="🔍 Search POAP events by name or ID..."
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                    />
                    {poapSearch && (
                      <div className="text-xs text-gray-400 mt-1">
                        Showing {filteredPOAPs.length} of {poapEvents.length} events
                      </div>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {filteredPOAPs.map((poap) => (
                      <div
                        key={poap.eventId}
                        onClick={() => toggleAsset('poap', poap.eventId)}
                        className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedPOAPs.has(poap.eventId)
                            ? 'bg-purple-900/30 border-2 border-purple-500'
                            : 'bg-gray-700 border-2 border-transparent hover:bg-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPOAPs.has(poap.eventId)}
                          readOnly
                          className="w-4 h-4"
                        />
                        {poap.image && <img src={poap.image} alt={poap.name} className="w-6 h-6 rounded-full" />}
                        <div className="flex-1">
                          <div className="font-medium text-sm">{poap.name}</div>
                          <div className="text-xs text-gray-400">Event #{poap.eventId}</div>
                        </div>
                        {poap.ownerCount && (
                          <div className="text-xs text-gray-400">{poap.ownerCount.toLocaleString()} holders</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {totalSelectedAssets > 0 && (
                  <div className="text-sm text-gray-400 bg-gray-900 rounded-lg p-3 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <span>⏱️ Estimated analysis time:</span>
                      <span className="font-medium text-purple-400">
                        {(() => {
                          const nftTime = selectedNFTs.size * 3;
                          const poapTime = selectedPOAPs.size * 5;
                          const erc20Time = selectedERC20s.size * 8;
                          const totalTime = nftTime + poapTime + erc20Time;
                          const minTime = Math.max(5, Math.floor(totalTime * 0.7));
                          const maxTime = Math.ceil(totalTime * 1.3);
                          return `${minTime}-${maxTime}s`;
                        })()}
                      </span>
                    </div>
                    {selectedERC20s.size > 0 && (
                      <div className="mt-2 text-xs text-yellow-400">
                        ⚠️ ERC-20 analysis may take longer due to large holder bases
                      </div>
                    )}
                  </div>
                )}
                <button
                  onClick={analyzeOverlap}
                  disabled={loading || totalSelectedAssets === 0}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  {loading ? 'Analyzing...' : `Find Kindred Spirits (${totalSelectedAssets} asset${totalSelectedAssets !== 1 ? 's' : ''})`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Select Kindred Spirits */}
        {step === 3 && kindredSpirits.length > 0 && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold">Step 3: Select Kindred Spirits</h2>
                  <p className="text-sm text-gray-400">
                    {selectedSpirits.size} selected (max 20) • 
                    {includeSourceWallet 
                      ? ` Total wallets to analyze: ${selectedSpirits.size + 1} (including you)`
                      : ` Select at least 2 to find common assets`
                    }
                  </p>
                </div>
                <button
                  onClick={resetAnalysis}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  ← Start Over
                </button>
              </div>

              {/* Include Source Wallet Checkbox */}
              <div className="mb-4 flex items-center gap-3 p-3 bg-gray-900 rounded-lg border border-purple-500/30">
                <input
                  type="checkbox"
                  id="includeSourceWallet"
                  checked={includeSourceWallet}
                  onChange={(e) => setIncludeSourceWallet(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="includeSourceWallet" className="flex-1 text-sm cursor-pointer">
                  <span className="font-medium text-purple-400">Include source wallet</span> 
                  <span className="text-gray-400">
                    {' '}({ensName || `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}) in the analysis
                  </span>
                </label>
                <div className="text-xs text-gray-500">
                  {includeSourceWallet ? 'Will find assets shared by this wallet + selected spirits' : 'Will find assets shared only among selected spirits'}
                </div>
              </div>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={selectAllSpirits}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                >
                  Select Top 20
                </button>
                <button
                  onClick={clearAllSpirits}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                >
                  Clear All
                </button>
                <div className="ml-auto flex flex-col items-end gap-1">
                  {selectedSpirits.size >= (includeSourceWallet ? 1 : 2) && (
                    <div className="text-xs text-gray-400">
                      ⏱️ Est. time: {(() => {
                        const totalWallets = includeSourceWallet ? selectedSpirits.size + 1 : selectedSpirits.size;
                        const minTime = Math.ceil(totalWallets * 2);
                        const maxTime = Math.ceil(totalWallets * 4);
                        return `${minTime}-${maxTime}s`;
                      })()}
                    </div>
                  )}
                  <button
                    onClick={findCommonAssets}
                    disabled={loading || selectedSpirits.size < (includeSourceWallet ? 1 : 2)}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-medium transition-colors"
                  >
                    {loading ? 'Analyzing...' : `🔍 Find Common Assets (${includeSourceWallet ? selectedSpirits.size + 1 : selectedSpirits.size} wallet${(includeSourceWallet ? selectedSpirits.size + 1 : selectedSpirits.size) !== 1 ? 's' : ''})`}
                  </button>
                </div>
              </div>

              {/* Kindred Spirits Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900 text-gray-400 text-sm">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedSpirits.size === Math.min(kindredSpirits.length, 20) && selectedSpirits.size > 0}
                          onChange={() => selectedSpirits.size > 0 ? clearAllSpirits() : selectAllSpirits()}
                          className="w-4 h-4"
                        />
                      </th>
                      <th className="px-6 py-3 text-left">Rank</th>
                      <th className="px-6 py-3 text-left">Wallet / ENS / Farcaster</th>
                      <th className="px-6 py-3 text-right">Overlaps</th>
                      <th className="px-6 py-3 text-right">%</th>
                      <th className="px-6 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kindredSpirits.map((spirit, idx) => (
                      <tr 
                        key={spirit.address} 
                        className={`border-b border-gray-700 hover:bg-gray-700/50 cursor-pointer ${
                          selectedSpirits.has(spirit.address) ? 'bg-purple-900/20' : ''
                        }`}
                        onClick={() => toggleSpirit(spirit.address)}
                      >
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedSpirits.has(spirit.address)}
                            readOnly
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="px-6 py-4 font-bold text-purple-400">#{idx + 1}</td>
                        <td className="px-6 py-4">
                          <TestSocialCard 
                            address={spirit.address} 
                            count={spirit.overlapCount}
                          />
                        </td>
                        <td className="px-6 py-4 text-right font-bold">{spirit.overlapCount}</td>
                        <td className="px-6 py-4 text-right text-green-400">{spirit.overlapPercentage}%</td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <button
                              onClick={(e) => analyzeKindredSpirit(spirit.address, e)}
                              className="text-purple-400 hover:text-purple-300 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg transition-colors text-sm"
                              title="Analyze this wallet's assets"
                            >
                              🔄 Analyze
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Common Assets Results */}
        {step === 4 && commonAssets && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">📊 Common Assets Results</h2>
              <div className="flex gap-3">
                <button
                  onClick={analyzeCommonAssets}
                  disabled={loading || (selectedCommonNFTs.size === 0 && selectedCommonPOAPs.size === 0 && selectedCommonERC20s.size === 0)}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold"
                >
                  🔄 Find New Kindred Spirits ({selectedCommonNFTs.size + selectedCommonPOAPs.size + selectedCommonERC20s.size} selected)
                </button>
                <button
                  onClick={resetAnalysis}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                >
                  New Analysis
                </button>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="grid grid-cols-4 gap-6 mb-6">
                <div>
                  <div className="text-gray-400 text-sm">Wallets Analyzed</div>
                  <div className="text-3xl font-bold text-purple-400">{commonAssets.walletCount}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Total Common Assets</div>
                  <div className="text-3xl font-bold text-yellow-400">{commonAssets.totalAssets}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm flex items-center gap-2">
                    🖼️ NFTs • 🎫 POAPs • 🪙 ERC-20s
                  </div>
                  <div className="text-xl font-bold">
                    <span className="text-blue-400">{commonAssets.nfts.length}</span>
                    <span className="text-gray-500 mx-2">•</span>
                    <span className="text-purple-400">{commonAssets.poaps.length}</span>
                    <span className="text-gray-500 mx-2">•</span>
                    <span className="text-green-400">{commonAssets.erc20s.length}</span>
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Coverage</div>
                  <div className="text-2xl font-bold text-green-400">100%</div>
                  <div className="text-xs text-gray-500">Present in all wallets</div>
                </div>
              </div>
              
              {/* Total Assets Analyzed Breakdown */}
              <div className="border-t border-gray-700 pt-4">
                <div className="text-gray-400 text-sm mb-2">Total Assets Analyzed (across all {commonAssets.walletCount} wallets)</div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">🖼️</span>
                    <span className="text-blue-400 font-semibold">{commonAssets.totalNFTsAnalyzed || 0}</span>
                    <span className="text-gray-500 text-sm">NFTs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">🎫</span>
                    <span className="text-purple-400 font-semibold">{commonAssets.totalPOAPsAnalyzed || 0}</span>
                    <span className="text-gray-500 text-sm">POAPs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">🪙</span>
                    <span className="text-green-400 font-semibold">{commonAssets.totalERC20sAnalyzed || 0}</span>
                    <span className="text-gray-500 text-sm">ERC-20s</span>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-gray-400 text-sm">Total:</span>
                    <span className="text-yellow-400 font-bold text-lg">{commonAssets.totalAssetsAnalyzed || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* No Common Assets Message */}
            {commonAssets.totalAssets === 0 && (
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-6 text-center">
                <div className="text-4xl mb-4">😔</div>
                <div className="text-xl font-bold mb-2">No Common Assets Found</div>
                <div className="text-gray-400">
                  The selected {commonAssets.walletCount} wallets don't share any assets in common.
                  Try selecting fewer wallets or different kindred spirits.
                </div>
              </div>
            )}

            {/* ERC-20 Tokens */}
            {commonAssets.erc20s.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    🪙 ERC-20 Tokens ({commonAssets.erc20s.filter(t => 
                      t.symbol.toLowerCase().includes(commonErc20Search.toLowerCase()) || 
                      t.name.toLowerCase().includes(commonErc20Search.toLowerCase())
                    ).length} / {commonAssets.erc20s.length})
                    <span className="text-sm text-gray-400 font-normal">• Held by all {commonAssets.walletCount} wallets</span>
                  </h3>
                  <input
                    type="text"
                    placeholder="Search tokens..."
                    value={commonErc20Search}
                    onChange={(e) => setCommonErc20Search(e.target.value)}
                    className="px-4 py-2 bg-gray-700 rounded-lg text-sm w-64"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {commonAssets.erc20s
                    .filter(t => 
                      t.symbol.toLowerCase().includes(commonErc20Search.toLowerCase()) || 
                      t.name.toLowerCase().includes(commonErc20Search.toLowerCase())
                    )
                    .map((token) => (
                      <div 
                        key={token.address} 
                        onClick={() => toggleCommonAsset('erc20', token.address)}
                        className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-all ${
                          selectedCommonERC20s.has(token.address) 
                            ? 'bg-purple-900/30 border-2 border-purple-500' 
                            : 'bg-gray-700 hover:bg-gray-600 border-2 border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCommonERC20s.has(token.address)}
                          onChange={() => toggleCommonAsset('erc20', token.address)}
                          className="w-5 h-5"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {token.logo && (
                          <img src={token.logo} alt={token.symbol} className="w-10 h-10 rounded-full" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium">{token.symbol}</div>
                          <div className="text-xs text-gray-400">{token.name}</div>
                          {token.holderCount && (
                            <div className="text-xs text-purple-400 mt-1">
                              👥 {token.holderCount.toLocaleString()} holders
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* NFT Collections */}
            {commonAssets.nfts.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    🖼️ NFT Collections ({commonAssets.nfts.filter(n => 
                      n.name.toLowerCase().includes(commonNftSearch.toLowerCase())
                    ).length} / {commonAssets.nfts.length})
                    <span className="text-sm text-gray-400 font-normal">• Held by all {commonAssets.walletCount} wallets</span>
                  </h3>
                  <input
                    type="text"
                    placeholder="Search NFTs..."
                    value={commonNftSearch}
                    onChange={(e) => setCommonNftSearch(e.target.value)}
                    className="px-4 py-2 bg-gray-700 rounded-lg text-sm w-64"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {commonAssets.nfts
                    .filter(n => n.name.toLowerCase().includes(commonNftSearch.toLowerCase()))
                    .map((nft) => (
                      <div 
                        key={nft.id}
                        onClick={() => toggleCommonAsset('nft', nft.id)}
                        className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-all ${
                          selectedCommonNFTs.has(nft.id) 
                            ? 'bg-purple-900/30 border-2 border-purple-500' 
                            : 'bg-gray-700 hover:bg-gray-600 border-2 border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCommonNFTs.has(nft.id)}
                          onChange={() => toggleCommonAsset('nft', nft.id)}
                          className="w-5 h-5"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {nft.image && (
                          <img src={nft.image} alt={nft.name} className="w-10 h-10 rounded" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium text-sm">{nft.name}</div>
                          <div className="text-xs text-gray-400">
                            {nft.network?.replace('_MAINNET', '').replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                          </div>
                          {nft.ownerCount && (
                            <div className="text-xs text-purple-400 mt-1">
                              👥 {nft.ownerCount.toLocaleString()} owners
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* POAP Events */}
            {commonAssets.poaps.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    🎫 POAP Events ({commonAssets.poaps.filter(p => 
                      p.name.toLowerCase().includes(commonPoapSearch.toLowerCase())
                    ).length} / {commonAssets.poaps.length})
                    <span className="text-sm text-gray-400 font-normal">• Held by all {commonAssets.walletCount} wallets</span>
                  </h3>
                  <input
                    type="text"
                    placeholder="Search POAPs..."
                    value={commonPoapSearch}
                    onChange={(e) => setCommonPoapSearch(e.target.value)}
                    className="px-4 py-2 bg-gray-700 rounded-lg text-sm w-64"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {commonAssets.poaps
                    .filter(p => p.name.toLowerCase().includes(commonPoapSearch.toLowerCase()))
                    .map((poap) => (
                      <div 
                        key={poap.eventId}
                        onClick={() => toggleCommonAsset('poap', poap.eventId)}
                        className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-all ${
                          selectedCommonPOAPs.has(poap.eventId) 
                            ? 'bg-purple-900/30 border-2 border-purple-500' 
                            : 'bg-gray-700 hover:bg-gray-600 border-2 border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCommonPOAPs.has(poap.eventId)}
                          onChange={() => toggleCommonAsset('poap', poap.eventId)}
                          className="w-5 h-5"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {poap.image && (
                          <img src={poap.image} alt={poap.name} className="w-10 h-10 rounded-full" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium text-sm">{poap.name}</div>
                          <div className="text-xs text-gray-400">Event #{poap.eventId}</div>
                          {poap.supply && (
                            <div className="text-xs text-purple-400 mt-1">
                              👥 {poap.supply.toLocaleString()} holders
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="font-bold mb-4">📝 How it Works (Recursive Analysis)</h3>
          <ol className="space-y-2 text-gray-300">
            <li><strong>Step 1:</strong> Enter wallet → Fetch all assets (NFTs, POAPs, ERC-20s)</li>
            <li><strong>Step 2:</strong> Select which assets you want to use for analysis</li>
            <li><strong>Step 3:</strong> System finds kindred spirits who share those assets → Select 2-20 of them OR click <span className="text-purple-400">"🔄 Analyze"</span> to analyze a single wallet</li>
            <li><strong>Step 4:</strong> System finds assets that ALL selected spirits have in common (with owner/holder counts)</li>
            <li><strong>Step 5 (NEW!):</strong> Select common assets → Find NEW kindred spirits → Repeat infinitely! 🔄</li>
          </ol>
          
          <div className="mt-4 pt-4 border-t border-gray-700 text-sm text-gray-400">
            <strong>🎯 Strict Intersection:</strong> Step 4 only shows assets present in 100% of selected wallets.
            This helps identify the core assets that define a community or collector group.
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-700 text-sm text-yellow-400">
            <strong>♾️ Infinite Loop:</strong> After finding common assets, you can select from them and run a NEW kindred spirit analysis. 
            This creates a recursive discovery process to drill deeper into niche communities!
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-700 text-sm text-gray-400">
            <strong>⚠️ Note:</strong> The more wallets you select in Step 3, the fewer common assets you'll likely find in Step 4.
            Start with 2-5 wallets for best results.
          </div>
        </div>
      </div>
    </div>
  );
}
