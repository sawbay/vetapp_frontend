import { useQuery } from "@tanstack/react-query";
import { aptosClient } from "@/utils/aptosClient";
import { deriveCollectionAddress, deriveVaultAddress } from "@/utils/helpers";
import { TAPP_ACCOUNT_ADDRESS, VETAPP_ACCOUNT_ADDRESS } from "@/constants";

type PoolToken = {
  token_data_id: string;
  amount: any;
  current_token_data?: {
    token_name: string;
  } | null;
};

type GaugeQueryResult = {
  pools: string[];
  committedPositions: Record<string, PoolToken[]>;
};

export function useGauge() {
  return useQuery({
    queryKey: ["gauges"],
    enabled: Boolean(VETAPP_ACCOUNT_ADDRESS && TAPP_ACCOUNT_ADDRESS),
    queryFn: async (): Promise<GaugeQueryResult> => {
      if (!VETAPP_ACCOUNT_ADDRESS || !TAPP_ACCOUNT_ADDRESS) {
        return { pools: [], committedPositions: {} };
      }
      const vaultAddress = deriveVaultAddress(TAPP_ACCOUNT_ADDRESS, "VAULT");
      const collectionAddress = deriveCollectionAddress(vaultAddress, "TAPP").toString();
      const poolsResult = await aptosClient().view<[string[]]>({
        payload: {
          function: `${VETAPP_ACCOUNT_ADDRESS}::voter::gauges`,
        },
      });
      const pools = poolsResult[0] ?? [];
      const committedPositionEntries = await Promise.all(
        pools.map(async (poolAddress) => {
          const tokens = await aptosClient().getAccountOwnedTokensFromCollectionAddress({
            accountAddress: poolAddress,
            collectionAddress,
            options: { limit: 200 },
          });
          return [poolAddress.toLowerCase(), tokens] as const;
        }),
      );
      const committedPositions = committedPositionEntries.reduce<Record<string, PoolToken[]>>((acc, [poolAddress, tokens]) => {
        acc[poolAddress] = tokens;
        return acc;
      }, {});

      return { pools, committedPositions };
    },
  });
}
