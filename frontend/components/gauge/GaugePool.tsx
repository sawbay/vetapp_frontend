import { useQuery } from "@tanstack/react-query";
import { AMM_ACCOUNT_ADDRESS, GAUGE_ACCOUNT_ADDRESS } from "@/constants";
import { aptosClient } from "@/utils/aptosClient";
import { formatNumber8 } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type PoolToken = {
  token_data_id: string;
  amount: any;
  current_token_data?: {
    token_name: string;
  } | null;
};

type GaugePoolProps = {
  poolAddress: string;
  poolKey: string;
  tokens: PoolToken[];
  onCopy: (value: string) => void;
  onUncommit: (poolAddress: string, positionAddress: string) => void;
  onClaimReward: (poolAddress: string, positionAddress: string) => void;
  onOpenBribe: (poolAddress: string, poolKey: string) => void;
  shorten: (value: string) => string;
  isSubmitting: boolean;
  isWalletReady: boolean;
};

export function GaugePool({
  poolAddress,
  poolKey,
  tokens,
  onCopy,
  onUncommit,
  onClaimReward,
  onOpenBribe,
  shorten,
  isSubmitting,
  isWalletReady,
}: GaugePoolProps) {
  return (
    <Card className="text-xs border-muted-foreground shadow-sm">
      <CardContent className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2">
          <span>Pool: </span>
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
        </h3>
        <RewardPerToken poolAddress={poolAddress} />
        <div className="flex flex-wrap items-center gap-2"></div>
        {tokens.length === 0 ? (
          <p className="text-muted-foreground">No positions for this pool.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {tokens.map((token) => (
              <PoolTokenRow
                key={token.token_data_id}
                token={token}
                onCopy={onCopy}
                onUncommit={onUncommit}
                onClaimReward={onClaimReward}
                poolAddress={poolAddress}
                shorten={shorten}
                isSubmitting={isSubmitting}
                isWalletReady={isWalletReady}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type RewardPerTokenProps = {
  poolAddress: string;
};

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
    <span className="ml-2">
      Reward per LP token: {isFetching ? "Loading..." : `${data ?? 0}`}
    </span>
  );
}

type PoolTokenRowProps = {
  token: PoolToken;
  onCopy: (value: string) => void;
  onUncommit: (poolAddress: string, positionAddress: string) => void;
  onClaimReward: (poolAddress: string, positionAddress: string) => void;
  poolAddress: string;
  shorten: (value: string) => string;
  isSubmitting: boolean;
  isWalletReady: boolean;
};

function PoolTokenRow({
  token,
  onCopy,
  onUncommit,
  onClaimReward,
  poolAddress,
  shorten,
  isSubmitting,
  isWalletReady,
}: PoolTokenRowProps) {
  const tokenName = token.current_token_data?.token_name ?? "";
  const positionIdx = Number(tokenName.split("_")[1]);
  const positionAddress = token.token_data_id;
  const { data: earnedData, isFetching: earnedFetching } = useQuery({
    queryKey: ["gauge-earned", poolAddress, positionAddress],
    enabled: Boolean(GAUGE_ACCOUNT_ADDRESS && positionAddress),
    queryFn: async (): Promise<string | number | bigint> => {
      const result = await aptosClient().view<[string | number | bigint]>({
        payload: {
          function: `${GAUGE_ACCOUNT_ADDRESS}::gauge::earned`,
          functionArguments: [poolAddress, positionAddress],
        },
      });
      return result[0];
    },
  });
  const canFetchClaimable = Boolean(AMM_ACCOUNT_ADDRESS && Number.isFinite(positionIdx));
  const { data: claimableData, isFetching: claimableFetching } = useQuery({
    queryKey: ["amm-claimable", poolAddress, positionIdx],
    enabled: canFetchClaimable,
    queryFn: async (): Promise<Array<string | number | bigint>> => {
      const result = await aptosClient().view<[Array<string | number | bigint>]>({
        payload: {
          function: `${AMM_ACCOUNT_ADDRESS}::amm::claimable`,
          functionArguments: [poolAddress, positionIdx],
        },
      });
      return result[0] ?? [];
    },
  });
  const claimableDisplay = Array.isArray(claimableData)
    ? `[${claimableData.map((value) => formatNumber8(value)).join(", ")}]`
    : "0";
  return (
    <div className="text pl-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span>PositionID #{positionIdx}</span>
        <code className="border border-input rounded px-2 py-1" onClick={() => onCopy(token.token_data_id)}>
          {shorten(token.token_data_id)}
        </code>
        <Button
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={!isWalletReady || isSubmitting}
          onClick={() => onUncommit(poolAddress, token.token_data_id)}
        >
          Uncommit
        </Button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span>
          Earned fees:{" "}
          {canFetchClaimable ? (claimableFetching ? "Loading..." : claimableDisplay) : "unknown"}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span>
          Earned $TAPP:{" "}
          {positionAddress
            ? earnedFetching
              ? "Loading..."
              : formatNumber8(earnedData ?? 0)
            : "unknown"}
        </span>
        <Button
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={!isWalletReady || isSubmitting || !positionAddress}
          onClick={() => onClaimReward(poolAddress, positionAddress)}
        >
          Get reward
        </Button>
      </div>
    </div>
  );
}
