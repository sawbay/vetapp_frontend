import { useState } from "react";
import { InputTransactionData, useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { initTappSDK, LiquidityType } from "@tapp-exchange/sdk";
import { AMM_ACCOUNT_ADDRESS, CLMM_ACCOUNT_ADDRESS, NETWORK, STABLE_ACCOUNT_ADDRESS } from "@/constants";
import { aptosClient } from "@/utils/aptosClient";
import { formatNumber8 } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { PoolType, PoolToken } from "@/components/gauge/types";
import { toast } from "@/components/ui/use-toast";
import { toastTransactionSuccess } from "@/utils/transactionToast";
import { gaugeCommit } from "@/entry-functions/gaugeCommit";
import { claimFees } from "@/entry-functions/claimFees";

type MyPositionsProps = {
  tokens: PoolToken[];
  poolAddress: string;
  poolType: PoolType;
  onCopy: (value: string) => void;
  shorten: (value: string) => string;
  isSubmitting: boolean;
  isWalletReady: boolean;
};

export function MyPositions({
  tokens,
  poolAddress,
  poolType,
  onCopy,
  shorten,
  isSubmitting,
  isWalletReady,
}: MyPositionsProps) {
  const { account, signAndSubmitTransaction } = useWallet();
  const queryClient = useQueryClient();
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);
  const isBusy = isSubmitting || isSubmittingLocal;
  const isMainnet = NETWORK?.toLowerCase() === "mainnet";
  const tappSdk = isMainnet ? initTappSDK() : null;

  const normalizeSdkPayloadArguments = (args: unknown[]) =>
    args.map((arg) => (arg instanceof Uint8Array ? Array.from(arg) : arg));

  const onCommit = async (positionAddress: string) => {
    if (!account || isBusy) {
      return;
    }

    try {
      setIsSubmittingLocal(true);
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
      queryClient.invalidateQueries({
        queryKey: ["gauge-committed-positions", poolAddress.toLowerCase()],
      });
      toastTransactionSuccess(executedTransaction.hash);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to commit position.",
      });
    } finally {
      setIsSubmittingLocal(false);
      queryClient.invalidateQueries({ queryKey: ["user-positions", account.address] });
    }
  };

  const onClaimFees = async (positionAddress: string) => {
    if (!account || isBusy) {
      return;
    }

    try {
      setIsSubmittingLocal(true);
      const committedTransaction = await signAndSubmitTransaction(
        claimFees({
          poolAddress,
          positionAddress,
        }),
      );
      const executedTransaction = await aptosClient().waitForTransaction({
        transactionHash: committedTransaction.hash,
      });
      queryClient.invalidateQueries({ queryKey: ["my-claimable", poolAddress] });
      toastTransactionSuccess(executedTransaction.hash);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to claim fees.",
      });
    } finally {
      setIsSubmittingLocal(false);
    }
  };

  const onRemoveLiquidity = async (positionAddress: string) => {
    if (!account || isBusy) {
      return;
    }

    if (!isMainnet || !tappSdk) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Remove liquidity through TAPP SDK is only available on mainnet.",
      });
      return;
    }

    try {
      setIsSubmittingLocal(true);
      const positions = await tappSdk.Position.getPositions({
        userAddr: account.address.toString(),
        page: 1,
        size: 200,
      });
      const position = positions.data.find((entry) => entry.positionAddr === positionAddress);
      if (!position) {
        throw new Error("Position not found in TAPP SDK response.");
      }

      const removePayload =
        poolType === PoolType.CLMM
          ? tappSdk.Position.removeSingleCLMMLiquidity({
              poolId: position.poolId,
              positionAddr: position.positionAddr,
              mintedShare: BigInt(position.mintedShare),
              minAmount0: 0,
              minAmount1: 0,
            })
          : poolType === PoolType.STABLE
            ? tappSdk.Position.removeSingleStableLiquidity({
                poolId: position.poolId,
                liquidityType: LiquidityType.Ratio,
                position: {
                  positionAddr: position.positionAddr,
                  mintedShare: BigInt(position.mintedShare),
                  amounts: position.estimatedWithdrawals.map(() => 0),
                },
              })
            : tappSdk.Position.removeSingleAMMLiquidity({
                poolId: position.poolId,
                positionAddr: position.positionAddr,
                mintedShare: BigInt(position.mintedShare),
                minAmount0: 0,
                minAmount1: 0,
              });

      const removeTransaction: InputTransactionData = {
        data: {
          ...removePayload,
          functionArguments: normalizeSdkPayloadArguments(removePayload.functionArguments ?? []),
        } as InputTransactionData["data"],
      };
      const committedTransaction = await signAndSubmitTransaction(removeTransaction);
      const executedTransaction = await aptosClient().waitForTransaction({
        transactionHash: committedTransaction.hash,
      });

      queryClient.invalidateQueries({ queryKey: ["user-positions", account.address] });
      queryClient.invalidateQueries({
        queryKey: ["gauge-committed-positions", poolAddress.toLowerCase()],
      });
      toastTransactionSuccess(executedTransaction.hash);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to remove liquidity${error instanceof Error ? `: ${error.message}` : "."}`,
      });
    } finally {
      setIsSubmittingLocal(false);
    }
  };

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
            onRemoveLiquidity={onRemoveLiquidity}
            shorten={shorten}
            isSubmitting={isBusy}
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
  onCommit: (positionAddress: string) => void;
  onClaimFees: (positionAddress: string) => void;
  onRemoveLiquidity: (positionAddress: string) => void;
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
  onRemoveLiquidity,
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
          onClick={() => onCommit(token.token_data_id)}
        >
          Commit
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="h-7 px-2 text-xs"
          disabled={!isWalletReady || isSubmitting}
          onClick={() => onRemoveLiquidity(token.token_data_id)}
        >
          Remove liquidity
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
          onClick={() => onClaimFees(token.token_data_id)}
        >
          Claim fees
        </Button>
      </div>
    </div>
  );
}
