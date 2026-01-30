import { Network } from "@aptos-labs/ts-sdk";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { submitTx } from "./submit_tx";

const app = new Hono<{ Bindings: Env }>();
app.use("*", cors());
app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    if (!env.APTOS_PRIVATE_KEY) {
      console.warn("Skipping cron: APTOS_PRIVATE_KEY is not set");
      return;
    }

    switch (event.cron) {
      case "1 * * * *": {
        ctx.waitUntil(
          submitTx(
            {
              functionId: `${env.ve_tapp_helper}::helper_ve::distribute_gauges`,
              privateKey: env.APTOS_PRIVATE_KEY,
              network: (env.VITE_APP_NETWORK ?? "testnet") as Network,
            },
            []
          ),
        );
        break;
      }
      // case "*/5 * * * *": {
      //   ctx.waitUntil(
      //     submitTx(
      //       {
      //         functionId: `${env.ve_tapp}::helper_ve::swaps_pools`,
      //         privateKey: env.APTOS_PRIVATE_KEY,
      //         network: (env.VITE_APP_NETWORK ?? "testnet") as Network,
      //       },
      //       []
      //     ),
      //   );
      //   break;
      // }
      default: {
        console.error("unknown cron:", event.cron);
        break;
      }
    }
  },
};
