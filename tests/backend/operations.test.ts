import { afterEach, describe, expect, it } from "vitest";
import { startServer, type TestServer } from "./helpers";

let server: TestServer;

afterEach(async () => {
  await server?.close();
});

describe("fleets.list-fleets", () => {
  it("lists the fleets of the acting user with host counts", async () => {
    server = await startServer();
    await server.request("POST", "/", { body: { name: "Web fleet" } });
    const handler = server.mock.operationHandlers.get("fleets.list-fleets")!;
    const result = await server.mock.actAs("user-1", () =>
      handler.run({}, {} as never),
    );
    expect(result.summary).toBe("1 fleets");
    expect((result.data as { rows: unknown[] }).rows).toEqual([
      expect.objectContaining({ name: "Web fleet", hosts: 0 }),
    ]);
  });
});
