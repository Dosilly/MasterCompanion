import assert from "node:assert/strict";
import { describe, test } from "node:test";

const base = new URL(process.env.MC_CONTAINER_URL ?? "http://localhost:4200");
assert.ok(
  base.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname),
  "Material preload verification requires a loopback application.",
);
const request = (path) =>
  fetch(new URL(path, base), { signal: AbortSignal.timeout(10_000) });

describe("Deployed campaign material preload", () => {
  test("Bulk read returns the current campaign catalog and canonical persisted document", async () => {
    const workspaceResponse = await request("/api/workspace");
    assert.equal(workspaceResponse.status, 200);
    const workspace = await workspaceResponse.json();

    const response = await request(
      `/api/campaigns/${workspace.campaignId}/materials`,
    );

    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("content-type") ?? "",
      /^application\/json/u,
    );
    const materials = await response.json();
    assert.equal(materials.length, workspace.materials.length);
    assert.deepEqual(
      materials.map(({ id }) => id),
      workspace.materials.map(({ id }) => id),
    );
    for (const material of materials) {
      assert.equal(material.document.type, "doc");
      assert.equal(material.documentSchemaVersion, 1);
      assert.ok(Number.isInteger(material.revision) && material.revision > 0);
    }
    if (materials.length) {
      const canonical = await request(
        `/api/materials/${encodeURIComponent(materials[0].id)}`,
      );
      assert.equal(canonical.status, 200);
      assert.deepEqual(materials[0], await canonical.json());
    }
  });

  test("A missing campaign returns the stable preload error", async () => {
    const response = await request(
      "/api/campaigns/00000000-0000-0000-0000-000000000000/materials",
    );

    assert.equal(response.status, 404);
    assert.match(
      response.headers.get("content-type") ?? "",
      /^application\/problem\+json/u,
    );
    assert.equal((await response.json()).code, "campaign_not_found");
  });
});
