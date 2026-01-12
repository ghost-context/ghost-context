import { useEffect, useState, memo } from "react";

import { Address } from './Address'

export const SocialCard = memo(function SocialCard({ airstack, count, address, inModal, prefetchedSocials }) {
    const [socials, setSocials] = useState([]);
    const [image, setImage] = useState("/kindredSpirit.png");

    useEffect(() => {
      // Use pre-fetched data if available, otherwise fetch individually
      if (prefetchedSocials !== undefined) {
        const farcasterOnly = Array.isArray(prefetchedSocials) ? prefetchedSocials.filter(s => s.dappName === 'farcaster') : [];
        setSocials(farcasterOnly);
        const profileImage = farcasterOnly.find(social => (social.profileImage || '').startsWith('http'))?.profileImage;
        if (profileImage) setImage(profileImage);
        return;
      }

      const fetchSocials = async () => {
        const result = await airstack.socialLookup(address);
        const farcasterOnly = Array.isArray(result) ? result.filter(s => s.dappName === 'farcaster') : [];
        setSocials(farcasterOnly);
        const profileImage = farcasterOnly.find(social => (social.profileImage || '').startsWith('http'))?.profileImage;
        if (profileImage) setImage(profileImage);
      };

      fetchSocials();
    }, [address, prefetchedSocials, airstack]);
    return (
    <div className="flex items-center gap-x-3">
      <img
        src={image}
        alt={`Kindred Spirit with ${count} connections`}
        className="h-6 w-6 flex-none rounded-full bg-gray-800"
      />
      <div>
      <h3 className={`truncate text-sm font-semibold leading-6 ${inModal ? '' : 'text-white'}`}>
        <Address address={address} />
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
            {inModal ? (
                <div className="flex flex-col text-sm leading-6">
                <a target="_blank" href={social.link}>{social.profileName}</a>
                </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
    </div>);
});