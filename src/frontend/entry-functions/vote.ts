import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { VETAPP_ACCOUNT_ADDRESS } from "@/constants";

export type VoteArguments = {
  tokenAddress: string;
  poolsVote: string[];
  weights: Array<string | number>;
};

export const vote = (args: VoteArguments): InputTransactionData => {
  const { tokenAddress, poolsVote, weights } = args;
  return {
    data: {
      function: `${VETAPP_ACCOUNT_ADDRESS}::voter::vote`,
      functionArguments: [tokenAddress, poolsVote, weights],
    },
  };
};
