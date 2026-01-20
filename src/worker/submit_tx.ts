import { Account, Aptos, AptosConfig, Ed25519PrivateKey, Network } from "@aptos-labs/ts-sdk";

export type SendTxConfig = {
  functionId: `${string}::${string}::${string}`;
  privateKey: string;
  network: Network;
  apiKey?: string;
};

export async function submitTx(config: SendTxConfig, functionArguments: any[]): Promise<string> {
  try {
    const account = Account.fromPrivateKey({
      privateKey: new Ed25519PrivateKey(config.privateKey)
    });
    const aptos = new Aptos(new AptosConfig({ network: config.network }));
    const txn = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: config.functionId,
        functionArguments,
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
    const txExplorerUrl = `https://explorer.aptoslabs.com/txn/${executedTransaction.hash}/?network=${config.network.toString()}`
    console.log(txExplorerUrl);
    return executedTransaction.hash;
  } catch (error) {
    console.log("config", config);
    console.log("functionArgs", functionArguments);
    console.error("submit tx failed", error);
    throw error;
  }
}
