import { toast } from "@/components/ui/use-toast";

const getExplorerTransactionUrl = (hash: string) => `https://explorer.aptoslabs.com/txn/${hash}`;

export const toastTransactionSuccess = (hash: string) => {
  const explorerUrl = getExplorerTransactionUrl(hash);
  toast({
    title: "Success",
    description: (
      <div className="flex flex-col gap-1">
        <span>
          Transaction succeeded, hash: <code className="font-mono text-xs break-all">{hash}</code>
        </span>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-blue-600 underline"
        >
          View on Aptos Explorer
        </a>
      </div>
    ),
  });
};
