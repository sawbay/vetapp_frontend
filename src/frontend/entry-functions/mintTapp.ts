import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { VETAPP_ACCOUNT_ADDRESS } from "@/constants";

export const mintTapp = (): InputTransactionData => {
  return {
    data: {
      function: `${VETAPP_ACCOUNT_ADDRESS}::helper_ve::mint_tapp`,
      functionArguments: [],
    },
  };
};
