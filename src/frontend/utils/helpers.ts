import { Network } from "@aptos-labs/ts-sdk";
import { NetworkInfo, isAptosNetwork } from "@aptos-labs/wallet-adapter-react";

export const isValidNetworkName = (network: NetworkInfo | null) => {
  if (isAptosNetwork(network)) {
    return Object.values<string | undefined>(Network).includes(network?.name);
  }
  // If the configured network is not an Aptos network, i.e is a custom network
  // we resolve it as a valid network name
  return true;
};

import {
  AccountAddress,
  createObjectAddress,
  createResourceAddress
} from '@aptos-labs/ts-sdk';

export const deriveVaultAddress = (packageHex: string, vaultSeed: string): AccountAddress => {
  const creatorAddress = AccountAddress.fromString(packageHex);
  return createResourceAddress(creatorAddress, vaultSeed);
};

export const deriveCollectionAddress = (
  vaultAddress: AccountAddress,
  collectionName: string
): AccountAddress => {
  return createObjectAddress(vaultAddress, collectionName);
};