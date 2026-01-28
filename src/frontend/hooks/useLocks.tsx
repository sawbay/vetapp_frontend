import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery, UseQueryResult } from "@tanstack/react-query";
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

export function useLocks(accountAddress?: string | null): UseQueryResult<LocksQueryResult> {
  const { account } = useWallet();
  const targetAddress = accountAddress ?? account?.address;

  return useQuery<LocksQueryResult>({
    queryKey: ["user-locks", targetAddress],
    enabled: Boolean(targetAddress),
    queryFn: async (): Promise<LocksQueryResult> => {
      if (!targetAddress) {
        return { collectionAddress: null, tokens: [] };
      }

      const vaultAddress = deriveVaultAddress(VETAPP_ACCOUNT_ADDRESS, "VE_TAPP");
      const collectionAddress = deriveCollectionAddress(vaultAddress, "veTAPP").toString();

      const tokens = await aptosClient().getAccountOwnedTokensFromCollectionAddress({
        accountAddress: targetAddress,
        collectionAddress,
        options: { limit: 200 },
      });

      return { collectionAddress, tokens };
    },
  });
}
