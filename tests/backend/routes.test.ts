import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startServer, type TestServer } from "./helpers";
import {
  mapWithLimit,
  parseInventoryProbe,
  zipFolderName,
} from "../../src/backend/routes.js";

let server: TestServer;

afterEach(async () => {
  await server?.close();
});

async function createFleet(
  server: TestServer,
  body: Record<string, unknown> = { name: "Web fleet" },
) {
  const res = await server.request("POST", "/", { body });
  expect(res.status).toBe(200);
  return res.body;
}

describe("fleet CRUD routes", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  it("creates and lists fleets with member counts", async () => {
    const created = await createFleet(server);
    expect(created).toMatchObject({ name: "Web fleet", tagRules: [] });

    const list = await server.request("GET", "/");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ id: created.id, memberCount: 0 });
  });

  it("400s on a missing name", async () => {
    const res = await server.request("POST", "/", { body: {} });
    expect(res.status).toBe(400);
  });

  it("updates and deletes a fleet", async () => {
    const created = await createFleet(server);
    const updated = await server.request("PATCH", `/${created.id}`, {
      body: { name: "Renamed" },
    });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe("Renamed");

    const deleted = await server.request("DELETE", `/${created.id}`);
    expect(deleted.status).toBe(200);
    expect((await server.request("GET", "/")).body).toHaveLength(0);
  });

  it("404s for a fleet the caller does not own", async () => {
    const res = await server.request("GET", "/999/members");
    expect(res.status).toBe(404);
  });

  it("400s on a non-numeric fleet id", async () => {
    const res = await server.request("GET", "/not-a-number/members");
    expect(res.status).toBe(400);
  });
});

describe("fleet membership routes", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  it("adds and lists members, then removes one", async () => {
    const fleet = await createFleet(server);
    const added = await server.request("POST", `/${fleet.id}/members`, {
      body: { hostId: 10 },
    });
    expect(added.status).toBe(200);

    const members = await server.request("GET", `/${fleet.id}/members`);
    expect(members.status).toBe(200);
    expect(members.body).toHaveLength(1);
    expect(members.body[0]).toMatchObject({ id: 10, static: true });

    const removed = await server.request("DELETE", `/${fleet.id}/members/10`);
    expect(removed.status).toBe(200);
    expect(
      (await server.request("GET", `/${fleet.id}/members`)).body,
    ).toHaveLength(0);
  });

  it("404s when adding a host outside the fixture host list", async () => {
    const fleet = await createFleet(server);
    const res = await server.request("POST", `/${fleet.id}/members`, {
      body: { hostId: 999 },
    });
    expect(res.status).toBe(404);
  });
});

describe("permission gates", () => {
  it("view routes 403 without fleets.view", async () => {
    server = await startServer({
      permissions: ["fleets.manage", "fleets.execute"],
    });
    const res = await server.request("GET", "/");
    expect(res.status).toBe(403);
  });

  it("manage routes 403 without fleets.manage", async () => {
    server = await startServer({
      permissions: ["fleets.view", "fleets.execute"],
    });
    const res = await server.request("POST", "/", { body: { name: "x" } });
    expect(res.status).toBe(403);
  });

  it("execute routes 403 without fleets.execute", async () => {
    server = await startServer({
      permissions: ["fleets.view", "fleets.manage"],
    });
    const fleet = await createFleet(server);
    const res = await server.request("POST", `/${fleet.id}/execute`, {
      body: { command: "uptime" },
    });
    expect(res.status).toBe(403);
  });
});

describe("parseInventoryProbe", () => {
  it("extracts kernel, arch, hostname, and uptime from key=value lines", () => {
    const out = [
      "kernel=6.1.0-generic",
      "arch=x86_64",
      "hostname=web-1",
      "uptime_seconds=123456",
    ].join("\n");

    expect(parseInventoryProbe(out)).toEqual({
      kernel: "6.1.0-generic",
      architecture: "x86_64",
      hostname: "web-1",
      uptimeSeconds: 123456,
    });
  });

  it("nulls out fields missing from the probe output", () => {
    expect(parseInventoryProbe("kernel=6.1.0")).toEqual({
      kernel: "6.1.0",
      architecture: null,
      hostname: null,
      uptimeSeconds: null,
    });
  });

  it("nulls uptimeSeconds when the value is not a bare integer", () => {
    expect(parseInventoryProbe("uptime_seconds=").uptimeSeconds).toBeNull();
  });

  it("ignores lines with no '=' separator", () => {
    const out = ["garbage line", "kernel=6.1.0"].join("\n");
    expect(parseInventoryProbe(out).kernel).toBe("6.1.0");
  });
});

describe("share target pickers", () => {
  beforeEach(async () => {
    server = await startServer();
  });

  it("lists users and roles through ctx.hosts", async () => {
    const users = await server.request("GET", "/share-targets/users");
    expect(users.status).toBe(200);
    expect(users.body).toEqual({ users: [] });

    const roles = await server.request("GET", "/share-targets/roles");
    expect(roles.status).toBe(200);
    expect(roles.body).toEqual({ roles: [] });
  });
});

describe("mapWithLimit", () => {
  it("keeps order and never runs more than the limit at once", async () => {
    let running = 0;
    let peak = 0;
    const out = await mapWithLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50, 60]);
    expect(peak).toBe(2);
  });

  it("handles an empty list", async () => {
    expect(await mapWithLimit([], 3, async (n) => n)).toEqual([]);
  });
});

describe("zipFolderName", () => {
  it("keeps a host from escaping the archive", () => {
    const name = zipFolderName({ id: 4, name: "../../etc" });
    expect(name).not.toContain("/");
    expect(name.startsWith(".")).toBe(false);
  });

  it("tells same-named hosts apart", () => {
    expect(zipFolderName({ id: 1, name: "web" })).not.toBe(
      zipFolderName({ id: 2, name: "web" }),
    );
  });
});
