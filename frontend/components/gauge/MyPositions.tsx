import { useQuery } from "@tanstack/react-query";
import { AMM_ACCOUNT_ADDRESS } from "@/constants";
import { aptosClient } from "@/utils/aptosClient";
import { formatNumber8 } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { PoolToken } from "@/components/gauge/types";

type MyPositionsProps = {
  tokens: PoolToken[];
  poolAddress: string;
  onCopy: (value: string) => void;
  onCommit: (poolAddress: string, positionAddress: string) => void;
  shorten: (value: string) => string;
  isSubmitting: boolean;
  isWalletReady: boolean;
};

export function MyPositions({
  tokens,
  poolAddress,
  onCopy,
  onCommit,
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
            onCopy={onCopy}
            onCommit={onCommit}
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
  onCopy: (value: string) => void;
  onCommit: (poolAddress: string, positionAddress: string) => void;
  shorten: (value: string) => string;
  isSubmitting: boolean;
  isWalletReady: boolean;
};

function MyPositionRow({
  token,
  poolAddress,
  onCopy,
  onCommit,
  shorten,
  isSubmitting,
  isWalletReady,
}: MyPositionRowProps) {
  const tokenName = token.current_token_data?.token_name ?? "";
  const positionIdx = Number(tokenName.split("_")[1]);
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
      </div>
    </div>
  );
}
