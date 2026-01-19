import { Network } from "@aptos-labs/ts-sdk";
import { Hono } from "hono";
import { distributeGauges } from "./epoch_runner";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default {
  fetch: app.fetch,
  scheduled: async (_event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    if (!env.APTOS_PRIVATE_KEY) {
      console.warn("Skipping cron: APTOS_PRIVATE_KEY is not set");
      return;
    }
    ctx.waitUntil(
      distributeGauges({
        functionId: 
          `${env.VITE_MODULE_VETAPP_ACCOUNT_ADDRESS}::helper_ve::distribute_gauges`,
        privateKey: env.APTOS_PRIVATE_KEY,
        network: (env.VITE_APP_NETWORK ?? "testnet") as Network,
      }),
    );
  },
};
