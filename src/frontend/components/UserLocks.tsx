import { useEffect, useRef, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocks } from "@/hooks/useLocks";
import { toast } from "@/components/ui/use-toast";
import { aptosClient } from "@/utils/aptosClient";
import { GAUGE_ACCOUNT_ADDRESS, VETAPP_ACCOUNT_ADDRESS } from "@/constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  enabled?: boolean;
};

type PoolVoteMetrics = {
  weight: string | number | bigint;
  feeRewards: Array<string | number | bigint>;
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
          function: `${VETAPP_ACCOUNT_ADDRESS}::vetapp::locked`,
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

function PoolVotes({ tokenAddress, onCopy, shorten, enabled = true }: PoolVotesProps) {
  const { account, signAndSubmitTransaction } = useWallet();
  const gaugesEnabled = Boolean(tokenAddress && VETAPP_ACCOUNT_ADDRESS);
  const { data: gaugeData, isFetching: isGaugeFetching } = useGauge(gaugesEnabled && enabled);
  const queryClient = useQueryClient();
  const [weightInputs, setWeightInputs] = useState<Record<string, string>>({});
  const [isVoting, setIsVoting] = useState(false);
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const { data: voteData, isFetching: isVoteFetching } = useQuery({
    queryKey: ["pool-votes", tokenAddress, gaugeData?.pools?.length ?? 0],
    enabled: Boolean(VETAPP_ACCOUNT_ADDRESS) && enabled && !isGaugeFetching,
    queryFn: async (): Promise<{
      voted: boolean;
      pools: string[];
    }> => {
      if (!VETAPP_ACCOUNT_ADDRESS) {
        return { voted: false, pools: [] };
      }
      const votedPoolsResult = await aptosClient().view<[string[]]>({
        payload: {
          function: `${VETAPP_ACCOUNT_ADDRESS}::voter::voted_pools`,
          functionArguments: [tokenAddress],
        },
      });
      const votedPools = votedPoolsResult[0] ?? [];
      return { voted: votedPools.length > 0, pools: votedPools };
    },
  });

  const voted = voteData?.voted ?? false;
  const votedPools = voteData?.pools ?? [];
  useEffect(() => {
    if (votedPools.length === 0) {
      setSelectedPool(null);
      return;
    }
    if (!selectedPool || !votedPools.includes(selectedPool)) {
      setSelectedPool(votedPools[0]);
    }
  }, [selectedPool, votedPools]);

  const { data: selectedPoolMetrics, isFetching: isMetricsFetching } = useQuery({
    queryKey: ["pool-vote-metrics", tokenAddress, selectedPool],
    enabled: Boolean(VETAPP_ACCOUNT_ADDRESS && selectedPool && enabled),
    queryFn: async (): Promise<PoolVoteMetrics> => {
      if (!VETAPP_ACCOUNT_ADDRESS || !selectedPool) {
        return { weight: "0", feeRewards: [] };
      }
      const weightResult = await aptosClient().view<[string | number | bigint]>({
        payload: {
          function: `${VETAPP_ACCOUNT_ADDRESS}::voter::vote_of`,
          functionArguments: [tokenAddress, selectedPool],
        },
      });
      const rewardResult = GAUGE_ACCOUNT_ADDRESS
        ? await aptosClient().view<[Array<string | number | bigint>]>({
          payload: {
            function: `${GAUGE_ACCOUNT_ADDRESS}::fees_voting_reward::earned_many`,
            functionArguments: [selectedPool, tokenAddress],
          },
        })
        : [[]];
      return {
        weight: weightResult[0] ?? "0",
        feeRewards: rewardResult[0] ?? [],
      };
    },
  });
  const pools = gaugeData?.pools ?? [];
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
        <div className="flex flex-col gap-3 pl-2">
          {votedPools.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              This lock is marked as voted but we couldn’t read any pools.
            </span>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-[11px] text-muted-foreground" htmlFor="pool-select">
                  Selected pool
                </label>
                <select
                  id="pool-select"
                  className="rounded border border-input bg-background px-2 py-1 text-xs"
                  value={selectedPool ?? ""}
                  onChange={(event) => setSelectedPool(event.target.value)}
                >
                  {votedPools.map((pool) => (
                    <option key={pool} value={pool}>
                      {shorten(pool)}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">Metrics reflect the currently selected pool.</span>
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <span>
                  Weight:{" "}
                  {isMetricsFetching
                    ? "Loading..."
                    : formatNumber8(selectedPoolMetrics?.weight ?? "0")}
                </span>
                {selectedPoolMetrics?.feeRewards && selectedPoolMetrics.feeRewards.length > 0 ? (
                  <span className="text-[11px] text-muted-foreground">
                    Fee rewards: {selectedPoolMetrics.feeRewards.map((value) => formatNumber8(value)).join(", ")}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">No fee rewards yet for this pool.</span>
                )}
              </div>
            </>
          )}
        </div>
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

function useLockVoteStatus(tokenAddress: string) {
  return useQuery({
    queryKey: ["lock-vote-status", tokenAddress],
    enabled: Boolean(VETAPP_ACCOUNT_ADDRESS && tokenAddress),
    queryFn: async (): Promise<boolean> => {
      if (!VETAPP_ACCOUNT_ADDRESS) {
        return false;
      }
      const result = await aptosClient().view<[boolean]>({
        payload: {
          function: `${VETAPP_ACCOUNT_ADDRESS}::vetapp::voted`,
          functionArguments: [tokenAddress],
        },
      });
      return result[0] ?? false;
    },
  });
}

function LockVoteSummary({ tokenAddress }: { tokenAddress: string }) {
  const { data: voted, isFetching } = useLockVoteStatus(tokenAddress);
  const statusText = isFetching
    ? "Checking vote status..."
    : `Voted this epoch: ${voted ? "Yes" : "No"}`;
  const statusClassName = isFetching
    ? "text-xs text-muted-foreground"
    : `text-xs ${voted ? "text-emerald-600" : "text-red-600"}`;
  return <span className={statusClassName}>{statusText}</span>;
}

export function UserLocks() {
  const { account, signAndSubmitTransaction } = useWallet();
  const queryClient = useQueryClient();
  const [impersonationInput, setImpersonationInput] = useState("");
  const [impersonatedAddress, setImpersonatedAddress] = useState<string | null>(null);
  const [lockValue, setLockValue] = useState("");
  const [lockDuration, setLockDuration] = useState("");
  const [isLockSubmitting, setIsLockSubmitting] = useState(false);
  const walletAddress = account?.address?.toString() ?? null;
  const effectiveAddress = impersonatedAddress ?? walletAddress;
  const { data, isFetching } = useLocks(effectiveAddress);
  const locksScrollRef = useRef<HTMLDivElement | null>(null);
  const lockCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeLockIndex, setActiveLockIndex] = useState(0);
  const [openVoteTokenId, setOpenVoteTokenId] = useState<string | null>(null);

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
  const applyImpersonation = () => {
    const trimmed = impersonationInput.trim();
    if (!trimmed) {
      return;
    }
    setImpersonatedAddress(trimmed);
    setImpersonationInput("");
  };
  const clearImpersonation = () => {
    setImpersonatedAddress(null);
    setImpersonationInput("");
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
      if (walletAddress) {
        queryClient.invalidateQueries({ queryKey: ["user-locks", walletAddress] });
      }
      toastTransactionSuccess(executedTransaction.hash);
      setLockValue("");
      setLockDuration("");
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

  useEffect(() => {
    if (openVoteTokenId && !tokens.some((token) => token.token_data_id === openVoteTokenId)) {
      setOpenVoteTokenId(null);
    }
  }, [openVoteTokenId, tokens]);

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
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="text-[11px]">View locks for address:</span>
        <Input
          className="h-7 w-56 text-xs"
          placeholder="0x..."
          value={impersonationInput}
          onChange={(event) => setImpersonationInput(event.target.value)}
        />
        <Button
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={applyImpersonation}
          disabled={!impersonationInput.trim()}
        >
          Load
        </Button>
        {impersonatedAddress ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={clearImpersonation}
          >
            Use wallet
          </Button>
        ) : null}
        <span className="text-[11px] text-muted-foreground">
          Showing {effectiveAddress ? shorten(effectiveAddress) : "no address"}.
        </span>
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
                    <div className="flex items-center justify-between gap-2">
                      <LockVoteSummary tokenAddress={token.token_data_id} />
                      <Dialog
                        open={openVoteTokenId === token.token_data_id}
                        onOpenChange={(open) =>
                          setOpenVoteTokenId(open ? token.token_data_id : null)
                        }
                      >
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={!account}
                          >
                            View voted pools
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[min(90vw,800px)]">
                          <DialogHeader>
                            <DialogTitle>Vote pools for {shorten(token.token_data_id)}</DialogTitle>
                            <DialogDescription>
                              Add or adjust vote weights and inspect fee rewards tied to this lock.
                            </DialogDescription>
                          </DialogHeader>
                          <PoolVotes
                            tokenAddress={token.token_data_id}
                            onCopy={onCopy}
                            shorten={shorten}
                            enabled={openVoteTokenId === token.token_data_id}
                          />
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button size="sm" variant="ghost">
                                Close
                              </Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
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
