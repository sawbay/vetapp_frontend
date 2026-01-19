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
          "0x85cc56d60c782c1e7a58156184d6fa8c152cd337049bdd9419633b55e79d8352::helper_ve::distribute_gauges",
        privateKey: env.APTOS_PRIVATE_KEY,
        network: ("testnet") as Network,
      }),
    );
  },
};
