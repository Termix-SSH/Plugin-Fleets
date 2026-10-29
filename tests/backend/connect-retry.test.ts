import { describe, expect, it, vi } from "vitest";
import {
  isConnectTimeout,
  withConnectRetry,
} from "../../src/backend/routes.js";

const noWait = async () => {};

describe("withConnectRetry", () => {
  it("tries a timed out host again and reports the tries", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Timed out while waiting for handshake"))
      .mockResolvedValueOnce("ok");
    const result = await withConnectRetry(
      { retries: 2, delayMs: 1 },
      fn,
      noWait,
    );
    expect(result).toEqual({ value: "ok", attempts: 2 });
  });

  it("gives up after the last retry", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("SSH connection timeout"));
    await expect(
      withConnectRetry({ retries: 1, delayMs: 1 }, fn, noWait),
    ).rejects.toThrow("SSH connection timeout (after 2 tries)");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("never retries other errors or a command timeout", async () => {
    for (const message of [
      "Authentication failed",
      "Command timeout after 5ms",
    ]) {
      const fn = vi.fn().mockRejectedValue(new Error(message));
      await expect(
        withConnectRetry({ retries: 3, delayMs: 1 }, fn, noWait),
      ).rejects.toThrow(message);
      expect(fn).toHaveBeenCalledTimes(1);
    }
    expect(isConnectTimeout(new Error("connect ETIMEDOUT 10.0.0.1:22"))).toBe(
      true,
    );
  });
});
