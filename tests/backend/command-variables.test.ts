import { describe, expect, it } from "vitest";
import { resolveCommandVariables } from "../../src/backend/routes.js";

function registry(value?: unknown) {
  return {
    registry: {
      provide: () => {},
      revoke: () => false,
      consume: <T>() => value as T | undefined,
    },
  } as never;
}

describe("resolveCommandVariables", () => {
  it("fills variables through the snippets plugin's resolver", async () => {
    const ctx = registry({
      resolve: (content: string, host: { ip?: string } | null) =>
        content.replace("$HOST", host?.ip ?? ""),
    });
    expect(
      await resolveCommandVariables(ctx, "ping $HOST", { ip: "10.0.0.1" }),
    ).toBe("ping 10.0.0.1");
  });

  it("waits for a resolver that answers from its own process", async () => {
    const ctx = {
      registry: {
        provide: () => {},
        revoke: async () => false,
        consume: async () => ({
          resolve: async (content: string, host: { ip?: string } | null) =>
            content.replace("$HOST", host?.ip ?? ""),
        }),
      },
    } as never;
    expect(
      await resolveCommandVariables(ctx, "ping $HOST", { ip: "10.0.0.1" }),
    ).toBe("ping 10.0.0.1");
  });

  it("runs the command as typed while snippets is off", async () => {
    expect(
      await resolveCommandVariables(registry(), "ping $HOST", {
        ip: "10.0.0.1",
      }),
    ).toBe("ping $HOST");
  });
});
