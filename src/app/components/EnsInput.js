  import { useEnsAddress, useEnsName } from 'wagmi';
  import { isAddress } from 'viem';
  import { useState, useContext, useEffect } from 'react';
  import { EnsContext } from './context/EnsContext'; 
  import { KindredButtonContext } from './context/KindredButtonContext';



  export default function EnsInput() {
    const [ensNameOrAddress, setEnsNameOrAddress] = useState('');
    const {
      setShowKindredSpirits
    } = useContext(KindredButtonContext);
    
    const isPotentialEns = ensNameOrAddress?.endsWith?.('.eth') && ensNameOrAddress.length > 3;
    const isHexAddress = isAddress(ensNameOrAddress || '');

    const { data, isError, isLoading } = useEnsAddress({
      name: isPotentialEns ? ensNameOrAddress : undefined,
      chainId: 1,
      enabled: Boolean(isPotentialEns),
    });
    const { data: dataAddress, isError: addressError, isLoading: isLoadingAddress } = useEnsName({
      address: isHexAddress ? ensNameOrAddress : undefined,
      chainId: 1,
      enabled: Boolean(isHexAddress),
    });
    const { setEnsAddress } = useContext(EnsContext); // Consume the context
    useEffect(() => {
      try {
        if (!isError && !isLoading && data ) {
          setEnsAddress(data);
          setShowKindredSpirits(false);
        }
        if (!addressError && !isLoadingAddress && !data && dataAddress ) {
          setEnsAddress(dataAddress);
          setShowKindredSpirits(false);
        }
      } catch (error) {
        console.error('Error setting address:', error);
      }
    }, [data, dataAddress, isLoading, isLoadingAddress, isError, addressError, setEnsAddress, setShowKindredSpirits]);
    

    const handleSubmit = async (e, ensNameOrAddress) => {
      e.preventDefault();
      return ensNameOrAddress;
    };

    return (
      <div>
        <form onSubmit={handleSubmit}>
          <div className='items-center'>
            <label
              htmlFor='ens'
              className='block text-sm font-medium leading-6 text-white px-5 py-3'
            >
              or enter ENS or wallet address
            </label>
            <input
              type='text'
              value={ensNameOrAddress}
              name='ens'
              id='ens'
              onChange={(e) => setEnsNameOrAddress(e.target.value)}
              className='block w-30 rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6'
              placeholder='vitalik.eth'
            />
          </div>
        </form>
        {isLoading || isLoadingAddress ? (
          <div className='text-white'>Fetching ens/address…</div>
        ) : isError && addressError ? (
          <div className='text-white'>Error fetching ens/address</div>
        ) : (
          <div className='text-white'></div>
        )}
      </div>
    );
  }