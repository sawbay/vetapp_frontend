import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { TAPP_ACCOUNT_ADDRESS } from "@/constants";

export type GaugeUncommitArguments = {
  poolAddress: string;
  positionAddress: string;
};

export const gaugeUncommit = (args: GaugeUncommitArguments): InputTransactionData => {
  const { poolAddress, positionAddress } = args;
  return {
    data: {
      function: `${TAPP_ACCOUNT_ADDRESS}::ve::gauge_uncommit`,
      functionArguments: [poolAddress, positionAddress],
    },
  };
};
