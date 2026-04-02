import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { usePool, type PoolMeta } from "@/hooks/usePool";
import { VIEWS_ACCOUNT_ADDRESS } from "@/constants";
import { aptosClient } from "@/utils/aptosClient";

const MAX_POOLS = 20;
const RESERVE_CACHE_TTL_MS = 5 * 60 * 1000;
const BALANCE_WALLET_ADDRESS =
  "0x57edaae7ac6e3813b057a675c05f155c0296f6757050e213dda7d8941b79609d";

const getNumericValue = (value: string | number | bigint) => {
  const numeric = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const escapeCsvValue = (value: string | number | bigint) => {
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const fetchPoolReserves = async (
  poolAddress: string,
  hookType: number | null,
): Promise<Array<string | number | bigint>> => {
  if (!VIEWS_ACCOUNT_ADDRESS || !poolAddress || !hookType) {
    return [];
  }

  let reserves: Array<string | number | bigint> = [];

  if (hookType === 2) {
    const [reserveAResult, reserveBResult] = await Promise.all([
      aptosClient().view<[string | number | bigint]>({
        payload: {
          function: `${VIEWS_ACCOUNT_ADDRESS}::amm_views::reserve_a`,
          functionArguments: [poolAddress],
        },
      }),
      aptosClient().view<[string | number | bigint]>({
        payload: {
          function: `${VIEWS_ACCOUNT_ADDRESS}::amm_views::reserve_b`,
          functionArguments: [poolAddress],
        },
      }),
    ]);
    reserves = [reserveAResult[0], reserveBResult[0]];
  }

  if (hookType === 3 && reserves.length === 0) {
    const [reserveAResult, reserveBResult] = await Promise.all([
      aptosClient().view<[string | number | bigint]>({
        payload: {
          function: `${VIEWS_ACCOUNT_ADDRESS}::clmm_views::reserve_a`,
          functionArguments: [poolAddress],
        },
      }),
      aptosClient().view<[string | number | bigint]>({
        payload: {
          function: `${VIEWS_ACCOUNT_ADDRESS}::clmm_views::reserve_b`,
          functionArguments: [poolAddress],
        },
      }),
    ]);
    reserves = [reserveAResult[0], reserveBResult[0]];
  }

  if (hookType === 4 && reserves.length === 0) {
    const storedBalancesResult = await aptosClient().view<[Array<string | number | bigint>]>({
      payload: {
        function: `${VIEWS_ACCOUNT_ADDRESS}::stable_views::stored_balances`,
        functionArguments: [poolAddress],
      },
    });
    reserves = storedBalancesResult[0] ?? [];
  }

  return reserves;
};

export function PoolsPage() {
  const { data: poolMetas = [], isFetching, isError } = usePool();
  const reserveQueries = useQueries({
    queries: poolMetas.map((pool) => ({
      queryKey: ["pool-reserves", pool.pool_addr.toLowerCase(), pool.hook_type],
      enabled: Boolean(VIEWS_ACCOUNT_ADDRESS),
      staleTime: RESERVE_CACHE_TTL_MS,
      gcTime: RESERVE_CACHE_TTL_MS * 6,
      queryFn: () => fetchPoolReserves(pool.pool_addr, pool.hook_type),
    })),
  });
  const isReservesFetching = reserveQueries.some((query) => query.isFetching);
  const isReservesError = reserveQueries.some((query) => query.isError);
  const allAssets = useMemo(
    () => Array.from(new Set(poolMetas.flatMap((pool) => pool.assets).filter(Boolean))),
    [poolMetas],
  );
  const assetSymbols = useMemo(() => {
    const symbolByAsset = new Map<string, string>();

    poolMetas.forEach((pool) => {
      const symbols = pool.assets_display.split(",").map((value) => value.trim()).filter(Boolean);
      pool.assets.forEach((asset, index) => {
        if (!symbolByAsset.has(asset)) {
          symbolByAsset.set(asset, symbols[index] || asset);
        }
      });
    });

    return symbolByAsset;
  }, [poolMetas]);
  const { data: assetBalances = {}, isFetching: isBalancesFetching, isError: isBalancesError } = useQuery({
    queryKey: ["wallet-fa-balances", BALANCE_WALLET_ADDRESS, allAssets.join("|")],
    enabled: allAssets.length > 0,
    staleTime: RESERVE_CACHE_TTL_MS,
    gcTime: RESERVE_CACHE_TTL_MS * 6,
    queryFn: async (): Promise<Record<string, string | number | bigint | null>> => {
      const entries = await Promise.all(
        allAssets.map(async (asset) => {
          try {
            const [balance] = await aptosClient().view<[string | number | bigint]>({
              payload: {
                function: "0x1::primary_fungible_store::balance",
                typeArguments: ["0x1::fungible_asset::Metadata"],
                functionArguments: [BALANCE_WALLET_ADDRESS, asset],
              },
            });

            return [asset, balance] as const;
          } catch (error) {
            console.error("Failed to fetch balance for asset:", asset, error);
            return [asset, null] as const;
          }
        }),
      );

      return Object.fromEntries(entries);
    },
  });
  const pools = useMemo(
    () => {
      if (poolMetas.length === 0) {
        return [];
      }

      const allReservesLoaded = reserveQueries.length === poolMetas.length
        && reserveQueries.every((query) => Array.isArray(query.data));

      if (!allReservesLoaded) {
        return poolMetas.slice(0, MAX_POOLS);
      }

      const enrichedPools: PoolMeta[] = poolMetas.map((pool, index) => {
        const reserves = reserveQueries[index]?.data ?? [];
        const tvl = reserves.reduce<number>((sum, value) => sum + getNumericValue(value), 0);
        return {
          ...pool,
          tvl,
          reserves,
        };
      });

      return enrichedPools.sort((a, b) => b.tvl - a.tvl).slice(0, MAX_POOLS);
    },
    [poolMetas, reserveQueries],
  );
  const proofRows = useMemo(() => {
    const walletRow = {
      poolAddress: "0x0",
      balances: Object.fromEntries(
        allAssets.map((asset) => [asset, assetBalances[asset] ?? "N/A"]),
      ) as Record<string, string | number | bigint>,
    };

    const poolRows = pools.map((pool) => {
      const reserveByAsset = new Map<string, string | number | bigint>();
      pool.assets.forEach((asset, index) => {
        reserveByAsset.set(asset, pool.reserves[index] ?? "N/A");
      });

      return {
        poolAddress: pool.pool_addr,
        balances: Object.fromEntries(
          allAssets.map((asset) => [asset, reserveByAsset.get(asset) ?? "N/A"]),
        ) as Record<string, string | number | bigint>,
      };
    });

    return [walletRow, ...poolRows];
  }, [allAssets, assetBalances, pools]);
  const csvContent = useMemo(() => {
    if (proofRows.length === 0 || allAssets.length === 0) {
      return "";
    }

    const headerRow = [
      "Pool Address",
      ...allAssets.map((asset) => assetSymbols.get(asset) ?? asset),
    ];

    const dataRows = proofRows.map((row) => [
      row.poolAddress,
      ...allAssets.map((asset) => row.balances[asset] ?? "N/A"),
    ]);

    return [headerRow, ...dataRows]
      .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
      .join("\n");
  }, [allAssets, assetSymbols, proofRows]);

  const onDownloadCsv = () => {
    if (!csvContent) {
      return;
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "proof-of-reserve.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Pools</h2>
          <p className="text-sm text-muted-foreground">
            Proof of reserve for the first {pools.length} pools from <code>usePool</code>.
          </p>
          <p className="text-sm text-muted-foreground">
            Unique assets across all pools: {allAssets.length}
          </p>
        </div>
        <Button onClick={onDownloadCsv} disabled={!csvContent}>
          Download CSV
        </Button>
      </div>

      {isFetching ? <p className="text-sm text-muted-foreground">Loading pools...</p> : null}
      {!isFetching && isReservesFetching ? (
        <p className="text-sm text-muted-foreground">Loading pool reserves...</p>
      ) : null}
      {!isFetching && isBalancesFetching ? (
        <p className="text-sm text-muted-foreground">Loading wallet balances...</p>
      ) : null}
      {isError ? <p className="text-sm text-destructive">Failed to load pools.</p> : null}
      {!isError && isReservesError ? (
        <p className="text-sm text-destructive">Failed to load pool reserves.</p>
      ) : null}
      {!isError && isBalancesError ? (
        <p className="text-sm text-destructive">Failed to load wallet balances.</p>
      ) : null}
      {!isFetching && !isError && pools.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pools found.</p>
      ) : null}

      {proofRows.length > 0 && allAssets.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left align-top">
                <th className="p-2 font-medium">Pool Address</th>
                {allAssets.map((asset) => (
                  <th key={asset} className="p-2 font-medium min-w-48">
                    {assetSymbols.get(asset) ?? asset}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {proofRows.map((row) => (
                <tr key={row.poolAddress} className="border-b border-border/60 align-top">
                  <td className="p-2 break-all font-medium">{row.poolAddress}</td>
                  {allAssets.map((asset) => (
                    <td key={`${row.poolAddress}:${asset}`} className="p-2 break-all text-muted-foreground">
                      {String(row.balances[asset])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
