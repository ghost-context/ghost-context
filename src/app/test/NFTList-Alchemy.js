'use client';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { AlchemyMultichainClient } from '../alchemy-multichain-client';

const NFTList = () => {
  const [nfts, setNfts] = useState([]);

  useEffect(() => {
    const alchemy = new AlchemyMultichainClient();
    const fetchNfts = async () => {
      const fetchedNfts = await alchemy.getCollectionsForOwner('aronshelton.eth', 'relevant', () => {});
      setNfts(fetchedNfts);
    };
    fetchNfts();
  }, []);

  return (
    <div>
      <h1>NFT List</h1>
      {nfts.map((nft, index) => (
        <div key={index}>
          <h3>{nft.name}</h3>
          <p>{nft.description}</p>
          {nft.image_small_url && (
            <Image 
              src={nft.image_small_url} 
              alt={nft.name} 
              width={200} 
              height={200}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default NFTList;
