import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";

const FAUCET_QUICKMINT_FUNCTION = "0x55f1d474cf8027c72dd3aaab5f47870a2a11990e17f728c69c8546d5e99645b3::faucet::quick_mint";

export const faucetQuickMint = (): InputTransactionData => {
  return {
    data: {
      function: FAUCET_QUICKMINT_FUNCTION,
      functionArguments: [100_00_000_000],
    },
  };
};
