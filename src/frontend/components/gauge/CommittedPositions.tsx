import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GAUGE_ACCOUNT_ADDRESS, VETAPP_ACCOUNT_ADDRESS } from "@/constants";
import { aptosClient } from "@/utils/aptosClient";
import { formatNumber8 } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { PoolToken, PoolType } from "@/components/gauge/types";
import { toast } from "@/components/ui/use-toast";
import { toastTransactionSuccess } from "@/utils/transactionToast";
import { gaugeUncommit } from "@/entry-functions/gaugeUncommit";

type CommittedPositionsProps = {
  committedPositions: PoolToken[];
  poolAddress: string;
  poolType: PoolType;
  onCopy: (value: string) => void;
  shorten: (value: string) => string;
  isSubmitting: boolean;
  isWalletReady: boolean;
};

export function CommittedPositions({
  committedPositions: tokens,
  poolAddress,
  poolType,
  onCopy,
  shorten,
  isSubmitting,
  isWalletReady,
}: CommittedPositionsProps) {
  const { account, signAndSubmitTransaction } = useWallet();
  const queryClient = useQueryClient();
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);
  const isBusy = isSubmitting || isSubmittingLocal;

  const onUncommit = async (positionAddress: string) => {
    if (!account || isBusy) {
      return;
    }

    try {
      setIsSubmittingLocal(true);
      const committedTransaction = await signAndSubmitTransaction(
        gaugeUncommit({
          poolAddress,
          positionAddress,
        }),
      );
      const executedTransaction = await aptosClient().waitForTransaction({
        transactionHash: committedTransaction.hash,
      });
      queryClient.invalidateQueries({ queryKey: ["user-positions", "gauge-pools"] });
      queryClient.invalidateQueries({
        queryKey: ["gauge-committed-positions", poolAddress.toLowerCase()],
      });
      toastTransactionSuccess(executedTransaction.hash);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to uncommit position.",
      });
    } finally {
      setIsSubmittingLocal(false);
    }
  };

  const onClaimReward = async (positionAddress: string) => {
    if (!account || isBusy || !positionAddress) {
      return;
    }
    if (!VETAPP_ACCOUNT_ADDRESS) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "VETAPP address not configured.",
      });
      return;
    }

    try {
      setIsSubmittingLocal(true);
      const committedTransaction = await signAndSubmitTransaction({
        data: {
          function: `${VETAPP_ACCOUNT_ADDRESS}::voter::claim_rewards`,
          functionArguments: [[poolAddress], [positionAddress]],
        },
      });
      const executedTransaction = await aptosClient().waitForTransaction({
        transactionHash: committedTransaction.hash,
      });
      queryClient.invalidateQueries({ queryKey: ["gauge-earned", poolAddress, positionAddress] });
      toastTransactionSuccess(executedTransaction.hash);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to claim reward.",
      });
    } finally {
      setIsSubmittingLocal(false);
    }
  };

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
            isSubmitting={isBusy}
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
  onUncommit: (positionAddress: string) => void;
  onClaimReward: (positionAddress: string) => void;
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
  const earnedBigInt = (() => {
    if (typeof earnedData === "bigint") {
      return earnedData;
    }
    if (typeof earnedData === "number") {
      if (!Number.isFinite(earnedData)) {
        return 0n;
      }
      return BigInt(Math.floor(earnedData));
    }
    if (typeof earnedData === "string") {
      try {
        return BigInt(earnedData);
      } catch {
        return 0n;
      }
    }
    return 0n;
  })();
  const isHighEarned = earnedBigInt > 100n * 100_000_000n;
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
          onClick={() => onUncommit(token.token_data_id)}
        >
          Uncommit
        </Button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={isHighEarned ? "text-red-500" : undefined}>
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
          onClick={() => onClaimReward(positionAddress)}
        >
          Get reward
        </Button>
      </div>
    </div>
  );
}
