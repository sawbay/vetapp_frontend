import { useQuery } from "@tanstack/react-query";
import { AMM_ACCOUNT_ADDRESS, CLMM_ACCOUNT_ADDRESS, GAUGE_ACCOUNT_ADDRESS, STABLE_ACCOUNT_ADDRESS } from "@/constants";
import { aptosClient } from "@/utils/aptosClient";
import { formatNumber8 } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { PoolToken, PoolType } from "@/components/gauge/types";

type CommittedPositionsProps = {
  tokens: PoolToken[];
  poolAddress: string;
  poolType: PoolType;
  onCopy: (value: string) => void;
  onUncommit: (poolAddress: string, positionAddress: string) => void;
  onClaimReward: (poolAddress: string, positionAddress: string) => void;
  shorten: (value: string) => string;
  isSubmitting: boolean;
  isWalletReady: boolean;
};

export function CommittedPositions({
  tokens,
  poolAddress,
  poolType,
  onCopy,
  onUncommit,
  onClaimReward,
  shorten,
  isSubmitting,
  isWalletReady,
}: CommittedPositionsProps) {
  return (
    <div className="rounded-lg border border-muted-foreground bg-card p-3">
      <div className="flex flex-col gap-2">
        {tokens.map((token) => (
          <PoolTokenRow
            key={token.token_data_id}
            token={token}
            onCopy={onCopy}
            onUncommit={onUncommit}
            onClaimReward={onClaimReward}
            poolAddress={poolAddress}
            poolType={poolType}
            shorten={shorten}
            isSubmitting={isSubmitting}
            isWalletReady={isWalletReady}
          />
        ))}
      </div>
    </div>
  );
}

type PoolTokenRowProps = {
  token: PoolToken;
  onCopy: (value: string) => void;
  onUncommit: (poolAddress: string, positionAddress: string) => void;
  onClaimReward: (poolAddress: string, positionAddress: string) => void;
  poolAddress: string;
  poolType: PoolType;
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
  poolType,
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
          functionArguments: [poolAddress, positionIdx],
        },
      });
      return result[0];
    },
  });
  const isClmm = poolType === PoolType.CLMM;
  const claimableAccountAddress =
    poolType === PoolType.STABLE
      ? STABLE_ACCOUNT_ADDRESS
      : poolType === PoolType.CLMM
        ? CLMM_ACCOUNT_ADDRESS
        : AMM_ACCOUNT_ADDRESS;
  const canFetchClaimable = Boolean(
    (isClmm ? CLMM_ACCOUNT_ADDRESS : claimableAccountAddress) &&
      Number.isFinite(positionIdx),
  );
  const { data: claimableData, isFetching: claimableFetching } = useQuery({
    queryKey: ["claimable", poolAddress, positionIdx, claimableAccountAddress ?? "", poolType],
    enabled: canFetchClaimable,
    queryFn: async (): Promise<Array<string | number | bigint>> => {
      if (isClmm) {
        const result = await aptosClient().view<
          [string | number | bigint, string | number | bigint]
        >({
          payload: {
            function: `${CLMM_ACCOUNT_ADDRESS}::clmm::get_position_fee_owed`,
            functionArguments: [poolAddress, positionIdx],
          },
        });
        return [result[0], result[1]];
      }

      const result = await aptosClient().view<[Array<string | number | bigint>]>({
        payload: {
          function: `${claimableAccountAddress}::${poolType}::claimable`,
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
        <code
          className="border border-input rounded px-2 py-1"
          onClick={() => onCopy(token.token_data_id)}
        >
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
