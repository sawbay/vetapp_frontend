import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import { TAPP_ACCOUNT_ADDRESS } from "@/constants";
import { PoolMeta } from "@/hooks/usePool";
import { AccountAddress, Serializer } from "@aptos-labs/ts-sdk";

export type SwapPoolArguments = {
  poolMeta: PoolMeta,
};

export const swapPool = (args: SwapPoolArguments): InputTransactionData => {
  const serializer = new Serializer();

  if (args.poolMeta.hook_type == 2) {
    serializer.serialize(AccountAddress.from(args.poolMeta.pool_addr));
    serializer.serializeBool(true);
    serializer.serializeBool(true);
    serializer.serializeU64(1_000_000n);
    serializer.serializeU64(0);
  }

  if (args.poolMeta.hook_type == 3) {
    serializer.serialize(AccountAddress.from(args.poolMeta.pool_addr));
    serializer.serializeBool(true); // 0 -> 1
    serializer.serializeBool(true); 
    serializer.serializeU64(1_000_000n);
    serializer.serializeU64(0);
    serializer.serializeU128(4295048016n); // 0->1
    // serializer.serializeU128(79226673515401279992447579055n); // 1->0
  }

  if (args.poolMeta.hook_type == 4) {
    serializer.serialize(AccountAddress.from(args.poolMeta.pool_addr));
    serializer.serializeU64(0n);
    serializer.serializeU64(1n);
    serializer.serializeU256(1_000_000n);
    serializer.serializeU256(0n);
  }

  const data = serializer.toUint8Array();
  return {
    data: {
      function: `${TAPP_ACCOUNT_ADDRESS}::router::swap`,
      functionArguments: [
        data
      ],
    },
  };
};
