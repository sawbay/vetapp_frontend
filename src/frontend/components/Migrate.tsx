import { useState, type ChangeEvent } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { AccountAddress, MoveOption, Serializer, U64 } from "@aptos-labs/ts-sdk";
import { NETWORK, VE_TAPP_HELPER_ADDRESS } from "@/constants";
import { aptosClient } from "@/utils/aptosClient";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { toastTransactionSuccess } from "@/utils/transactionToast";

const explorerBase = "https://explorer.aptoslabs.com";
const OP_MIGRATE_POOLS = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;
const HOOK_TYPE_OPTIONS = [
  { label: "All hooks", value: undefined },
  { label: "AMM (hook type 2)", value: 2 },
  { label: "CLMM (hook type 3)", value: 3 },
  { label: "Stable (hook type 4)", value: 4 },
] as const;

const normalizeAddress = (value: string) => (value.startsWith("0x") ? value : `0x${value}`);

const buildMigrationArgs = (addresses: string[]): Uint8Array => {
  const serializer = new Serializer();
  serializer.serializeU64(OP_MIGRATE_POOLS);
  serializer.serializeU32AsUleb128(addresses.length);
  addresses.forEach((address) => {
    const accountAddress = AccountAddress.from(normalizeAddress(address));
    accountAddress.serialize(serializer);
  });
  return serializer.toUint8Array();
};

export function Migrate() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [lastMigrationHash, setLastMigrationHash] = useState<string | null>(null);
  const [selectedHookType, setSelectedHookType] = useState<number | undefined>(undefined);
  const [offset, setOffset] = useState(0);
  const [count, setCount] = useState(DEFAULT_PAGE_SIZE);
  const [isRunningOp, setIsRunningOp] = useState(false);

  const tapPoolsQuery = useQuery({
    queryKey: [
      "helper-ve-tapp-pools",
      VE_TAPP_HELPER_ADDRESS,
      selectedHookType,
      offset,
      count,
    ],
    enabled: Boolean(VE_TAPP_HELPER_ADDRESS),
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      if (!VE_TAPP_HELPER_ADDRESS) {
        return [];
      }
      const result = await aptosClient().view<[string[]]>({
        payload: {
          function: `${VE_TAPP_HELPER_ADDRESS}::helper_ve::tapp_pools`,
          functionArguments: [
            MoveOption.U8(selectedHookType ?? undefined),
            new U64(offset),
            new U64(count),
          ],
        },
      });
      return result[0] ?? [];
    },
  });

  const tappPools = tapPoolsQuery.data ?? [];
  const isPoolsFetching = tapPoolsQuery.isFetching;
  const hookTypeLabel =
    HOOK_TYPE_OPTIONS.find((option) => option.value === selectedHookType)?.label ??
    HOOK_TYPE_OPTIONS[0].label;

  const handleRunOp = async () => {
    if (!account || isRunningOp || !VE_TAPP_HELPER_ADDRESS) {
      return;
    }
    if (!tappPools.length) {
      toast({
        variant: "destructive",
        title: "No pools",
        description: "Load pools with the controls below before running migration.",
      });
      return;
    }

    try {
      setIsRunningOp(true);
      const serializedArgs = buildMigrationArgs(tappPools);
      const committedTransaction = await signAndSubmitTransaction({
        data: {
          function: `${VE_TAPP_HELPER_ADDRESS}::helper_ve::run_op`,
          functionArguments: [serializedArgs],
        },
      });
      const executedTransaction = await aptosClient().waitForTransaction({
        transactionHash: committedTransaction.hash,
      });
      setLastMigrationHash(executedTransaction.hash);
      toastTransactionSuccess(executedTransaction.hash);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Migration failed",
        description: "run_op failed to migrate pools.",
      });
    } finally {
      setIsRunningOp(false);
    }
  };

  const handleHookTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedHookType(value === "all" ? undefined : Number(value));
  };

  const handleOffsetChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (Number.isNaN(value)) {
      return;
    }
    setOffset(Math.max(0, Math.floor(value)));
  };

  const handleCountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (Number.isNaN(value)) {
      return;
    }
    const clamped = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value)));
    setCount(clamped);
  };

  const networkQuery = NETWORK ? `?network=${NETWORK}` : "";

  const explorerUrl = lastMigrationHash
    ? `${explorerBase}/transaction/${lastMigrationHash}?network=${NETWORK}`
    : null;

  const formattedHash = lastMigrationHash
    ? `${lastMigrationHash.slice(0, 6)}...${lastMigrationHash.slice(-4)}`
    : null;

  return (
    <div className="rounded-lg border border-border bg-card/70 p-4 text-sm text-foreground">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">Migration helper</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={!account || isRunningOp || !VE_TAPP_HELPER_ADDRESS}
            onClick={handleRunOp}
          >
            {isRunningOp ? "Migrating..." : "Run run_op (selected pools)"}
          </Button>
        </div>
        <div className="grid gap-2 text-xs sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Hook type
            </span>
            <select
              className="rounded border border-border bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={selectedHookType === undefined ? "all" : String(selectedHookType)}
              onChange={handleHookTypeChange}
            >
              {HOOK_TYPE_OPTIONS.map((option) => (
                <option key={option.label} value={option.value ?? "all"}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Offset
            </span>
            <input
              type="number"
              min={0}
              step={1}
              className="rounded border border-border bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={offset}
              onChange={handleOffsetChange}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Page size
            </span>
            <input
              type="number"
              min={1}
              max={MAX_PAGE_SIZE}
              step={1}
              className="rounded border border-border bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={count}
              onChange={handleCountChange}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Button
            size="sm"
            variant="ghost"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - count))}
          >
            Prev page
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOffset(offset + count)}
          >
            Next page
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOffset(0)}
          >
            Reset offset
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => tapPoolsQuery.refetch()}
          >
            Refresh pools
          </Button>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {isPoolsFetching ? (
            "Loading pools..."
          ) : (
            <>
              Showing {tappPools.length} pools for <b>{hookTypeLabel}</b> (offset {offset}, page size{" "}
              {count})
            </>
          )}
        </div>
        <div className="max-h-32 overflow-auto text-xs">
          {tappPools.length === 0 ? (
            <div className="text-muted-foreground">No pools found for this filter.</div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {tappPools.map((address) => {
                const href = `${explorerBase}/account/${normalizeAddress(address)}/resources${networkQuery}`;
                return (
                  <a
                    className="rounded border border-border/70 px-2 py-0.5 text-[11px] underline-offset-4 hover:bg-muted-foreground/30"
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    key={address}
                  >
                    {`${normalizeAddress(address).slice(0, 10)}…${normalizeAddress(address).slice(-6)}`}
                  </a>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Helper contract:</span>
          <code className="rounded border border-border/60 bg-muted-foreground/10 px-1 py-0.5 text-[11px]">
            {VE_TAPP_HELPER_ADDRESS ?? "not configured"}
          </code>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Last migration:</span>
          {lastMigrationHash ? (
            <a
              className="underline underline-offset-4"
              href={explorerUrl ?? undefined}
              rel="noreferrer"
              target="_blank"
            >
              {formattedHash ?? lastMigrationHash}
            </a>
          ) : (
            <span className="text-muted-foreground">not run yet</span>
          )}
        </div>
      </div>
    </div>
  );
}
