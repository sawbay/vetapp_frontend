import { Network } from "@aptos-labs/ts-sdk";
import { distributeGauges } from "./cron/epoch_runner";

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  APTOS_PRIVATE_KEY?: string;
  APTOS_NETWORK?: string;
  APTOS_API_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await env.ASSETS.fetch(request);

    if (response.status !== 404) {
      return response;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return response;
    }

    const url = new URL(request.url);
    url.pathname = "/index.html";

    return env.ASSETS.fetch(
      new Request(url.toString(), {
        method: request.method,
        headers: request.headers,
      }),
    );
  },
  async scheduled(event: any, env: Env, ctx: any) {
    if (!env.APTOS_PRIVATE_KEY) {
      console.warn("Skipping cron: APTOS_PRIVATE_KEY is not set");
      return;
    }
    // if (event.cron !== "* * * * *") {
    //   return;
    // }
    ctx.waitUntil(
      distributeGauges({
        functionId: "0x85cc56d60c782c1e7a58156184d6fa8c152cd337049bdd9419633b55e79d8352::helper_ve::distribute_gauges",
        privateKey: env.APTOS_PRIVATE_KEY,
        network: (env.APTOS_NETWORK ?? "testnet") as Network,
      }),
    );
  },
};
