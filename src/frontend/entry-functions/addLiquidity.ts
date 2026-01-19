import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { VETAPP_ACCOUNT_ADDRESS } from "@/constants";

export type AddLiquidityArguments = {
  poolAddress: string;
};

export const addLiquidity = (args: AddLiquidityArguments): InputTransactionData => {
  const { poolAddress } = args;
  return {
    data: {
      function: `${VETAPP_ACCOUNT_ADDRESS}::helper_ve::add_liq`,
      functionArguments: [poolAddress],
    },
  };
};
