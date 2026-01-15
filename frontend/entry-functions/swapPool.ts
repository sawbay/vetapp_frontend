import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { VETAPP_ACCOUNT_ADDRESS } from "@/constants";

export type SwapPoolArguments = {
  poolAddress: string;
};

export const swapPool = (args: SwapPoolArguments): InputTransactionData => {
  const { poolAddress } = args;
  return {
    data: {
      function: `${VETAPP_ACCOUNT_ADDRESS}::helper_ve::swaps_pool`,
      functionArguments: [poolAddress],
    },
  };
};
