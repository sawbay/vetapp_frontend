import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { VETAPP_ACCOUNT_ADDRESS } from "@/constants";

export type IncreaseUnlockTimeArguments = {
  tokenAddress: string;
  lockDuration: string;
};

export const increaseUnlockTime = (args: IncreaseUnlockTimeArguments): InputTransactionData => {
  const { tokenAddress, lockDuration } = args;
  return {
    data: {
      function: `${VETAPP_ACCOUNT_ADDRESS}::vetapp::increase_unlock_time`,
      functionArguments: [tokenAddress, lockDuration],
    },
  };
};
