import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { VETAPP_ACCOUNT_ADDRESS } from "@/constants";

export type ResetArguments = {
  tokenAddress: string;
};

export const reset = (args: ResetArguments): InputTransactionData => {
  const { tokenAddress } = args;

  return {
    data: {
      function: `${VETAPP_ACCOUNT_ADDRESS}::voter::reset`,
      functionArguments: [tokenAddress],
    },
  };
};
