import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGauge } from "@/hooks/useGauge";
import { VETAPP_ACCOUNT_ADDRESS } from "@/constants";
import { toast } from "@/components/ui/use-toast";
import { aptosClient } from "@/utils/aptosClient";
import { Button } from "@/components/ui/button";
import { gaugeUncommit } from "@/entry-functions/gaugeUncommit";

export function Gauge() {
  const { account, signAndSubmitTransaction } = useWallet();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data, isFetching, isError } = useGauge();
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
      queryClient.invalidateQueries({ queryKey: ["gauge-pools"] });
      toast({
        title: "Success",
        description: `Transaction succeeded, hash: ${executedTransaction.hash}`,
      });
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

  if (!VETAPP_ACCOUNT_ADDRESS) {
    return <div className="text-sm text-muted-foreground">VETAPP address not configured.</div>;
  }

  if (isError) {
    return <div className="text-sm text-destructive">Failed to load pools.</div>;
  }

  const isLoading = isFetching;
  const poolList = data?.pools ?? [];
  const poolTokens = data?.poolTokens ?? {};

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

            return (
              <div key={poolKey} className="flex flex-col gap-2">
                <h3>
                  <span>Pool: </span>
                  <code
                    className="border border-input rounded px-2 py-1"
                    onClick={() => onCopy(poolAddress)}
                  >
                    {shorten(poolAddress)}
                  </code>
                </h3>
                {tokens.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No positions for this pool.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {tokens.map((token) => (
                      <span key={token.token_data_id} className="pl-4">
                        TokenID :
                        <code
                          className="border border-input rounded px-2 py-1"
                          onClick={() => onCopy(token.token_data_id)}
                        >
                          {shorten(token.token_data_id)}
                        </code>
                        <Button
                          className="ml-2"
                          size="sm"
                          disabled={!account || isSubmitting}
                          onClick={() => onUncommit(poolAddress, token.token_data_id)}
                        >
                          Uncommit
                        </Button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
