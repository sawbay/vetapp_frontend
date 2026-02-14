import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { VE_TAPP_HELPER_ADDRESS } from "@/constants";

export type CreateLockArguments = {
  value: string | number;
  lockDuration: string | number;
};

export const createLock = (args: CreateLockArguments): InputTransactionData => {
  const { value, lockDuration } = args;
  return {
    data: {
      function: `${VE_TAPP_HELPER_ADDRESS}::helper_ve::create_lock`,
      functionArguments: [value, lockDuration],
    },
  };
};
