import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { aptosClient } from "@/utils/aptosClient";

const isAddress = (value: string) => /^0x[a-fA-F0-9]+$/.test(value);

export function useWalletTokenAddresses() {
  const { account } = useWallet();

  return useQuery({
    queryKey: ["wallet-token-addresses", account?.address],
    enabled: Boolean(account),
    queryFn: async (): Promise<string[]> => {
      if (!account) {
        return [];
      }

      const coins = await aptosClient().getAccountCoinsData({
        accountAddress: account.address,
        options: { limit: 200 },
      });
      const addresses = new Set<string>();
      for (const coin of coins) {
        const assetType = coin.asset_type ?? "";
        if (isAddress(assetType)) {
          addresses.add(assetType);
        }
      }
      return Array.from(addresses);
    },
  });
}
