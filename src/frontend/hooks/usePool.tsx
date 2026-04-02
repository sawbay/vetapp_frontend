import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { initTappSDK, PoolType as TappPoolType } from "@tapp-exchange/sdk";
import { aptosClient } from "@/utils/aptosClient";
import { NETWORK, VIEWS_ACCOUNT_ADDRESS } from "@/constants";
import { formatNumber8 } from "@/utils/format";

export type PoolMeta = {
  pool_addr: string;
  hook_type: number | null;
  hook_type_label: string;
  assets: string[];
  assets_display: string;
  tvl: number;
  reserves: Array<string | number | bigint>;
  reserves_display: string;
};

const normalizeAddress = (address: string) => {
  const lower = address.toLowerCase();
  return lower.startsWith("0x") ? lower : `0x${lower}`;
};

const getHookTypeLabel = (hookType: unknown) => {
  const hookTypeNumber =
    typeof hookType === "number" ? hookType : Number.parseInt(String(hookType), 10);
  return hookTypeNumber === 1
    ? "ALIAS"
    : hookTypeNumber === 2
      ? "V2"
      : hookTypeNumber === 3
        ? "V3"
        : hookTypeNumber === 4
          ? "STABLE"
        : "unknown";
};

const getNumericValue = (value: string | number | bigint) => {
  const numeric = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export function usePool() {
  const isMainnet = NETWORK?.toLowerCase() === "mainnet";

  const query = useQuery({
    queryKey: ["pool-metas"],
    enabled: isMainnet || Boolean(VIEWS_ACCOUNT_ADDRESS),
    queryFn: async (): Promise<PoolMeta[]> => {
      if (isMainnet) {
        const tappSdk = initTappSDK();
        const pageSize = 200;
        const limit = 30;
        let page = 1;
        let total = Number.POSITIVE_INFINITY;
        const pools: PoolMeta[] = [];

        while (pools.length < total && pools.length < limit) {
          const result = await tappSdk.Pool.getPools({
            page,
            size: pageSize,
            sortBy: "tvl",
          });
          const pagePools = (result.data ?? []).map((pool) => {
            const assetsAddr = pool.tokens?.map((token) => token.addr).filter(Boolean) ?? [];
            const assetsSymbol = pool.tokens?.map((token) => token.symbol).filter(Boolean) ?? [];
            const reserves = pool.tokens?.map((token) => token.reserve) ?? [];
            const hookType =
              pool.poolType === TappPoolType.CLMM
                ? 3
                : pool.poolType === TappPoolType.STABLE
                  ? 4
                  : 2;
            const hookTypeLabel =
              pool.poolType === TappPoolType.CLMM
                ? "V3"
                : pool.poolType === TappPoolType.STABLE
                  ? "STABLE"
                  : "V2";

            return {
              pool_addr: pool.poolId,
              hook_type: hookType,
              hook_type_label: hookTypeLabel,
              assets: assetsAddr,
              assets_display: assetsSymbol.length > 0 ? assetsSymbol.join(", ") : "unknown",
              tvl: Number(pool.tvl) || 0,
              reserves,
              reserves_display: `[${reserves.map((value) => formatNumber8(value)).join(", ")}]`,
            };
          });

          total = Number.isFinite(result.total) ? result.total : pagePools.length;
          pools.push(...pagePools);
          if (pagePools.length === 0) {
            break;
          }
          page += 1;
        }

        return pools.slice(0, limit);
      }

      if (!VIEWS_ACCOUNT_ADDRESS) {
        return [];
      }
      const result = await aptosClient().view<[Array<Record<string, unknown>>]>({
        payload: {
          function: `${VIEWS_ACCOUNT_ADDRESS}::tapp_views::get_pool_metas`,
        },
      });
      return (result[0] ?? []).filter(meta => (meta.hook_type as any) > 1).map((meta) => {
        const poolAddr = typeof meta?.pool_addr === "string" ? meta.pool_addr : "";
        const assets = Array.isArray(meta?.assets)
          ? meta.assets.filter((asset): asset is string => typeof asset === "string")
          : [];
        const reserves = Array.isArray(meta?.reserves) ? meta.reserves : [];
        const hookTypeRaw = meta?.hook_type;
        const hookTypeNumber =
          typeof hookTypeRaw === "number" ? hookTypeRaw : Number.parseInt(String(hookTypeRaw), 10);
        const hookType = Number.isFinite(hookTypeNumber) ? hookTypeNumber : null;
        const assetsDisplay = assets.length > 0 ? assets.join(", ") : "unknown";
        const reservesDisplay = Array.isArray(meta?.reserves)
          ? `[${reserves.map((value) => formatNumber8(value)).join(", ")}]`
          : "unknown";
        return {
          pool_addr: poolAddr,
          hook_type: hookType,
          hook_type_label: getHookTypeLabel(hookTypeRaw),
          assets,
          assets_display: assetsDisplay,
          tvl: reserves.reduce((sum, value) => sum + getNumericValue(value), 0),
          reserves,
          reserves_display: reservesDisplay,
        };
      }).sort((a, b) => b.tvl - a.tvl);
    },
  });

  const data = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => b.tvl - a.tvl),
    [query.data],
  );

  const poolMetaByAddress = useMemo(() => {
    const map = new Map<string, PoolMeta>();
    data.forEach((meta) => {
      if (meta.pool_addr) {
        map.set(normalizeAddress(meta.pool_addr), meta);
      }
    });
    return map;
  }, [data]);

  const getPoolMetaSummary = useCallback(
    (poolAddress: string) => {
      const poolMeta = poolMetaByAddress.get(normalizeAddress(poolAddress));
      if (!poolMeta) {
        return `Pool meta: ${query.isFetching ? "Loading..." : "unknown"}`;
      }
      return `Hook type: ${poolMeta.hook_type_label} • Reserves: ${poolMeta.reserves_display}`;
    },
    [poolMetaByAddress, query.isFetching],
  );

  return {
    ...query,
    data,
    getPoolMetaSummary,
    poolMetaByAddress,
  };
}
