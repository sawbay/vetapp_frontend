import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { VETAPP_ACCOUNT_ADDRESS } from "@/constants";

export type CreateLockArguments = {
  value: string | number;
  lockDuration: string | number;
};

export const createLock = (args: CreateLockArguments): InputTransactionData => {
  const { value, lockDuration } = args;
  return {
    data: {
      function: `${VETAPP_ACCOUNT_ADDRESS}::helper_ve::create_lock`,
      functionArguments: [value, lockDuration],
    },
  };
};
