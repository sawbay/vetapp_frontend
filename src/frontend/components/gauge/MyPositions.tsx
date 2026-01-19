import { useQuery } from "@tanstack/react-query";
import { AMM_ACCOUNT_ADDRESS, CLMM_ACCOUNT_ADDRESS, STABLE_ACCOUNT_ADDRESS } from "@/constants";
import { aptosClient } from "@/utils/aptosClient";
import { formatNumber8 } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { PoolType, PoolToken } from "@/components/gauge/types";

type MyPositionsProps = {
  tokens: PoolToken[];
  poolAddress: string;
  poolType: PoolType;
  onCopy: (value: string) => void;
  onCommit: (poolAddress: string, positionAddress: string) => void;
  onClaimFees: (poolAddress: string, positionAddress: string) => void;
  shorten: (value: string) => string;
  isSubmitting: boolean;
  isWalletReady: boolean;
};

export function MyPositions({
  tokens,
  poolAddress,
  poolType,
  onCopy,
  onCommit,
  onClaimFees,
  shorten,
  isSubmitting,
  isWalletReady,
}: MyPositionsProps) {
  return (
    <div className="rounded-lg border border-muted-foreground bg-card p-3">
      <div className="flex flex-col gap-2">
        {tokens.map((token) => (
          <MyPositionRow
            key={token.token_data_id}
            token={token}
            poolAddress={poolAddress}
            poolType={poolType}
            onCopy={onCopy}
            onCommit={onCommit}
            onClaimFees={onClaimFees}
            shorten={shorten}
            isSubmitting={isSubmitting}
            isWalletReady={isWalletReady}
          />
        ))}
      </div>
    </div>
  );
}

type MyPositionRowProps = {
  token: PoolToken;
  poolAddress: string;
  poolType: PoolType;
  onCopy: (value: string) => void;
  onCommit: (poolAddress: string, positionAddress: string) => void;
  onClaimFees: (poolAddress: string, positionAddress: string) => void;
  shorten: (value: string) => string;
  isSubmitting: boolean;
  isWalletReady: boolean;
};

function MyPositionRow({
  token,
  poolAddress,
  poolType,
  onCopy,
  onCommit,
  onClaimFees,
  shorten,
  isSubmitting,
  isWalletReady,
}: MyPositionRowProps) {
  const tokenName = token.current_token_data?.token_name ?? "";
  const positionIdx = Number(tokenName.split("_")[1]);
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
    queryKey: ["my-claimable", poolAddress, positionIdx, claimableAccountAddress ?? "", poolType],
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
    <div className="text-xs pl-4 flex flex-col gap-2">
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
          onClick={() => onCommit(poolAddress, token.token_data_id)}
        >
          Commit
        </Button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span>
          Earned fees:{" "}
          {canFetchClaimable ? (claimableFetching ? "Loading..." : claimableDisplay) : "unknown"}
        </span>
        <Button
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={!isWalletReady || isSubmitting || !canFetchClaimable}
          onClick={() => onClaimFees(poolAddress, token.token_data_id)}
        >
          Claim fees
        </Button>
      </div>
    </div>
  );
}
