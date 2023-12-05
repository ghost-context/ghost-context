import { useEffect, useState, useContext, useRef } from "react";

import { Address } from './Address'

export const SocialCard = ({ airstack, count, address , inModal }) => {
    const [socials, setSocials] = useState([]);
    const [image, setImage] = useState("/kindredSpirit.png");
  
    useEffect(() => {
      const fetchSocials = async () => {
        const result = await airstack.socialLookup(address);
        setSocials(result);
        const profileImage = Array.isArray(result) && result.find(social => social.profileImage.startsWith('https'))?.profileImage;
        if (profileImage) {
          setImage(profileImage);
        }
      };
  
      fetchSocials();
    }, [address]);
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
            <img 
              src={`/networks/${social.dappName}.svg`} 
              alt={social.dappName} 
              title={social.profileName} 
              className="h-4 w-4 mr-2" 
            />
            {inModal ? (
                <div className="flex flex-col text-sm leading-6">
                <span>{social.profileName} - f {social.followerCount} , fo {social.followingCount}</span>
                </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
    </div>)
  };