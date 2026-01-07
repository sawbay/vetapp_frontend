const DECIMALS_8 = 8;

export const formatNumber8 = (value: string | number | bigint): string => {
  const numeric = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isFinite(numeric)) {
    return `${value}`;
  }
  return (numeric / Math.pow(10, DECIMALS_8)).toLocaleString(undefined, {
    maximumFractionDigits: DECIMALS_8,
  });
};
