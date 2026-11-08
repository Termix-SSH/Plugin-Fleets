import { afterEach, describe, expect, it } from "vitest";
import type { SyncRow } from "@termix-ssh/plugin-sdk/backend";
import { startServer, type TestServer } from "./helpers";

let server: TestServer | null = null;

afterEach(async () => {
  await server?.close();
  server = null;
});

function fleetEntity(s: TestServer) {
  const entity = s.mock.syncEntities.find((e) => e.type === "fleets");
  if (!entity) throw new Error("fleets entity not registered");
  return entity;
}

describe("fleets sync entity", () => {
  it("syncs after hosts and needs fleets.manage for pushes", async () => {
    server = await startServer();
    const entity = fleetEntity(server);
    expect(entity.order).toBeGreaterThan(50);
    expect(entity.permissions?.create).toBe("fleets.manage");
  });

  it("sends static members as host syncIds", async () => {
    server = await startServer();
    const created = await server.request("POST", "/", {
      body: { name: "prod" },
    });
    expect(created.status).toBeLessThan(300);
    const fleetId = created.body.id;
    await server.request("POST", `/${fleetId}/members`, {
      body: { hostId: 10 },
    });

    const row = await fleetEntity(server).serialize!(
      { id: fleetId, name: "prod" } as SyncRow,
      async (type, id) => (type === "hosts" ? `host-${id}` : null),
    );
    expect(row.memberHostSyncIds).toEqual(["host-10"]);
  });

  it("rewrites members from an inbound row", async () => {
    server = await startServer();
    const created = await server.request("POST", "/", {
      body: { name: "prod" },
    });
    const fleetId = created.body.id;
    await server.request("POST", `/${fleetId}/members`, {
      body: { hostId: 10 },
    });

    await fleetEntity(server).afterWrite!({
      id: fleetId,
      userId: "user-1",
      created: false,
      wire: { memberHostSyncIds: ["host-11", "missing"] } as SyncRow,
      resolveId: async (_type, syncId) => (syncId === "host-11" ? 11 : null),
    });

    const row = await fleetEntity(server).serialize!(
      { id: fleetId } as SyncRow,
      async (_type, id) => `host-${id}`,
    );
    expect(row.memberHostSyncIds).toEqual(["host-11"]);
  });
});
