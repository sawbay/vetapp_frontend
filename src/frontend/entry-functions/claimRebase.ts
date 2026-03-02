import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { VETAPP_ACCOUNT_ADDRESS } from "@/constants";

export type ClaimRebaseArguments = {
  tokenAddress: string;
};

export const claimRebase = (args: ClaimRebaseArguments): InputTransactionData => {
  const { tokenAddress } = args;

  return {
    data: {
      function: `${VETAPP_ACCOUNT_ADDRESS}::rewards_distributor::claim_rebase`,
      functionArguments: [tokenAddress],
    },
  };
};
