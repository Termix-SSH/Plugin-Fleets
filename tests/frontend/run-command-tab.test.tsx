import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const invokeAction = vi.fn(async (id: string) => {
  if (id === "snippets.list") {
    return [
      { id: 1, name: "Disk", content: "df -h", isNote: false },
      { id: 2, name: "Readme", content: "notes", isNote: true },
    ];
  }
  return [];
});

vi.mock("@termix-ssh/plugin-sdk/frontend", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  invokeAction: (id: string, ...args: unknown[]) => invokeAction(id, ...args),
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { RunCommandTab } = await import("../../src/frontend/FleetsPanel");

describe("the fleet run box", () => {
  it("runs a picked snippet on the fleet", async () => {
    const runCommand = vi.fn(async () => ({ results: [] }));
    render(<RunCommandTab api={{ runCommand } as never} fleetId={7} />);
    const picker = (
      await screen.findAllByLabelText("newUi.sidebar.fleets.useSnippet")
    ).find((element) => element.tagName === "SELECT")!;
    expect(screen.queryByRole("option", { name: "Readme" })).toBeNull();

    fireEvent.change(picker, { target: { value: "1" } });
    expect(screen.getByDisplayValue("df -h")).toBeTruthy();

    fireEvent.click(screen.getByText("newUi.sidebar.fleets.runOnFleet"));
    await waitFor(() =>
      expect(runCommand).toHaveBeenCalledWith(7, "df -h", undefined),
    );
  });
});
