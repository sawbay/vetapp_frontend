import { useQuery } from "@tanstack/react-query";
import { GAUGE_ACCOUNT_ADDRESS, VETAPP_ACCOUNT_ADDRESS } from "@/constants";
import { aptosClient } from "@/utils/aptosClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CommittedPositions } from "@/components/gauge/CommittedPositions";
import { MyPositions } from "@/components/gauge/MyPositions";
import { PoolType, PoolToken } from "@/components/gauge/types";

type GaugePoolProps = {
  poolAddress: string;
  poolKey: string;
  poolMetaSummary: string;
  poolType: PoolType;
  tokens: PoolToken[];
  myPositions: PoolToken[];
  onCopy: (value: string) => void;
  onCommit: (poolAddress: string, positionAddress: string) => void;
  onClaimFees: (poolAddress: string, positionAddress: string) => void;
  onUncommit: (poolAddress: string, positionAddress: string) => void;
  onClaimReward: (poolAddress: string, positionAddress: string) => void;
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
  tokens,
  myPositions,
  onCopy,
  onCommit,
  onClaimFees,
  onUncommit,
  onClaimReward,
  onOpenBribe,
  onSwapPool,
  onAddLiquidity,
  shorten,
  isSubmitting,
  isWalletReady,
}: GaugePoolProps) {
  return (
    <Card className="text-xs border-muted-foreground shadow-sm">
      <CardContent className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2">
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
          <span className="text-xs text-muted-foreground">{poolMetaSummary}</span>
        </h3>

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
            onCommit={onCommit}
            onClaimFees={onClaimFees}
            shorten={shorten}
            isSubmitting={isSubmitting}
            isWalletReady={isWalletReady}
          />
        )}

        <h3><b>Committed Positions</b></h3>
        <div className="flex flex-wrap items-center gap-2"></div>
        {tokens.length === 0 ? (
          <p className="text-muted-foreground">No positions for this pool.</p>
        ) : (
          <CommittedPositions
            tokens={tokens}
            poolAddress={poolAddress}
            poolType={poolType}
            onCopy={onCopy}
            onUncommit={onUncommit}
            onClaimReward={onClaimReward}
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
