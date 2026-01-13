import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { aptosClient } from "@/utils/aptosClient";
import { VETAPP_ACCOUNT_ADDRESS } from "@/constants";
import { formatNumber8 } from "@/utils/format";

export type PoolMeta = {
  pool_addr: string;
  hook_type: number | null;
  hook_type_label: string;
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

export function usePool() {
  const query = useQuery({
    queryKey: ["pool-metas"],
    enabled: Boolean(VETAPP_ACCOUNT_ADDRESS),
    queryFn: async (): Promise<PoolMeta[]> => {
      if (!VETAPP_ACCOUNT_ADDRESS) {
        return [];
      }
      const result = await aptosClient().view<[Array<Record<string, unknown>>]>({
        payload: {
          function: `${VETAPP_ACCOUNT_ADDRESS}::helper_ve::pool_metas`,
        },
      });
      return (result[0] ?? []).filter(meta => (meta.hook_type as any) > 1).map((meta) => {
        const poolAddr = typeof meta?.pool_addr === "string" ? meta.pool_addr : "";
        const reserves = Array.isArray(meta?.reserves) ? meta.reserves : [];
        const hookTypeRaw = meta?.hook_type;
        const hookTypeNumber =
          typeof hookTypeRaw === "number" ? hookTypeRaw : Number.parseInt(String(hookTypeRaw), 10);
        const hookType = Number.isFinite(hookTypeNumber) ? hookTypeNumber : null;
        const reservesDisplay = Array.isArray(meta?.reserves)
          ? `[${reserves.map((value) => formatNumber8(value)).join(", ")}]`
          : "unknown";
        return {
          pool_addr: poolAddr,
          hook_type: hookType,
          hook_type_label: getHookTypeLabel(hookTypeRaw),
          reserves,
          reserves_display: reservesDisplay,
        };
      });
    },
  });

  const poolMetaByAddress = useMemo(() => {
    const map = new Map<string, PoolMeta>();
    (query.data ?? []).forEach((meta) => {
      if (meta.pool_addr) {
        map.set(normalizeAddress(meta.pool_addr), meta);
      }
    });
    return map;
  }, [query.data]);

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
    getPoolMetaSummary,
    poolMetaByAddress,
  };
}
