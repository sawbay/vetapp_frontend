import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGauge } from "@/hooks/useGauge";
import { usePool } from "@/hooks/usePool";
import { useUserPositions } from "@/hooks/useUserPositions";
import { useWalletFungibleTokens } from "@/hooks/useWalletTokenAddresses";
import { AMM_ACCOUNT_ADDRESS, VETAPP_ACCOUNT_ADDRESS } from "@/constants";
import { toast } from "@/components/ui/use-toast";
import { aptosClient } from "@/utils/aptosClient";
import { GaugePool } from "@/components/gauge/GaugePool";
import { AddBribe } from "@/components/gauge/AddBribe";
import { toastTransactionSuccess } from "@/utils/transactionToast";
import { PoolType, PoolToken } from "@/components/gauge/types";
import { gaugeCommit } from "@/entry-functions/gaugeCommit";
import { claimFees } from "@/entry-functions/claimFees";
import { gaugeUncommit } from "@/entry-functions/gaugeUncommit";
import { swapPool } from "@/entry-functions/swapPool";
import { addLiquidity } from "@/entry-functions/addLiquidity";

export function Gauge() {
  const { account, signAndSubmitTransaction } = useWallet();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBribeDialogOpen, setIsBribeDialogOpen] = useState(false);
  const [activeBribePool, setActiveBribePool] = useState<{
    poolAddress: string;
    poolKey: string;
  } | null>(null);
  const [bribeInputs, setBribeInputs] = useState<
    Record<string, { tokenAddress: string; amount: string }>
  >({});
  const { data, isFetching, isError } = useGauge();
  const { getPoolMetaSummary, poolMetaByAddress } = usePool();
  const { data: userPositions } = useUserPositions();
  const { data: walletFungibleTokens = [] } = useWalletFungibleTokens();
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
      toastTransactionSuccess(executedTransaction.hash);
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

  const onUncommit = async (poolAddress: string, positionAddress: string) => {
    if (!account || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
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
      toastTransactionSuccess(executedTransaction.hash);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to uncommit position.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onClaimFees = async (poolAddress: string, positionAddress: string) => {
    if (!account || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
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
      setIsSubmitting(false);
    }
  };

  const onClaimReward = async (poolAddress: string, positionAddress: string) => {
    if (!account || isSubmitting || !positionAddress) {
      return;
    }

    try {
      setIsSubmitting(true);
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
      setIsSubmitting(false);
    }
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

  const onSwapPool = async (poolAddress: string) => {
    if (!account || isSubmitting || !VETAPP_ACCOUNT_ADDRESS) {
      return;
    }

    try {
      setIsSubmitting(true);
      const committedTransaction = await signAndSubmitTransaction(
        swapPool({ poolAddress }),
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

  if (isError) {
    return <div className="text-sm text-destructive">Failed to load pools.</div>;
  }

  const isLoading = isFetching;
  const poolList = data?.pools ?? [];
  const poolTokens = data?.committedPositions ?? {};
  const userTokens = userPositions?.tokens ?? [];
  const activeBribeKey = activeBribePool?.poolKey ?? "";
  const activeBribeInput = activeBribeKey ? bribeInputs[activeBribeKey] ?? { tokenAddress: "", amount: "" } : { tokenAddress: "", amount: "" };

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
          {poolList.map((pool) => {
            const poolAddress = `${pool}`;
            const poolKey = poolAddress.toLowerCase();
            const tokens = poolTokens[poolKey] ?? [];
            const myPositions = userTokens.filter(
              (token) => getPoolAddressFromToken(token) === poolAddress,
            );
            const normalizedPoolAddress = poolAddress.toLowerCase().startsWith("0x")
              ? poolAddress.toLowerCase()
              : `0x${poolAddress.toLowerCase()}`;
            const poolMeta = poolMetaByAddress.get(normalizedPoolAddress);
            const poolType =
              poolMeta?.hook_type_label === "STABLE" || poolMeta?.hook_type === 4
                ? PoolType.STABLE
                : poolMeta?.hook_type_label === "V3" || poolMeta?.hook_type === 3
                  ? PoolType.CLMM
                  : PoolType.AMM;

            return (
              <GaugePool
                key={poolKey}
                poolAddress={poolAddress}
                poolKey={poolKey}
                poolMetaSummary={getPoolMetaSummary(poolAddress)}
                poolType={poolType}
                tokens={tokens}
                myPositions={myPositions}
                onCopy={onCopy}
                onCommit={onCommit}
                onClaimFees={onClaimFees}
                onUncommit={onUncommit}
                onClaimReward={onClaimReward}
                onOpenBribe={openBribeDialog}
                onSwapPool={onSwapPool}
                onAddLiquidity={onAddLiquidity}
                shorten={shorten}
                isSubmitting={isSubmitting}
                isWalletReady={Boolean(account)}
              />
            );
          })}
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
