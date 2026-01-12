import { useEnsName } from 'wagmi'
import { isAddress } from 'viem'
import { shortenAddress } from '../lib/address-utils'

const ShortAddress = ({ address }) => {
    return <div>{shortenAddress(address)}</div>
}

export const Address = ({ address }) => {
    const enabled = isAddress(address || '');
    const { data, isError, isLoading } = useEnsName({
      address: address,
      chainId: 1,
      query: { enabled }
    });

    const displayAddress = data || shortenAddress(address);

    return (
      <>
        {isLoading ? shortenAddress(address) : isError ? shortenAddress(address) : displayAddress}
      </>
    );
  }