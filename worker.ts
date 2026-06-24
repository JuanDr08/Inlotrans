// @ts-nocheck
import openNextHandler from "./.open-next/worker.js";

export { DOQueueHandler } from "./.open-next/.build/durable-objects/queue.js";
export { DOShardedTagCache } from "./.open-next/.build/durable-objects/sharded-tag-cache.js";
export { BucketCachePurge } from "./.open-next/.build/durable-objects/bucket-cache-purge.js";

export default {
  fetch: openNextHandler.fetch,

  async scheduled(event, env, ctx) {
    const url = new URL("/api/cron/autocierre", "https://localhost");
    const headers = new Headers();
    if (env.CRON_SECRET) {
      headers.set("Authorization", `Bearer ${env.CRON_SECRET}`);
    }
    const request = new Request(url, { headers });
    ctx.waitUntil(openNextHandler.fetch(request, env, ctx));
  },
};
