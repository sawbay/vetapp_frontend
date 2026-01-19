import { GetAccountCoinsDataResponse } from "@aptos-labs/ts-sdk";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatNumber8 } from "@/utils/format";

type ActiveBribePool = {
  poolAddress: string;
  poolKey: string;
};

type AddBribeProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeBribePool: ActiveBribePool | null;
  activeBribeInput: { tokenAddress: string; amount: string };
  walletFungibleTokens: GetAccountCoinsDataResponse;
  isSubmitting: boolean;
  isWalletReady: boolean;
  onCopy: (value: string) => void;
  shorten: (value: string) => string;
  onDistributeBribes: (poolAddress: string, poolKey: string) => void;
  setBribeInput: (poolKey: string, field: "tokenAddress" | "amount", value: string) => void;
};

export function AddBribe({
  open,
  onOpenChange,
  activeBribePool,
  activeBribeInput,
  walletFungibleTokens,
  isSubmitting,
  isWalletReady,
  onCopy,
  shorten,
  onDistributeBribes,
  setBribeInput,
}: AddBribeProps) {
  const activeBribeKey = activeBribePool?.poolKey ?? "";
  const tokenOptions = walletFungibleTokens ?? [];
  const datalistId = activeBribeKey ? `bribe-token-addresses-${activeBribeKey}` : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Bribe</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {activeBribePool ? (
              <>
                <span>Pool:</span>
                <code
                  className="border border-input rounded px-2 py-1"
                  onClick={() => onCopy(activeBribePool.poolAddress)}
                >
                  {shorten(activeBribePool.poolAddress)}
                </code>
              </>
            ) : (
              "Select a pool to add a bribe."
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Token address</span>
            <Input
              className="h-8 text-xs"
              placeholder="0x..."
              value={activeBribeInput.tokenAddress}
              list={datalistId}
              onChange={(event) => {
                if (activeBribePool) {
                  let token = tokenOptions.find((t) => t.metadata?.symbol == event.target.value)
                  setBribeInput(activeBribePool.poolKey, "tokenAddress", token?.asset_type!);
                }
              }}
              disabled={!activeBribePool}
            />
            {activeBribeKey && tokenOptions.length > 0 ? (
              <datalist id={datalistId}>
                {tokenOptions.map((token) => {
                  const amountDisplay = formatNumber8(token.amount);
                  const label = `${shorten(token.metadata?.creator_address ?? "undefined")} - ${amountDisplay}`;
                  return (
                    <option
                      key={token.asset_type}
                      value={token.metadata?.symbol}
                      label={label}
                    ></option>
                  );
                })}
              </datalist>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Token amount (u64)</span>
            <Input
              className="h-8 text-xs"
              inputMode="numeric"
              placeholder="Amount"
              value={activeBribeInput.amount}
              onChange={(event) => {
                if (!activeBribePool) {
                  return;
                }
                const nextValue = event.target.value;
                if (nextValue === "" || /^\d+$/.test(nextValue)) {
                  setBribeInput(activeBribePool.poolKey, "amount", nextValue);
                }
              }}
              disabled={!activeBribePool}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (activeBribePool) {
                onDistributeBribes(activeBribePool.poolAddress, activeBribePool.poolKey);
              }
            }}
            disabled={!isWalletReady || isSubmitting || !activeBribePool}
          >
            {isSubmitting ? "Submitting..." : "Add Bribe"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
