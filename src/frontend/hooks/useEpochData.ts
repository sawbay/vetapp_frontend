import { useQuery } from "@tanstack/react-query";
import { aptosClient } from "@/utils/aptosClient";
import { VETAPP_ACCOUNT_ADDRESS } from "@/constants";

type EpochView = string | number | bigint;

type EpochData = {
  epochStart: EpochView;
  epochNext: EpochView;
  voteStart: EpochView;
  voteEnd: EpochView;
  activePeriod: EpochView;
  epochCount: EpochView;
  weeklyEmission: EpochView;
};

export function useEpochData() {
  return useQuery<EpochData>({
    queryKey: ["helper-ve-epochs"],
    enabled: Boolean(VETAPP_ACCOUNT_ADDRESS),
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<EpochData> => {
      const [
        epochStart,
        epochNext,
        voteStart,
        voteEnd,
        activePeriod,
        epochCount,
        weeklyEmission,
      ] = await Promise.all([
        aptosClient().view<[EpochView]>({
          payload: {
            function: `${VETAPP_ACCOUNT_ADDRESS}::voter::epoch_start`,
          },
        }),
        aptosClient().view<[EpochView]>({
          payload: {
            function: `${VETAPP_ACCOUNT_ADDRESS}::voter::epoch_next`,
          },
        }),
        aptosClient().view<[EpochView]>({
          payload: {
            function: `${VETAPP_ACCOUNT_ADDRESS}::voter::epoch_vote_start`,
          },
        }),
        aptosClient().view<[EpochView]>({
          payload: {
            function: `${VETAPP_ACCOUNT_ADDRESS}::voter::epoch_vote_end`,
          },
        }),
        aptosClient().view<[EpochView]>({
          payload: {
            function: `${VETAPP_ACCOUNT_ADDRESS}::minter::active_period`,
          },
        }),
        aptosClient().view<[EpochView]>({
          payload: {
            function: `${VETAPP_ACCOUNT_ADDRESS}::minter::epoch_count`,
          },
        }),
        aptosClient().view<[EpochView]>({
          payload: {
            function: `${VETAPP_ACCOUNT_ADDRESS}::minter::weekly`,
          },
        }),
      ]);

      return {
        epochStart: epochStart[0],
        epochNext: epochNext[0],
        voteStart: voteStart[0],
        voteEnd: voteEnd[0],
        activePeriod: activePeriod[0],
        epochCount: epochCount[0],
        weeklyEmission: weeklyEmission[0],
      };
    },
  });
}
