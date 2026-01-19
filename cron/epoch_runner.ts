import { Account, Aptos, AptosConfig, Ed25519PrivateKey, Network } from "@aptos-labs/ts-sdk";

export type DistributeGaugesConfig = {
  functionId: `${string}::${string}::${string}`;
  privateKey: string;
  network?: Network;
  apiKey?: string;
};

const buildAptosClient = (network: Network, apiKey?: string) =>
  new Aptos(new AptosConfig({ network, clientConfig: apiKey ? { API_KEY: apiKey } : undefined }));

export async function distributeGauges(config: DistributeGaugesConfig): Promise<string> {
  const account = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(config.privateKey) });
  const aptos = buildAptosClient(config.network ?? "mainnet", config.apiKey);
  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: config.functionId,
      functionArguments: [],
    },
  });
  const pending = await aptos.signAndSubmitTransaction({ signer: account, transaction });
  return pending.hash;
}
