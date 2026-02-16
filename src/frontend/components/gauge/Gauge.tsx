import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { initTappSDK, PoolType as TappPoolType } from "@tapp-exchange/sdk";
import { useQuery } from "@tanstack/react-query";
import { PoolMeta, usePool } from "@/hooks/usePool";
import { useUserPositions } from "@/hooks/useUserPositions";
import { useWalletFungibleTokens } from "@/hooks/useWalletTokenAddresses";
import {
  AMM_ACCOUNT_ADDRESS,
  NETWORK,
  TAPP_ACCOUNT_ADDRESS,
  VETAPP_ACCOUNT_ADDRESS,
} from "@/constants";
import { toast } from "@/components/ui/use-toast";
import { aptosClient } from "@/utils/aptosClient";
import { formatNumber8 } from "@/utils/format";
import { GaugePool } from "@/components/gauge/GaugePool";
import { AddBribe } from "@/components/gauge/AddBribe";
import { toastTransactionSuccess } from "@/utils/transactionToast";
import { PoolType, PoolToken } from "@/components/gauge/types";
import { swapPool } from "@/entry-functions/swapPool";
import { addLiquidity } from "@/entry-functions/addLiquidity";

export function Gauge() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBribeDialogOpen, setIsBribeDialogOpen] = useState(false);
  const [activeBribePool, setActiveBribePool] = useState<{
    poolAddress: string;
    poolKey: string;
  } | null>(null);
  const [bribeInputs, setBribeInputs] = useState<
    Record<string, { tokenAddress: string; amount: string }>
  >({});
  const { data: poolMetas = [], getPoolMetaSummary, poolMetaByAddress } = usePool();
  const { data: userPositions } = useUserPositions();
  const { data: walletFungibleTokens = [] } = useWalletFungibleTokens();
  const isMainnet = NETWORK?.toLowerCase() === "mainnet";
  const tappSdk = useMemo(() => (isMainnet ? initTappSDK() : null), [isMainnet]);
  const [pinnedPools, setPinnedPools] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    try {
      const raw = window.localStorage.getItem("pinned-gauges");
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const [selectedPoolKey, setSelectedPoolKey] = useState<string>("");
  const shorten = (s: string) => `${s.slice(0, 6)}...${s.slice(-4)}`;
  const onCopy = async (data: string) => {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(data);
      toast({
        title: "Copied",
        description: data,
      });
    }
  };
  const openBribeDialog = (poolAddress: string, poolKey: string) => {
    setActiveBribePool({ poolAddress, poolKey });
    setIsBribeDialogOpen(true);
  };
  const onBribeDialogChange = (open: boolean) => {
    setIsBribeDialogOpen(open);
    if (!open) {
      setActiveBribePool(null);
    }
  };
  const onTogglePin = (poolKey: string) => {
    setPinnedPools((prev) => {
      if (prev.includes(poolKey)) {
        return prev.filter((key) => key !== poolKey);
      }
      return [...prev, poolKey];
    });
  };

  const getPoolAddressFromToken = (token: PoolToken) => {
    let name = token.current_token_data?.token_name ?? token.token_data_id;
    name = name.split("_")[0].slice(1);
    return name;
  };

  const normalizeAddress = (address: string) => {
    const normalized = address.toLowerCase();
    return normalized.startsWith("0x") ? normalized : `0x${normalized}`;
  };

  const removeManualPool = (_poolAddress: string) => {
    // No-op now that pool list is sourced from chain/SDK.
  };

  const onDistributeBribes = async (poolAddress: string, poolKey: string) => {
    if (!account || isSubmitting) {
      return;
    }
    if (!AMM_ACCOUNT_ADDRESS) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "AMM address not configured.",
      });
      return;
    }

    const inputs = bribeInputs[poolKey];
    const tokenAddress = inputs?.tokenAddress?.trim() ?? "";
    const amount = inputs?.amount?.trim() ?? "";

    if (!tokenAddress || !amount) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Token address and amount are required.",
      });
      return;
    }

    if (!/^0x[a-fA-F0-9]+$/.test(tokenAddress) || !/^\d+$/.test(amount)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Token address or amount is invalid.",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const committedTransaction = await signAndSubmitTransaction({
        data: {
          function: `${VETAPP_ACCOUNT_ADDRESS}::voter::distribute_bribes`,
          functionArguments: [[poolAddress], [tokenAddress], [amount]],
        },
      });
      const executedTransaction = await aptosClient().waitForTransaction({
        transactionHash: committedTransaction.hash,
      });
      toastTransactionSuccess(executedTransaction.hash);
      setBribeInputs((prev) => ({
        ...prev,
        [poolKey]: { tokenAddress, amount: "" },
      }));
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to distribute bribes.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSwapPool = async (poolMeta?: PoolMeta) => {
    if (!account || isSubmitting || !TAPP_ACCOUNT_ADDRESS || !poolMeta) {
      return;
    }

    try {
      setIsSubmitting(true);
      const committedTransaction = await signAndSubmitTransaction(
        swapPool({poolMeta}),
      );
      const executedTransaction = await aptosClient().waitForTransaction({
        transactionHash: committedTransaction.hash,
      });
      toastTransactionSuccess(executedTransaction.hash);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to swap pool.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onAddLiquidity = async (poolAddress: string) => {
    if (!account || isSubmitting || !VETAPP_ACCOUNT_ADDRESS) {
      return;
    }

    try {
      setIsSubmitting(true);
      const committedTransaction = await signAndSubmitTransaction(
        addLiquidity({ poolAddress }),
      );
      const executedTransaction = await aptosClient().waitForTransaction({
        transactionHash: committedTransaction.hash,
      });
      toastTransactionSuccess(executedTransaction.hash);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add liquidity.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const setBribeInput = (poolKey: string, field: "tokenAddress" | "amount", value: string) => {
    setBribeInputs((prev) => ({
      ...prev,
      [poolKey]: {
        tokenAddress: prev[poolKey]?.tokenAddress ?? "",
        amount: prev[poolKey]?.amount ?? "",
        [field]: value,
      },
    }));
  };

  if (!VETAPP_ACCOUNT_ADDRESS) {
    return <div className="text-sm text-muted-foreground">VETAPP address not configured.</div>;
  }

  const { data: tappPools = [], isFetching: isTappPoolsFetching } = useQuery({
    queryKey: ["tapp-pools"],
    enabled: isMainnet,
    queryFn: async () => {
      if (!tappSdk) {
        return [];
      }
      const poolIds: string[] = [];
      const pageSize = 200;
      const limit = 30;
      let page = 1;
      let total = Number.POSITIVE_INFINITY;

      while (poolIds.length < total && poolIds.length < limit) {
        const result = await tappSdk.Pool.getPools({
          page,
          size: pageSize,
          sortBy: "tvl",
        });
        const pageIds = result.data?.map((pool) => pool.poolId) ?? [];
        total = Number.isFinite(result.total) ? result.total : pageIds.length;
        poolIds.push(...pageIds);
        if (pageIds.length === 0) {
          break;
        }
        page += 1;
      }

      return poolIds.slice(0, limit);
    },
  });
  const poolList = isMainnet ? tappPools : poolMetas.map((meta) => meta.pool_addr).filter(Boolean);
  const isLoading = isMainnet ? isTappPoolsFetching : false;
  const userTokens = userPositions?.tokens ?? [];
  const activeBribeKey = activeBribePool?.poolKey ?? "";
  const activeBribeInput = activeBribeKey ? bribeInputs[activeBribeKey] ?? { tokenAddress: "", amount: "" } : { tokenAddress: "", amount: "" };
  const poolEntries = poolList.map((pool) => ({
    poolAddress: `${pool}`,
    poolKey: `${pool}`.toLowerCase(),
  }));
  const poolByKey = new Map(poolEntries.map((entry) => [entry.poolKey, entry]));
  const pinnedSet = new Set(pinnedPools);
  const orderedPools = [
    ...pinnedPools
      .map((poolKey) => poolByKey.get(poolKey))
      .filter((entry): entry is { poolAddress: string; poolKey: string } => Boolean(entry)),
    ...poolEntries.filter((entry) => !pinnedSet.has(entry.poolKey)),
  ];

  useEffect(() => {
    if (orderedPools.length === 0) {
      setSelectedPoolKey("");
      return;
    }
    if (!selectedPoolKey || !orderedPools.some((entry) => entry.poolKey === selectedPoolKey)) {
      setSelectedPoolKey(orderedPools[0].poolKey);
    }
  }, [orderedPools, selectedPoolKey]);

  const selectedEntry = selectedPoolKey ? poolByKey.get(selectedPoolKey) : undefined;
  const selectedPoolAddress = selectedEntry?.poolAddress ?? "";
  const selectedMyPositions = selectedPoolAddress
    ? userTokens.filter((token) => getPoolAddressFromToken(token) === selectedPoolAddress)
    : [];
  const selectedPoolMeta = selectedPoolAddress
    ? poolMetaByAddress.get(normalizeAddress(selectedPoolAddress))
    : undefined;
  const { data: tappPoolInfo, isFetching: isTappPoolFetching } = useQuery({
    queryKey: ["tapp-pool-info", selectedPoolAddress],
    enabled: isMainnet && Boolean(selectedPoolAddress),
    queryFn: async () => {
      if (!tappSdk || !selectedPoolAddress) {
        return null;
      }
      return tappSdk.Pool.getInfo(selectedPoolAddress);
    },
  });
  const tappPoolMeta = useMemo<PoolMeta | undefined>(() => {
    if (!tappPoolInfo) {
      return undefined;
    }
    const hookType =
      tappPoolInfo.poolType === TappPoolType.CLMM
        ? 3
        : tappPoolInfo.poolType === TappPoolType.STABLE
          ? 4
          : 2;
    const hookTypeLabel =
      tappPoolInfo.poolType === TappPoolType.CLMM
        ? "V3"
        : tappPoolInfo.poolType === TappPoolType.STABLE
          ? "STABLE"
          : "V2";
    const reserves = tappPoolInfo.tokens?.map((token) => token.reserve) ?? [];
    const reservesDisplay = `[${reserves.map((value) => formatNumber8(value)).join(", ")}]`;
    return {
      pool_addr: tappPoolInfo.poolId,
      hook_type: hookType,
      hook_type_label: hookTypeLabel,
      reserves,
      reserves_display: reservesDisplay,
    };
  }, [tappPoolInfo]);
  const selectedPoolMetaEffective = isMainnet ? tappPoolMeta : selectedPoolMeta;
  const selectedPoolType =
    selectedPoolMetaEffective?.hook_type_label === "STABLE" ||
    selectedPoolMetaEffective?.hook_type === 4
      ? PoolType.STABLE
      : selectedPoolMetaEffective?.hook_type_label === "V3" ||
          selectedPoolMetaEffective?.hook_type === 3
        ? PoolType.CLMM
        : PoolType.AMM;
  const selectedPoolMetaSummary = selectedPoolAddress
    ? isMainnet
      ? tappPoolMeta
        ? `Hook type: ${tappPoolMeta.hook_type_label} • Reserves: ${tappPoolMeta.reserves_display}`
        : `Pool meta: ${isTappPoolFetching ? "Loading..." : "unknown"}`
      : getPoolMetaSummary(selectedPoolAddress)
    : "";
  const selectedIsPinned = selectedEntry ? pinnedSet.has(selectedEntry.poolKey) : false;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem("pinned-gauges", JSON.stringify(pinnedPools));
    } catch {
      // Ignore storage errors.
    }
  }, [pinnedPools]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h4 className="text-lg font-medium">Gauge pools</h4>
        <div className="text-sm text-muted-foreground">Pools: {poolList.length}</div>
      </div>
      {isLoading ? <div className="text-sm text-muted-foreground">Loading...</div> : null}
      {!isLoading && poolList.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pools configured.</p>
      ) : null}
      {!isLoading && poolList.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto pb-2">
            {orderedPools.map(({ poolAddress, poolKey }) => {
              const buttonActive = selectedPoolKey === poolKey;
              const buttonPinned = pinnedSet.has(poolKey);
              return (
                <button
                  key={poolKey}
                  type="button"
                  className={`inline-flex min-w-[140px] max-w-[220px] items-center gap-1 truncate whitespace-nowrap rounded border px-3 py-1 text-xs font-medium transition ${
                    buttonActive
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                      : "border-input bg-background hover:border-primary"
                  }`}
                  onClick={() => setSelectedPoolKey(poolKey)}
                >
                  {shorten(poolAddress)}
                  {buttonPinned ? <span className="text-emerald-600">★</span> : null}
                </button>
              );
            })}
          </div>
          {selectedEntry ? (
            <GaugePool
              poolAddress={selectedPoolAddress}
              poolKey={selectedEntry.poolKey}
              poolMetaSummary={selectedPoolMetaSummary}
              poolType={selectedPoolType}
              myPositions={selectedMyPositions}
              isPinned={selectedIsPinned}
              onCopy={onCopy}
              onTogglePin={onTogglePin}
              onRemovePool={removeManualPool}
              onOpenBribe={openBribeDialog}
              onSwapPool={() => onSwapPool(selectedPoolMetaEffective)}
              onAddLiquidity={onAddLiquidity}
              shorten={shorten}
              isSubmitting={isSubmitting}
              isWalletReady={Boolean(account)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Select a pool to view details.</p>
          )}
        </div>
      ) : null}
      <AddBribe
        open={isBribeDialogOpen}
        onOpenChange={onBribeDialogChange}
        activeBribePool={activeBribePool}
        activeBribeInput={activeBribeInput}
        walletFungibleTokens={walletFungibleTokens}
        isSubmitting={isSubmitting}
        isWalletReady={Boolean(account)}
        onCopy={onCopy}
        shorten={shorten}
        onDistributeBribes={onDistributeBribes}
        setBribeInput={setBribeInput}
      />
    </div>
  );
}
