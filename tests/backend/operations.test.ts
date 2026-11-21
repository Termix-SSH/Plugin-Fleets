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

describe("fleets.exec", () => {
  it("reports output and exit code, also when the command fails", async () => {
    const { EventEmitter } = await import("node:events");
    const { vi } = await import("vitest");
    server = await startServer();
    const client = {
      exec: (...args: unknown[]) => {
        const cb = args.at(-1) as (err: Error | null, stream: unknown) => void;
        const stream = Object.assign(new EventEmitter(), {
          stderr: new EventEmitter(),
          close: () => {},
          end: () => {},
        });
        cb(null, stream);
        setTimeout(() => {
          stream.emit("data", Buffer.from("6.8.0\n"));
          stream.stderr.emit("data", Buffer.from("reboot needed\n"));
          stream.emit("exit", 3);
          stream.emit("close", 3);
        }, 0);
      },
    };
    (server.mock.ctx.ssh as unknown as Record<string, unknown>).withConnection =
      vi.fn(async (_id: number, _o: unknown, fn: (c: unknown) => unknown) =>
        fn(client),
      );
    const handler = server.mock.operationHandlers.get("fleets.exec")!;
    const result = await server.mock.actAs("user-1", () =>
      handler.run({ command: "uname -r" }, { hostId: 1 } as never),
    );
    expect(result.summary).toBe("Exited with code 3");
    expect(result.data).toMatchObject({
      exitCode: 3,
      stdout: "6.8.0\n",
      stderr: "reboot needed\n",
    });
  });

  it("keeps the time limit between 1 and 600 seconds", async () => {
    const { execTimeout } = await import("../../src/backend/operations.js");
    expect(execTimeout(undefined)).toBe(600_000);
    expect(execTimeout(5)).toBe(5_000);
    expect(execTimeout(9999)).toBe(600_000);
    expect(execTimeout(0.2)).toBe(1_000);
  });
});
