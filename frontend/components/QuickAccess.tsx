import { useQuery } from "@tanstack/react-query";
import { GAUGE_ACCOUNT_ADDRESS, TAPP_ACCOUNT_ADDRESS, VETAPP_ACCOUNT_ADDRESS } from "@/constants";
import { aptosClient } from "@/utils/aptosClient";

export function QuickAccess() {
  const { data: tappTokenAddress } = useQuery({
    queryKey: ["tapp-token-address"],
    enabled: Boolean(VETAPP_ACCOUNT_ADDRESS),
    queryFn: async (): Promise<string> => {
      const result = await aptosClient().view<[string]>({
        payload: {
          function: `${VETAPP_ACCOUNT_ADDRESS}::tapp::token_address`,
        },
      });
      return result[0];
    },
  });
  return (
    <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
      Packages:
      <a
        className="underline underline-offset-4"
        href={`https://explorer.aptoslabs.com/account/${TAPP_ACCOUNT_ADDRESS ?? ""}/modules/packages`}
        target="_blank"
        rel="noreferrer"
      >
        Tap Router
      </a>
      <a
        className="underline underline-offset-4"
        href={`https://explorer.aptoslabs.com/account/${VETAPP_ACCOUNT_ADDRESS ?? ""}/modules/packages`}
        target="_blank"
        rel="noreferrer"
      >
        veTAPP
      </a>
      <a
        className="underline underline-offset-4"
        href={`https://explorer.aptoslabs.com/account/${GAUGE_ACCOUNT_ADDRESS ?? ""}/modules/packages`}
        target="_blank"
        rel="noreferrer"
      >
        Gauge
      </a>

      Others:
      <a
        className="underline underline-offset-4"
        href={`https://explorer.aptoslabs.com/account/${tappTokenAddress ?? ""}/resources`}
        target="_blank"
        rel="noreferrer"
      >
        $TAPP
      </a>
    </div>
  );
}
