import assert from "node:assert/strict";
import { describe, test } from "node:test";

const base = new URL(process.env.MC_CONTAINER_URL ?? "http://localhost:4200");
assert.ok(
  base.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname),
  "Routing verification requires a loopback application.",
);

describe("Deployed workspace routing", () => {
  for (const path of [
    "/materials/module:note.one",
    "/maps/map.one",
    "/game",
    "/party",
    "/workspace",
  ]) {
    test(`Direct address ${path} serves the application without a redirect`, async () => {
      const response = await fetch(new URL(path, base), {
        signal: AbortSignal.timeout(10_000),
        redirect: "manual",
      });

      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
      assert.match(await response.text(), /<mc-app><\/mc-app>/);
    });
  }
});
