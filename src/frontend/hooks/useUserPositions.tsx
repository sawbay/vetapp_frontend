import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { aptosClient } from "@/utils/aptosClient";
import { deriveCollectionAddress, deriveVaultAddress } from "@/utils/helpers";
import { TAPP_ACCOUNT_ADDRESS } from "@/constants";

type PositionsQueryResult = {
  collectionAddress: string | null;
  tokens: {
    token_data_id: string;
    amount: any;
    current_token_data?: {
      token_name: string;
    } | null;
  }[];
};

export function useUserPositions() {
  const { account } = useWallet();

  return useQuery({
    queryKey: ["user-positions", account?.address],
    enabled: Boolean(account),
    queryFn: async (): Promise<PositionsQueryResult> => {
      if (!account) {
        return { collectionAddress: null, tokens: [] };
      }
      const vaultAddress = deriveVaultAddress(TAPP_ACCOUNT_ADDRESS, "VAULT");
      const collectionAddress = deriveCollectionAddress(vaultAddress, "TAPP").toString();
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
