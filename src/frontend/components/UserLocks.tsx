import { useEffect, useRef, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocks } from "@/hooks/useLocks";
import { toast } from "@/components/ui/use-toast";
import { aptosClient } from "@/utils/aptosClient";
import { VETAPP_ACCOUNT_ADDRESS } from "@/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createLock } from "@/entry-functions/createLock";
import { increaseUnlockTime } from "@/entry-functions/increaseUnlockTime";
import { vote } from "@/entry-functions/vote";
import { toastTransactionSuccess } from "@/utils/transactionToast";
import { formatNumber8 } from "@/utils/format";
import { useGauge } from "@/hooks/useGauge";

type PoolVotesProps = {
  tokenAddress: string;
  onCopy: (value: string) => void;
  shorten: (value: string) => string;
};

type LockToken = {
  token_data_id: string;
  amount: any;
  current_token_data?: {
    token_name: string;
  } | null;
};

type LockedBalance = {
  amount: string | number | bigint;
  end: string | number | bigint;
  is_permanent: boolean;
};

const getLockTokenId = (token: LockToken) => token.token_data_id;

function LockInfo({ token }: { token: LockToken }) {
  const { account, signAndSubmitTransaction } = useWallet();
  const queryClient = useQueryClient();
  const tokenId = getLockTokenId(token);
  const [isIncreasing, setIsIncreasing] = useState(false);
  
  const { data, isFetching } = useQuery({
    queryKey: ["lock-info", token.token_data_id, tokenId],
    enabled: Boolean(VETAPP_ACCOUNT_ADDRESS && tokenId),
    queryFn: async (): Promise<LockedBalance | null> => {
      if (!VETAPP_ACCOUNT_ADDRESS || !tokenId) {
        return null;
      }
      const result = await aptosClient().view<[LockedBalance]>({
        payload: {
          function: `${VETAPP_ACCOUNT_ADDRESS}::vetapp::locked_balance`,
          functionArguments: [tokenId],
        },
      });
      return result[0] ?? null;
    },
  });
  const { data: votingPower, isFetching: isVotingPowerFetching } = useQuery({
    queryKey: ["voting-power", token.token_data_id, tokenId],
    enabled: Boolean(VETAPP_ACCOUNT_ADDRESS && tokenId),
    queryFn: async (): Promise<string | number | bigint | null> => {
      if (!VETAPP_ACCOUNT_ADDRESS || !tokenId) {
        return null;
      }
      const result = await aptosClient().view<[string | number | bigint]>({
        payload: {
          function: `${VETAPP_ACCOUNT_ADDRESS}::vetapp::balance_of_nft`,
          functionArguments: [tokenId],
        },
      });
      return result[0] ?? null;
    },
  });

  if (!tokenId) {
    return <span className="text-[11px] text-muted-foreground">Lock info unavailable.</span>;
  }
  if (isFetching) {
    return <span className="text-[11px] text-muted-foreground">Loading lock info...</span>;
  }
  if (!data) {
    return <span className="text-[11px] text-muted-foreground">Lock info unavailable.</span>;
  }
  const endSeconds = Number(data.end);
  const endDisplay = Number.isFinite(endSeconds)
    ? new Date(endSeconds * 1000).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : `${data.end}`;
  const isExpired = !data.is_permanent && Number.isFinite(endSeconds) && endSeconds * 1000 < Date.now();
  const votingPowerDisplay =
    votingPower == null ? "unknown" : formatNumber8(votingPower);
  const durationOptions = [
    { label: "1Y", seconds: 365 * 24 * 60 * 60 },
    { label: "2Y", seconds: 2 * 365 * 24 * 60 * 60 },
    { label: "4Y", seconds: 4 * 365 * 24 * 60 * 60 },
  ];

  const onIncreaseLockTime = async (seconds: number) => {
    if (!account || !tokenId || isIncreasing) {
      return;
    }
    try {
      setIsIncreasing(true);
      const committedTransaction = await signAndSubmitTransaction(
        increaseUnlockTime({
          tokenAddress: tokenId,
          lockDuration: seconds.toString(),
        }),
      );
      const executedTransaction = await aptosClient().waitForTransaction({
        transactionHash: committedTransaction.hash,
      });
      queryClient.invalidateQueries({ queryKey: ["lock-info", token.token_data_id, tokenId] });
      queryClient.invalidateQueries({ queryKey: ["voting-power", token.token_data_id, tokenId] });
      toastTransactionSuccess(executedTransaction.hash);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to increase lock time.",
      });
    } finally {
      setIsIncreasing(false);
    }
  };
  return (
    <div className="text-[11px] text-muted-foreground flex flex-col gap-1">
      <span>Amount: {formatNumber8(data.amount)} $TAPP</span>
      <span>
        End: {data.is_permanent ? "Permanent" : endDisplay}{" "}
        {isExpired ? <span className="text-red-500">(Expired)</span> : null}
      </span>
      <span>
        Voting power: {isVotingPowerFetching ? "Loading..." : votingPowerDisplay}
      </span>
      {!data.is_permanent ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground">Increase lock time</span>
          {durationOptions.map((option) => (
            <Button
              key={option.label}
              size="sm"
              className="h-6 px-2 text-[11px]"
              disabled={!account || isIncreasing}
              onClick={() => onIncreaseLockTime(option.seconds)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PoolVotes({ tokenAddress, onCopy, shorten }: PoolVotesProps) {
  const { account, signAndSubmitTransaction } = useWallet();
  const { data: gaugeData, isFetching: isGaugeFetching } = useGauge();
  const queryClient = useQueryClient();
  const [weightInputs, setWeightInputs] = useState<Record<string, string>>({});
  const [isVoting, setIsVoting] = useState(false);
  const { data: voteData, isFetching: isVoteFetching } = useQuery({
    queryKey: ["pool-votes", tokenAddress, gaugeData?.pools?.length ?? 0],
    enabled: Boolean(VETAPP_ACCOUNT_ADDRESS) && !isGaugeFetching,
    queryFn: async (): Promise<{
      voted: boolean;
      pools: { address: string; weight: string | number | bigint }[];
    }> => {
      if (!VETAPP_ACCOUNT_ADDRESS) {
        return { voted: false, pools: [] };
      }
      const votedResult = await aptosClient().view<[boolean]>({
        payload: {
          function: `${VETAPP_ACCOUNT_ADDRESS}::vetapp::voted`,
          functionArguments: [tokenAddress],
        },
      });
      const voted = votedResult[0] ?? false;
      if (!voted) {
        return { voted, pools: [] };
      }

      const pools = gaugeData?.pools ?? [];
      const weights = await Promise.all(
        pools.map((pool) =>
          aptosClient().view<[string | number | bigint]>({
            payload: {
              function: `${VETAPP_ACCOUNT_ADDRESS}::voter::vote_of`,
              functionArguments: [tokenAddress, pool],
            },
          }),
        ),
      );
      const poolsWithWeights = pools.map((pool, index) => ({ address: pool, weight: weights[index][0] }));
      return { voted, pools: poolsWithWeights };
    },
  });

  const voted = voteData?.voted ?? false;
  const votedPools = voteData?.pools ?? [];
  const pools = gaugeData?.pools ?? [];
  const votedWeights = votedPools.reduce<Record<string, string>>((acc, pool) => {
    acc[pool.address] = `${pool.weight}`;
    return acc;
  }, {});
  useEffect(() => {
    if (pools.length === 0) {
      return;
    }
    setWeightInputs((prev) => {
      const next: Record<string, string> = {};
      pools.forEach((pool) => {
        next[pool] = prev[pool] ?? "";
      });
      return next;
    });
  }, [pools]);

  const weightSelections = pools
    .map((pool) => ({ address: pool, weight: (weightInputs[pool] ?? "").trim() }))
    .filter((entry) => entry.weight !== "");
  const totalWeight = weightSelections.reduce((sum, entry) => sum + BigInt(entry.weight), 0n);
  const canVote = weightSelections.length > 0 && !isVoting;

  const onVote = async () => {
    if (!account || isVoting) {
      return;
    }
    if (weightSelections.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Enter a weight for at least one pool.",
      });
      return;
    }

    try {
      setIsVoting(true);
      const committedTransaction = await signAndSubmitTransaction(
        vote({
          tokenAddress,
          poolsVote: weightSelections.map((entry) => entry.address),
          weights: weightSelections.map((entry) => entry.weight),
        }),
      );
      const executedTransaction = await aptosClient().waitForTransaction({
        transactionHash: committedTransaction.hash,
      });
      queryClient.invalidateQueries({ queryKey: ["pool-votes", tokenAddress] });
      toastTransactionSuccess(executedTransaction.hash);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to submit vote.",
      });
    } finally {
      setIsVoting(false);
    }
  };

  if (!VETAPP_ACCOUNT_ADDRESS) {
    return <span className="text-xs text-muted-foreground">VETAPP address not configured.</span>;
  }

  if (isGaugeFetching || isVoteFetching) {
    return <span className="text-xs text-muted-foreground">Loading votes...</span>;
  }
  if (pools.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        Voted this epoch: {voted ? "Yes" : "No"} · No pools configured.
      </span>
    );
  }

  return (
    <div className="text-xs flex flex-col gap-2 pl-4">
      <span className={voted ? "text-emerald-600" : "text-red-600"}>{voted ? "Voted" : "Not voted"}</span>
      {voted ? (
        <ul className="list-disc pl-6">
          {pools.map((pool) => (
            <li key={pool}>
              <code className="border border-input rounded px-2 py-1" onClick={() => onCopy(pool)}>
                {shorten(pool)}
              </code>{" "}
              weight: {votedWeights[pool] ?? "0"}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="text-[11px] text-muted-foreground">Leave weight empty to skip a pool.</div>
          <ul className="flex flex-col gap-2">
            {pools.map((pool) => (
              <li key={pool} className="flex items-center justify-between gap-2">
                <code className="border border-input rounded px-2 py-1" onClick={() => onCopy(pool)}>
                  {shorten(pool)}
                </code>
                <Input
                  className="h-7 w-24 text-xs"
                  inputMode="numeric"
                  placeholder="Weight"
                  value={weightInputs[pool] ?? ""}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (nextValue === "" || /^\d+$/.test(nextValue)) {
                      setWeightInputs((prev) => ({ ...prev, [pool]: nextValue }));
                    }
                  }}
                />
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Total weight</span>
            <Input className="h-7 w-28 text-xs" readOnly value={totalWeight.toString()} />
            <Button
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={!account || !canVote}
              onClick={onVote}
            >
              {isVoting ? "Voting..." : "Vote"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function UserLocks() {
  const { account, signAndSubmitTransaction } = useWallet();
  const queryClient = useQueryClient();
  const { data, isFetching } = useLocks();
  const [lockValue, setLockValue] = useState("");
  const [lockDuration, setLockDuration] = useState("");
  const [isLockSubmitting, setIsLockSubmitting] = useState(false);
  const locksScrollRef = useRef<HTMLDivElement | null>(null);
  const lockCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeLockIndex, setActiveLockIndex] = useState(0);

  const tokens: LockToken[] = data?.tokens ?? [];
  const shorten = (s: string) => `${s.slice(0, 6)}...${s.slice(-4)}`;
  const onCopy = async (data: string) => {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(data);
      toast({
        title: "Copied",
        description: data,
      });
    }
  };

  const onCreateLock = async () => {
    if (!account || isLockSubmitting) {
      return;
    }

    const trimmedValue = lockValue.trim();
    const trimmedDuration = lockDuration.trim();
    const isValueValid = /^\d+$/.test(trimmedValue);
    const isDurationValid = /^\d+$/.test(trimmedDuration);

    if (!isValueValid || !isDurationValid) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Value and lock duration must be whole numbers.",
      });
      return;
    }

    try {
      setIsLockSubmitting(true);
      const committedTransaction = await signAndSubmitTransaction(
        createLock({ value: trimmedValue, lockDuration: trimmedDuration }),
      );
      const executedTransaction = await aptosClient().waitForTransaction({
        transactionHash: committedTransaction.hash,
      });
      queryClient.invalidateQueries({ queryKey: ["user-locks", account.address] });
      toastTransactionSuccess(executedTransaction.hash);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create lock.",
      });
    } finally {
      setIsLockSubmitting(false);
    }
  };

  useEffect(() => {
    setActiveLockIndex((current) => Math.min(current, Math.max(tokens.length - 1, 0)));
  }, [tokens.length]);

  const scrollToLock = (index: number) => {
    if (tokens.length === 0) {
      return;
    }
    const nextIndex = Math.max(0, Math.min(index, tokens.length - 1));
    const target = lockCardRefs.current[nextIndex];
    if (target) {
      target.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    }
    setActiveLockIndex(nextIndex);
  };
  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex min-w-0 items-center justify-between gap-4">
        <h4 className="text-lg font-medium">Locks</h4>
        <div className="min-w-0 break-all text-xs text-muted-foreground">
          Collection address: {data?.collectionAddress ?? "unknown"}
        </div>
      </div>
      <div className="flex flex-col gap-2 text-xs">
        <div className="text-sm font-medium">Create lock</div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Value (u64)</span>
            <Input
              className="h-7 w-40 text-xs"
              inputMode="numeric"
              placeholder="e.g. 100000000"
              value={lockValue}
              onChange={(event) => setLockValue(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Lock duration (seconds)</span>
            <Input
              className="h-7 w-56 text-xs"
              inputMode="numeric"
              placeholder="e.g. 604800"
              value={lockDuration}
              onChange={(event) => setLockDuration(event.target.value)}
            />
          </div>
          <Button
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={!account || isLockSubmitting}
            onClick={onCreateLock}
          >
            {isLockSubmitting ? "Creating..." : "Create Lock"}
          </Button>
        </div>
      </div>
      {!isFetching && tokens.length === 0 ? (
        <p className="text-xs text-muted-foreground">No tokens found for this collection.</p>
      ) : null}
      {tokens.length > 0 ? (
        <div className="text-xs flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">My locks</div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={tokens.length <= 1 || activeLockIndex === 0}
                onClick={() => scrollToLock(activeLockIndex - 1)}
              >
                Prev
              </Button>
              <Button
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={tokens.length <= 1 || activeLockIndex >= tokens.length - 1}
                onClick={() => scrollToLock(activeLockIndex + 1)}
              >
                Next
              </Button>
            </div>
          </div>
          <div className="w-[inherit] max-w-full overflow-hidden">
            <div
              ref={locksScrollRef}
              className="flex w-full min-w-0 flex-nowrap gap-3 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory"
            >
              {tokens.map((token, index) => (
                <div
                  key={token.token_data_id}
                  ref={(node) => {
                    lockCardRefs.current[index] = node;
                  }}
                  className="min-w-[240px] max-w-[280px] shrink-0 snap-start rounded-md border border-input bg-card p-3"
                >
                  <div className="flex flex-col gap-2">
                    <span>
                      {token.current_token_data?.token_name} :
                      <code
                        className="border border-input rounded px-2 py-1"
                        onClick={() => onCopy(token.token_data_id)}
                      >
                        {shorten(token.token_data_id)}
                      </code>
                    </span>
                    <LockInfo token={token} />
                    <PoolVotes tokenAddress={token.token_data_id} onCopy={onCopy} shorten={shorten} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
