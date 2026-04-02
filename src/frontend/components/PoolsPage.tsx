import { usePool } from "@/hooks/usePool";

const MAX_POOLS = 20;

export function PoolsPage() {
  const { data: poolMetas = [], isFetching, isError } = usePool();
  const pools = poolMetas.slice(0, MAX_POOLS);

  return (
    <section className="flex flex-col gap-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Pools</h2>
        <p className="text-sm text-muted-foreground">
          Showing the first {pools.length} pools from <code>usePool</code>.
        </p>
      </div>

      {isFetching ? <p className="text-sm text-muted-foreground">Loading pools...</p> : null}
      {isError ? <p className="text-sm text-destructive">Failed to load pools.</p> : null}
      {!isFetching && !isError && pools.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pools found.</p>
      ) : null}

      {pools.length > 0 ? (
        <ul className="list-disc space-y-2 pl-5 text-sm">
          {pools.map((pool) => (
            <li key={pool.pool_addr} className="break-words">
              <span className="font-medium">{pool.pool_addr}</span>
              <span className="text-muted-foreground"> | Assets: {pool.assets_display}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
