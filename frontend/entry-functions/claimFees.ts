import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { AccountAddress, Serializer } from "@aptos-labs/ts-sdk";
import { TAPP_ACCOUNT_ADDRESS } from "@/constants";

export type ClaimFeesArguments = {
  poolAddress: string;
  positionAddress: string;
};

const serializeClaimFeesArgs = (poolAddress: string, positionAddress: string) => {
  const serializer = new Serializer();
  AccountAddress.fromString(poolAddress).serialize(serializer);
  AccountAddress.fromString(positionAddress).serialize(serializer);
  return serializer.toUint8Array();
};

export const claimFees = (args: ClaimFeesArguments): InputTransactionData => {
  const { poolAddress, positionAddress } = args;
  const serializedArgs = serializeClaimFeesArgs(poolAddress, positionAddress);

  return {
    data: {
      function: `${TAPP_ACCOUNT_ADDRESS}::router::claim_fees`,
      functionArguments: [Array.from(serializedArgs)],
    },
  };
};
