import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { AMM_ACCOUNT_ADDRESS, GAUGE_ACCOUNT_ADDRESS, TAPP_ACCOUNT_ADDRESS, VETAPP_ACCOUNT_ADDRESS } from "@/constants";
import { toast } from "@/components/ui/use-toast";
import { faucetQuickMint } from "@/entry-functions/faucetQuickMint";
import { aptosClient } from "@/utils/aptosClient";

export function QuickAccess() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: tappTokenAddress } = useQuery({
    queryKey: ["tapp-token-address"],
    enabled: Boolean(VETAPP_ACCOUNT_ADDRESS),
    queryFn: async (): Promise<string> => {
      const result = await aptosClient().view<[string]>({
        payload: {
          function: `${VETAPP_ACCOUNT_ADDRESS}::tapp::token_address`,
        },
      });
      return result[0];
    },
  });

  const onQuickMint = async () => {
    if (!account || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      const committedTransaction = await signAndSubmitTransaction(faucetQuickMint());
      const executedTransaction = await aptosClient().waitForTransaction({
        transactionHash: committedTransaction.hash,
      });
      toast({
        title: "Success",
        description: `Transaction succeeded, hash: ${executedTransaction.hash}`,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to mint from faucet.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
      Packages:
      <a
        className="underline underline-offset-4"
        href={`https://explorer.aptoslabs.com/account/${TAPP_ACCOUNT_ADDRESS ?? ""}/modules/packages`}
        target="_blank"
        rel="noreferrer"
      >
        Tap Router
      </a>
      <a
        className="underline underline-offset-4"
        href={`https://explorer.aptoslabs.com/account/${VETAPP_ACCOUNT_ADDRESS ?? ""}/modules/packages`}
        target="_blank"
        rel="noreferrer"
      >
        veTAPP
      </a>
      <a
        className="underline underline-offset-4"
        href={`https://explorer.aptoslabs.com/account/${GAUGE_ACCOUNT_ADDRESS ?? ""}/modules/packages`}
        target="_blank"
        rel="noreferrer"
      >
        Gauge
      </a>
      <a
        className="underline underline-offset-4"
        href={`https://explorer.aptoslabs.com/account/${AMM_ACCOUNT_ADDRESS ?? ""}/modules/packages`}
        target="_blank"
        rel="noreferrer"
      >
        AMM
      </a>

      Others:
      <a
        className="underline underline-offset-4"
        href={`https://explorer.aptoslabs.com/account/${tappTokenAddress ?? ""}/resources`}
        target="_blank"
        rel="noreferrer"
      >
        $TAPP
      </a>
      <a
        className="underline underline-offset-4"
        rel="noreferrer"
        onClick={onQuickMint} 
      >
        FAUCET
      </a>
    </div>
  );
}
