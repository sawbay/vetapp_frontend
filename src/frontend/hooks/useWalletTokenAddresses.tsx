import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { aptosClient } from "@/utils/aptosClient";
import { GetAccountCoinsDataResponse } from "@aptos-labs/ts-sdk";
const isAddress = (value: string) => /^0x[a-fA-F0-9]+$/.test(value);

export const FAUCET_TOKENS = [
  "0x22a7260f31c70045a2511504438e242175b84bdacae277cad40f4a04353e8848",
  "0xb61f9f829842869968edba4b88f0cf785ac6729fd664f50c7be8c630fd2daebc",
  "0x05affe54ac76b984e6b1841bee94ec786d85d4cdbc92060aae46ecf7a7a08f7d",
  "0xecd78bf4a290eb8cfba9c7993409e1fc81cd373cec06edacf0cb92d6565d7351",
  "0x8c58fb7fd3ccb2d7bc079dcbf924567fccd385b24b0f8afbfdebf87dc671ba07",
  "0x7538e517af47371976af23a1052bc64172cc65a029d1ef75b453a33d520f0b7f",
  "0x38a86e48d4f393c828813f954580dfc80a2cc9caba1d940ae262588ad7528b42",
];

export function useWalletFungibleTokens() {
  const { account } = useWallet();

  return useQuery({
    queryKey: ["wallet-token-addresses", account?.address],
    enabled: Boolean(account),
    queryFn: async (): Promise<GetAccountCoinsDataResponse> => {
      if (!account) {
        return [];
      }

      const coins = await aptosClient().getAccountCoinsData({
        accountAddress: account.address,
        options: { limit: 200, where: { token_standard: { _eq: "v2" } } },
      });
      return coins.filter(c => {
        const assetType = c.asset_type ?? "";
        return isAddress(assetType) && FAUCET_TOKENS.includes(assetType);
      });
    },
  });
}
