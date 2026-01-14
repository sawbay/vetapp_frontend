export type PoolToken = {
  token_data_id: string;
  amount: any;
  current_token_data?: {
    token_name: string;
  } | null;
};

export enum PoolType {
  AMM = "amm",
  STABLE = "stable",
  CLMM = "clmm",
}
