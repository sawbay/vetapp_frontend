import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { VE_TAPP_HELPER_ADDRESS, VETAPP_ACCOUNT_ADDRESS } from "@/constants";
import { aptosClient } from "@/utils/aptosClient";
import { formatNumber8 } from "@/utils/format";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { updatePeriod } from "@/entry-functions/updatePeriod";
import { QuickAccess } from "./QuickAccess";
import { deriveVaultAddress } from "@/utils/helpers";
import { toastTransactionSuccess } from "@/utils/transactionToast";
import { useEpochData } from "@/hooks/useEpochData";

const toEpochSeconds = (value: EpochView): number | null => {
  const numeric = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toDisplay = (value: EpochView) => {
  const seconds = toEpochSeconds(value);
  if (seconds === null) {
    return `${value}`;
  }
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) {
    return `${value}`;
  }
  return date.toLocaleString();
};

export function Vote() {
  const { account, signAndSubmitTransaction } = useWallet();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adminSubmittingKey, setAdminSubmittingKey] = useState<string | null>(null);
  const { data, isFetching, isError } = useEpochData();

  if (!VETAPP_ACCOUNT_ADDRESS) {
    return <div className="text-sm text-muted-foreground">VETAPP address not configured.</div>;
  }

  if (isError) {
    return <div className="text-sm text-destructive">Failed to load vote epochs.</div>;
  }

  const onUpdatePeriod = async () => {
    if (!account || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      const committedTransaction = await signAndSubmitTransaction(updatePeriod());
      const executedTransaction = await aptosClient().waitForTransaction({
        transactionHash: committedTransaction.hash,
      });
      queryClient.invalidateQueries({ queryKey: ["helper-ve-epochs"] });
      toastTransactionSuccess(executedTransaction.hash);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update period.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const adminActions = [
    {
      key: "initialize",
      label: "Initialize (test)",
      functionName: "initialize",
      args: [
        true,
      ]
    },
    {
      key: "initialize",
      label: "Initialize (staging)",
      functionName: "initialize",
      args: [
        false,
      ]
    }
  ]

  const actions = [
    {
      key: "distribute-gauges",
      label: "Distribute Gauges",
      functionName: "distribute_gauges",
    },
  ];

  const runAction = async (action: {
    key: string;
    functionName: string;
    args?: Array<string | number | bigint | boolean>;
  }) => {
    if (!account || adminSubmittingKey) {
      return;
    }

    try {
      setAdminSubmittingKey(action.key);
      const committedTransaction = await signAndSubmitTransaction({
        data: {
          function: `${VE_TAPP_HELPER_ADDRESS}::helper_ve::${action.functionName}`,
          functionArguments: action.args ?? [],
        },
      });
      const executedTransaction = await aptosClient().waitForTransaction({
        transactionHash: committedTransaction.hash,
      });
      toastTransactionSuccess(executedTransaction.hash);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to run ${functionName}.`,
      });
    } finally {
      setAdminSubmittingKey(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <QuickAccess />
      <h4 className="text-base font-semibold tracking-tight text-foreground">Vote epochs</h4>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>{isFetching || !data ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid gap-2 text-xs">
            <div>
              Epoch start: {toDisplay(data.epochStart)} · Epoch next: {toDisplay(data.epochNext)}
            </div>
            <div>
              Vote start: {toDisplay(data.voteStart)} · Vote end: {toDisplay(data.voteEnd)}
            </div>
            <div>
              Active period: {toDisplay(data.activePeriod)} · Epoch count: {data.epochCount as number}
              <Button
                className="ml-2 h-7 px-2 text-xs"
                size="sm"
                disabled={!account || isSubmitting}
                onClick={onUpdatePeriod}
              >
                {isSubmitting ? "Updating..." : "Update Period"}
              </Button>
            </div>
            <div>Next weekly emission: {formatNumber8(data.weeklyEmission)}</div>
          </div>
        )}</div>
        <div>
          <Vaults />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="text-sm font-semibold uppercase tracking-wide text-amber-600">Admin</div>
        <div className="flex flex-wrap gap-2 text-xs">
          {adminActions.map((action) => (
            <Button
              key={action.key}
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={!account || Boolean(adminSubmittingKey)}
              onClick={() => runAction(action)}
            >
              {adminSubmittingKey === action.key ? "Running..." : action.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="text-sm font-semibold text-foreground">ANYONE</div>
        <div className="flex flex-wrap gap-2 text-xs">
          {actions.map((action) => (
            <Button
              key={action.key}
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={!account || Boolean(adminSubmittingKey)}
              onClick={() => runAction(action)}
            >
              {adminSubmittingKey === action.key ? "Running..." : action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Vaults() {
  const veTappVaultOf = (seed: string) => {
    return deriveVaultAddress(VETAPP_ACCOUNT_ADDRESS, seed).toString();
  };
  const vaults = [
    {
      key: "VOTER",
      label: "VOTER",
      address: veTappVaultOf("VOTER"),
      balanceLabel: "VOTER $TAPP balance",
    },
    {
      key: "VE_TAPP",
      label: "VE_TAPP",
      address: veTappVaultOf("VE_TAPP"),
      balanceLabel: "VE_TAPP $TAPP balance",
    },
    {
      key: "TEAM",
      label: "TEAM",
      address: veTappVaultOf("TEAM"),
      balanceLabel: "TEAM $TAPP balance",
    },
  ];
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
  const { data: vaultBalances, isFetching: isBalancesFetching } = useQuery({
    queryKey: ["vault-balances", tappTokenAddress, vaults.map((vault) => vault.address).join(",")],
    enabled: Boolean(VETAPP_ACCOUNT_ADDRESS && tappTokenAddress),
    queryFn: async (): Promise<(string | number | bigint | null)[]> => {
      if (!tappTokenAddress) {
        return vaults.map(() => null);
      }
      return Promise.all(
        vaults.map(async (vault) => {
          try {
            const [balance] = await aptosClient().view<[string | number | bigint]>({
              payload: {
                function: "0x1::primary_fungible_store::balance",
                typeArguments: ["0x1::fungible_asset::Metadata"],
                functionArguments: [vault.address, tappTokenAddress],
              },
            });
            return balance;
          } catch (error) {
            console.error(error);
            return null;
          }
        }),
      );
    },
  });

  return (
    <div className="text-xs text-muted-foreground">
      <table className="table-fixed border-collapse text-center">
        <thead>
          <tr className="border-b border-border">
            <th className="w-24 pb-2 font-medium">Vaults</th>
            {vaults.map((vault) => (
              <th key={vault.key} className="pb-2 font-medium">
                <div className="flex flex-col gap-1">
                  <a
                    className="break-all underline underline-offset-4"
                    href={`https://explorer.aptoslabs.com/account/${vault.address ?? ""}/resources`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {vault.label}
                  </a>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pt-2 font-medium">Balance</td>
            {vaults.map((vault, index) => {
              const balance = vaultBalances?.[index] ?? null;
              const displayBalance = balance === null ? null : formatNumber8(balance);
              return (
                <td key={vault.key} className="pt-2">
                  {displayBalance ?? (isBalancesFetching ? "Loading..." : "-")}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
