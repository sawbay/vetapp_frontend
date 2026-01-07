import { useLocks } from "@/hooks/useLocks";
import { toast } from "@/components/ui/use-toast";

export function UserLocks() {
  const { data, isFetching } = useLocks();

  const tokens = data?.tokens ?? [];
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
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h4 className="text-lg font-medium">User locks</h4>
        <div className="text-sm text-muted-foreground">
          Collection address: {data?.collectionAddress ?? "unknown"}
        </div>
      </div>
      {!isFetching && tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tokens found for this collection.</p>
      ) : null}
      {tokens.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            {tokens.map((token) => (
              <span key={token.token_data_id}>
                {token.current_token_data?.token_name} :
                <code
                  className="border border-input rounded px-2 py-1"
                  onClick={() => onCopy(token.token_data_id)}
                >
                  {shorten(token.token_data_id)}
                </code>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
