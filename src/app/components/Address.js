import { useEnsName } from 'wagmi'
import { isAddress } from 'viem'

const ShortAddress = ({ address }) => {
    const prefix = address.slice(0, 4);
    const suffix = address.slice(-4);
    const shortAddress = `${prefix}...${suffix}`;
  
    return (
      <div>{shortAddress}</div>
    )
}
  
export const Address = ({ address }) => {
    const enabled = isAddress(address || '');
    const { data, isError, isLoading } = useEnsName({
      address: address,
      chainId: 1,
      query: { enabled }
    });
  
    if(!data) {
      const prefix = address.slice(0, 4);
      const suffix = address.slice(-4);
      address = `${prefix}...${suffix}`;
    }
  
    return (
      <>
        {isLoading ? (
          address
        ) : isError ? (
          address
        ) : (
          data || address
        )}
      </>
    );
  }