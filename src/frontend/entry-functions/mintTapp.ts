import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { VETAPP_ACCOUNT_ADDRESS } from "@/constants";
import { AccountAddress, U64 } from "@aptos-labs/ts-sdk";

export const mintTapp = (receiver: AccountAddress): InputTransactionData => {
  let args: any[] = [
    [receiver],
    [new U64(1000_00_000_000n)]
  ];
  return {
    data: {
      function: `${VETAPP_ACCOUNT_ADDRESS}::airdrop::distribute`,
      functionArguments: args,
    },
  };
};
