import { describe, expect, it, vi } from "vitest";
import type { PluginApiClient } from "@termix-ssh/plugin-sdk/frontend";
import { createFleetsApi } from "../../src/frontend/fleets-api";

describe("fleets api", () => {
  it("never times out a fleet run on the client", async () => {
    const post = vi.fn().mockResolvedValue({ data: { results: [] } });
    const api = createFleetsApi({ post } as unknown as PluginApiClient);

    await api.runCommand(1, "sleep 35");
    await api.runPackageAction(1, "upgrade-all");

    expect(post.mock.calls[0][2]).toMatchObject({ timeout: 0 });
    expect(post.mock.calls[1][2]).toMatchObject({ timeout: 0 });
  });
});
