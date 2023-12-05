
import { init, fetchQuery } from "@airstack/airstack-react";


export class AirStackClient {

    constructor() {
        init(process.env.NEXT_PUBLIC_AIRSTACK_KEY);
    }

    async socialLookup(address) {

        const query = `query GetAllSocials($address: Address!) {
            social: Socials(
            input: {filter: {userAssociatedAddresses: {_eq: $address}}, blockchain: ethereum}
            ) {
                Social {
                    blockchain
                    dappName
                    profileName
                    profileImage
                    followerCount
                    followingCount
                }
            }
        }`

        const variables = { address: address }

        const { data, error } = await fetchQuery(query, variables, {});
        let socialData = data?.social?.Social
        return socialData?.map((social) => {
            if (social.dappName === 'lens') {
              social.link = `https://hey.xyz/u/${social.profileName.split('/@')[1]}`;
            } else {
              social.link = `https://warpcast.com/${social.profileName}`;
            }
            return social;
          });
    }

}
