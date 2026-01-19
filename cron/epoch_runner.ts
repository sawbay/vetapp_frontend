import { Account, Aptos, AptosConfig, Ed25519PrivateKey, Network } from "@aptos-labs/ts-sdk";

export type DistributeGaugesConfig = {
  functionId: `${string}::${string}::${string}`;
  privateKey: string;
  network?: Network;
  apiKey?: string;
};

export async function distributeGauges(config: DistributeGaugesConfig): Promise<string> {
  try {
    const account = Account.fromPrivateKey({
      privateKey: new Ed25519PrivateKey(config.privateKey) 
    });
    const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
    const txn = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: config.functionId,
        functionArguments: [],
      },
    });

    const simulation = await aptos.transaction.simulate.simple({
        transaction: txn,
        options: {
          estimateGasUnitPrice: true,
          estimateMaxGasAmount: true
        }
    });
    console.log(simulation);

    const senderAuthenticator = aptos.transaction.sign({
      signer: account,
      transaction: txn,
    });
    const submittedTransaction = await aptos.transaction.submit.simple({
      transaction: txn,
      senderAuthenticator,
    });

    const executedTransaction = await aptos.waitForTransaction({ transactionHash: submittedTransaction.hash });
    console.log(executedTransaction.hash);

    return executedTransaction.hash;
  } catch (error) {
    console.error("distributeGauges failed", error);
    throw error;
  }
}
