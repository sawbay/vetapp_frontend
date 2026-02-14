import { GAUGE_ACCOUNT_ADDRESS, VETAPP_ACCOUNT_ADDRESS } from "@/constants";
import { aptosClient } from "@/utils/aptosClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CommittedPositions } from "@/components/gauge/CommittedPositions";
import { MyPositions } from "@/components/gauge/MyPositions";
import { PoolType, PoolToken } from "@/components/gauge/types";
import { useCommittedPositions } from "@/hooks/useCommittedPositions";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { initTappSDK } from '@tapp-exchange/sdk';

const sdk = initTappSDK();
type GaugePoolProps = {
  poolAddress: string;
  poolKey: string;
  poolMetaSummary: string;
  poolType: PoolType;
  myPositions: PoolToken[];
  isPinned: boolean;
  onCopy: (value: string) => void;
  onTogglePin: (poolKey: string) => void;
  onRemovePool: (poolAddress: string) => void;
  onOpenBribe: (poolAddress: string, poolKey: string) => void;
  onSwapPool: (poolAddress: string) => void;
  onAddLiquidity: (poolAddress: string) => void;
  shorten: (value: string) => string;
  isSubmitting: boolean;
  isWalletReady: boolean;
};

export function GaugePool({
  poolAddress,
  poolKey,
  poolMetaSummary,
  poolType,
  myPositions,
  isPinned,
  onCopy,
  onTogglePin,
  onRemovePool,
  onOpenBribe,
  onSwapPool,
  onAddLiquidity,
  shorten,
  isSubmitting,
  isWalletReady,
}: GaugePoolProps) {
  const { data: poolInfo, isFetching: isPoolInfoFetching, isError: isPoolInfoError } = useQuery({
    queryKey: ["pool-info", poolAddress],
    enabled: Boolean(poolAddress),
    queryFn: () => sdk.Pool.getInfo(poolAddress),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const formattedPoolMeta = useMemo(() => {
    if (!poolAddress) {
      return "";
    }
    if (isPoolInfoFetching) {
      return "Pool info: Loading...";
    }
    if (isPoolInfoError) {
      return "Pool info: unavailable";
    }
    if (!poolInfo) {
      return poolMetaSummary;
    }
    const tokenTickersWithReserves = poolInfo.tokens
      .map((token) => {
        const reserve = Number(token.reserve);
        const scaled = Number.isFinite(reserve)
          ? reserve / Math.pow(10, token.decimals || 0)
          : NaN;
        const display = Number.isFinite(scaled)
          ? (Math.floor(scaled * 100) / 100).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : "unknown";
        return `${token.ticker} ${display}`;
      })
      .filter(Boolean)
      .join(", ");
    const feeTierRaw = poolInfo.feeTier ?? "";
    const feeTier = feeTierRaw
      ? feeTierRaw.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "")
      : "";
    const poolType = poolInfo.poolType ?? "";
    return `${poolType} - ${feeTier} - {${tokenTickersWithReserves}}`.trim();
  }, [isPoolInfoError, isPoolInfoFetching, poolAddress, poolInfo, poolMetaSummary]);

  const { data: committedPositions = [], isFetching: isCommittedFetching } =
    useCommittedPositions(poolAddress);

  return (
    <Card className="text-xs border-muted-foreground shadow-sm">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="flex items-center gap-2 flex-wrap">
            <b>Pool: </b>
            <code
              className="border border-input rounded px-2 py-1"
              onClick={() => onCopy(poolAddress)}
            >
              {shorten(poolAddress)}
            </code>
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={!isWalletReady || isSubmitting}
              onClick={() => onOpenBribe(poolAddress, poolKey)}
            >
              Add Bribe
            </Button>
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={!isWalletReady || isSubmitting}
              onClick={() => onSwapPool(poolAddress)}
            >
              Swap
            </Button>
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={!isWalletReady || isSubmitting}
              onClick={() => onAddLiquidity(poolAddress)}
            >
              Add Liq
            </Button>
            <span className="text-xs text-muted-foreground">{formattedPoolMeta}</span>
          </h3>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-7 px-2 text-xs bg-[#39ff14] text-black hover:bg-[#2fe011]"
              disabled={isSubmitting}
              onClick={() => onTogglePin(poolKey)}
            >
              {isPinned ? "Unpin" : "Pin"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 px-2 text-xs"
              disabled={isSubmitting}
              onClick={() => onRemovePool(poolAddress)}
            >
              Remove
            </Button>
          </div>
        </div>

        <Left poolAddress={poolAddress} />
        {poolType !== PoolType.CLMM && <RewardPerToken poolAddress={poolAddress} />}
        <VoteWeight poolAddress={poolAddress} />

        <h3><b>My Positions</b></h3>
        <div className="flex flex-wrap items-center gap-2"></div>
        {myPositions.length === 0 ? (
          <p className="text-muted-foreground">No positions for this pool.</p>
        ) : (
          <MyPositions
            tokens={myPositions}
            poolAddress={poolAddress}
            poolType={poolType}
            onCopy={onCopy}
            shorten={shorten}
            isSubmitting={isSubmitting}
            isWalletReady={isWalletReady}
          />
        )}

        <h3><b>Committed Positions</b></h3>
        <div className="flex flex-wrap items-center gap-2"></div>
        {isCommittedFetching ? (
          <p className="text-muted-foreground">Loading committed positions...</p>
        ) : committedPositions.length === 0 ? (
          <p className="text-muted-foreground">No positions for this pool.</p>
        ) : (
          <CommittedPositions
            committedPositions={committedPositions}
            poolAddress={poolAddress}
            poolType={poolType}
            onCopy={onCopy}
            shorten={shorten}
            isSubmitting={isSubmitting}
            isWalletReady={isWalletReady}
          />
        )}
      </CardContent>
    </Card>
  );
}

type RewardPerTokenProps = {
  poolAddress: string;
};

type LeftProps = {
  poolAddress: string;
};

function Left({ poolAddress }: LeftProps) {
  const { data, isFetching } = useQuery({
    queryKey: ["gauge-left", poolAddress],
    enabled: Boolean(GAUGE_ACCOUNT_ADDRESS),
    queryFn: async (): Promise<string | number | bigint> => {
      const result = await aptosClient().view<[string | number | bigint]>({
        payload: {
          function: `${GAUGE_ACCOUNT_ADDRESS}::gauge::left`,
          functionArguments: [poolAddress],
        },
      });
      return result[0];
    },
  });

  return (
    <span>
      Left: {isFetching ? "Loading..." : formatDecimal8(data ?? 0)}
    </span>
  );
}

function formatDecimal8(value: string | number | bigint) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "0.00000000";
    }
    if (!Number.isInteger(value)) {
      return value.toFixed(8);
    }
  }

  const raw = value.toString();
  if (raw.includes(".")) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed.toFixed(8) : "0.00000000";
  }

  const base = 100000000n;
  const integer = BigInt(raw);
  const whole = integer / base;
  const fraction = integer % base;
  return `${whole}.${fraction.toString().padStart(8, "0")}`;
}

function RewardPerToken({ poolAddress }: RewardPerTokenProps) {
  const { data, isFetching } = useQuery({
    queryKey: ["gauge-reward-per-token", poolAddress],
    enabled: Boolean(GAUGE_ACCOUNT_ADDRESS),
    queryFn: async (): Promise<string | number | bigint> => {
      const result = await aptosClient().view<[string | number | bigint]>({
        payload: {
          function: `${GAUGE_ACCOUNT_ADDRESS}::gauge::reward_per_token`,
          functionArguments: [poolAddress],
        },
      });
      return result[0];
    },
  });

  return (
    <span>
      Reward per LP token: {isFetching ? "Loading..." : `${data ?? 0}`}
    </span>
  );
}

type VoteWeightProps = {
  poolAddress: string;
};

function VoteWeight({ poolAddress }: VoteWeightProps) {
  const { data, isFetching } = useQuery({
    queryKey: ["voter-weight", poolAddress],
    enabled: Boolean(VETAPP_ACCOUNT_ADDRESS),
    queryFn: async (): Promise<string | number | bigint> => {
      const result = await aptosClient().view<[string | number | bigint]>({
        payload: {
          function: `${VETAPP_ACCOUNT_ADDRESS}::voter::weights`,
          functionArguments: [poolAddress],
        },
      });
      return result[0];
    },
  });

  return (
    <span>
      Vote weight: {isFetching ? "Loading..." : `${data ?? 0}`}
    </span>
  );
}
