import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { VETAPP_ACCOUNT_ADDRESS } from "@/constants";

export const updatePeriod = (): InputTransactionData => {
  return {
    data: {
      function: `${VETAPP_ACCOUNT_ADDRESS}::minter::update_period`,
      functionArguments: [],
    },
  };
};
