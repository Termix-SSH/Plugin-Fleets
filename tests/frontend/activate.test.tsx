import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import {
  renderWithApp,
  type RenderedPluginApp,
} from "@termix-ssh/plugin-sdk/testing";
import type { PluginManifest } from "@termix-ssh/plugin-sdk/manifest";
import * as plugin from "../../src/frontend/index";
import manifestJson from "../../manifest.json";
import locales from "../../locales/en.json";

const manifest = manifestJson as unknown as PluginManifest;

const declared = (views?: Array<{ id: string }>) =>
  (views ?? []).map((view) => view.id).sort();

let rendered: RenderedPluginApp | null = null;

afterEach(async () => {
  await rendered?.deactivate();
  rendered = null;
});

describe(`${manifest.id} activate`, () => {
  it("activates and registers only views its manifest declares", async () => {
    rendered = await renderWithApp(plugin, { manifest, locales });
    const contributes = manifest.contributes as unknown as Record<
      string,
      Array<{ id: string }> | undefined
    >;
    const tabs = declared(contributes.tabs);
    // A rail panel may reuse one of the plugin's tab ids.
    const panels = [...declared(contributes.panels), ...tabs];
    const cards = declared(contributes.dashboardCards);
    for (const id of rendered.registered.tabs()) expect(tabs).toContain(id);
    for (const id of rendered.registered.panels()) expect(panels).toContain(id);
    for (const id of rendered.registered.dashboardCards()) {
      expect(cards).toContain(id);
    }
  });

  it("removes everything it registered on deactivate", async () => {
    const app = await renderWithApp(plugin, { manifest, locales });
    await app.deactivate();
    expect(app.registered.tabs()).toEqual([]);
    expect(app.registered.panels()).toEqual([]);
    expect(app.registered.railItems()).toEqual([]);
    expect(app.registered.hostActions()).toEqual([]);
    expect(app.registered.hostEditorSections()).toEqual([]);
    expect(app.registered.dashboardCards()).toEqual([]);
    expect(app.registered.settingsComponents()).toEqual([]);
    expect(app.registered.actions()).toEqual([]);
  });
});

describe("fleets dashboard card", () => {
  it("lists fleets with their host counts", async () => {
    const list = [{ id: 3, name: "Web fleet", memberCount: 2 }];
    const app = await renderWithApp(plugin, {
      manifest,
      locales,
      permissions: ["fleets.view"],
      api: { get: async () => ({ data: list }) } as never,
    });
    expect(app.registered.dashboardCards()).toEqual(["fleets"]);
    app.renderDashboardCard("fleets");
    expect(await screen.findByText("Web fleet")).toBeTruthy();
    expect(screen.getByText("2 hosts")).toBeTruthy();
    await app.deactivate();
  });
});
