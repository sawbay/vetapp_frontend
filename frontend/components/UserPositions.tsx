import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserPositions } from "@/hooks/useUserPositions";
import { usePool } from "@/hooks/usePool";
import { AMM_ACCOUNT_ADDRESS } from "@/constants";
import { toast } from "@/components/ui/use-toast";
import { aptosClient } from "@/utils/aptosClient";
import { formatNumber8 } from "@/utils/format";
import { Button } from "./ui/button";
import { gaugeCommit } from "@/entry-functions/gaugeCommit";

export function UserPositions() {
  const { account, signAndSubmitTransaction } = useWallet();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data, isFetching } = useUserPositions();
  const { data: poolMetas, getPoolMetaSummary } = usePool();

  const tokens = data?.tokens ?? [];
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
  const getPoolAddressFromToken = (token: PoolToken) => {
    let name = token.current_token_data?.token_name ?? token.token_data_id;
    name = name.split("_")[0].slice(1);
    return name;
  };

  const onCommit = async (poolAddress: string, positionAddress: string) => {
    if (!account || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      const committedTransaction = await signAndSubmitTransaction(
        gaugeCommit({
          poolAddress,
          positionAddress,
        }),
      );
      const executedTransaction = await aptosClient().waitForTransaction({
        transactionHash: committedTransaction.hash,
      });
      queryClient.invalidateQueries({ queryKey: ["position-commit", account.address] });
      toast({
        title: "Success",
        description: `Transaction succeeded, hash: ${executedTransaction.hash}`,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to commit position.",
      });
    } finally {
      setIsSubmitting(false);
      queryClient.invalidateQueries({ queryKey: ["user-positions", account.address] });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h4 className="text-lg font-medium">My positions</h4>
        <div className="text-sm text-muted-foreground">
          Collection address: {data?.collectionAddress ?? "unknown"}
        </div>
      </div>
      {!isFetching && tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tokens found for this collection.</p>
      ) : null}
      {tokens.length > 0 ? (
        <div className="text-sm flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            {(poolMetas ?? []).map((poolMeta) => {
              if (!poolMeta.pool_addr) {
                return null;
              }
              const poolAddress = poolMeta.pool_addr;
              const poolTokens = tokens.filter(
                (token) => getPoolAddressFromToken(token) === poolAddress,
              );
              return (
                <div key={poolAddress} className="flex flex-col gap-1">
                  <h3>
                    <span>Pool: </span>
                    <code
                      className="border border-input rounded px-2 py-1"
                      onClick={() => onCopy(poolAddress)}
                    >
                      {shorten(poolAddress)}
                    </code>
                    <span className="text-xs text-muted-foreground">
                      {getPoolMetaSummary(poolAddress)}
                    </span>
                  </h3>

                  {poolTokens.map((token) => (
                    <PoolTokenRow
                      key={token.token_data_id}
                      token={token}
                      onCopy={onCopy}
                      onCommit={onCommit}
                      poolAddress={poolAddress}
                      shorten={shorten}
                      isSubmitting={isSubmitting}
                      isWalletReady={Boolean(account)}
                    />
                  ))}
                  {poolTokens.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No positions in this pool.</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type PoolToken = {
  token_data_id: string;
  amount: any;
  current_token_data?: {
    token_name: string;
  } | null;
};

type PoolTokenRowProps = {
  token: PoolToken;
  onCopy: (value: string) => void;
  onCommit: (poolAddress: string, positionAddress: string) => void;
  poolAddress: string;
  shorten: (value: string) => string;
  isSubmitting: boolean;
  isWalletReady: boolean;
};

function PoolTokenRow({
  token,
  onCopy,
  onCommit,
  poolAddress,
  shorten,
  isSubmitting,
  isWalletReady,
}: PoolTokenRowProps) {
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
