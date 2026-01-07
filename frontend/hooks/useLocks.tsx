import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { aptosClient } from "@/utils/aptosClient";
import { deriveCollectionAddress, deriveVaultAddress } from "@/utils/helpers";
import { VETAPP_ACCOUNT_ADDRESS } from "@/constants";

type LocksQueryResult = {
  collectionAddress: string | null;
  tokens: {
    token_data_id: string;
    amount: any;
    current_token_data?: {
      token_name: string;
    } | null;
  }[];
};

export function useLocks() {
  const { account } = useWallet();

  return useQuery({
    queryKey: ["user-locks", account?.address],
    enabled: Boolean(account),
    queryFn: async (): Promise<LocksQueryResult> => {
      if (!account) {
        return { collectionAddress: null, tokens: [] };
      }

      const vaultAddress = deriveVaultAddress(VETAPP_ACCOUNT_ADDRESS, "VE_TAPP");
      const collectionAddress = deriveCollectionAddress(vaultAddress, "veTAPP").toString();
      console.log(collectionAddress);

      const tokens = await aptosClient().getAccountOwnedTokensFromCollectionAddress({
        accountAddress: account.address,
        collectionAddress,
        options: { limit: 200 },
      });

      return { collectionAddress, tokens };
    },
  });
}
