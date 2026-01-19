import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { TAPP_ACCOUNT_ADDRESS } from "@/constants";

export type GaugeCommitArguments = {
  poolAddress: string;
  positionAddress: string;
};

export const gaugeCommit = (args: GaugeCommitArguments): InputTransactionData => {
  const { poolAddress, positionAddress } = args;
  return {
    data: {
      function: `${TAPP_ACCOUNT_ADDRESS}::ve::gauge_commit`,
      functionArguments: [poolAddress, positionAddress],
    },
  };
};
