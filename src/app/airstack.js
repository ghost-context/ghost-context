
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
        return data?.social?.Social
    }

}
