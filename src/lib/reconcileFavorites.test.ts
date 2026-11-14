import { describe, expect, it } from "vitest";

import type { Favorites } from "./config";
import {
  comparableName,
  missingFavorites,
  pruneNames,
  reconcileFavorites,
  unlistedFavoriteIds,
  type ResolvedEndpoints,
} from "./reconcileFavorites";
import type { AudioDevice, DeviceDirection, ResolvedEndpoint } from "./tauri";

function device(
  id: string,
  name: string,
  overrides: Partial<AudioDevice> = {},
): AudioDevice {
  return {
    id,
    name,
    direction: "output",
    isDefault: false,
    state: "active",
    isBluetooth: false,
    btMac: null,
    ...overrides,
  };
}

function favs(partial: Partial<Favorites> = {}): Favorites {
  return { output: [], input: [], names: {}, ...partial };
}

function gone(
  id: string,
  state: ResolvedEndpoint["state"] = "notpresent",
  name: string | null = null,
): [string, ResolvedEndpoint] {
  return [id, { id, name, state }];
}

const resolvedOf = (...entries: [string, ResolvedEndpoint][]): ResolvedEndpoints =>
  Object.fromEntries(entries);

describe("reconcileFavorites", () => {
  it("follows a device whose endpoint id changed, keeping its position", () => {
    const result = reconcileFavorites(
      favs({ output: ["a", "old", "c"], names: { old: "Monitor (HDMI)" } }),
      [device("a", "Speakers"), device("new", "Monitor (HDMI)"), device("c", "Headset")],
      resolvedOf(gone("old")),
    );
    expect(result.output).toEqual(["a", "new", "c"]);
    expect(result.names.new).toBe("Monitor (HDMI)");
    expect(result.names.old).toBeUndefined();
  });

  it("follows a USB device moved to another port, where Windows renames it", () => {
    const result = reconcileFavorites(
      favs({ output: ["old"], names: { old: "Headset (CX31993+MAX97220)" } }),
      [device("new", "Headset (3- CX31993+MAX97220)")],
      resolvedOf(gone("old")),
    );
    expect(result.output).toEqual(["new"]);
    // The new name is the one on record from now on.
    expect(result.names).toEqual({ new: "Headset (3- CX31993+MAX97220)" });
  });

  it("uses the name Windows still knows when none was stored", () => {
    const result = reconcileFavorites(
      favs({ output: ["old"] }),
      [device("new", "Monitor (HDMI)")],
      resolvedOf(gone("old", "notpresent", "Monitor (HDMI)")),
    );
    expect(result.output).toEqual(["new"]);
  });

  it("leaves everything alone when two devices could be the replacement", () => {
    const input = favs({ output: ["old"], names: { old: "Monitor (HDMI)" } });
    const result = reconcileFavorites(
      input,
      [device("n1", "Monitor (HDMI)"), device("n2", "Monitor (HDMI)")],
      resolvedOf(gone("old")),
    );
    expect(result).toBe(input);
  });

  it("prefers the one active device over unplugged namesakes", () => {
    const result = reconcileFavorites(
      favs({ output: ["old"], names: { old: "Monitor (HDMI)" } }),
      [
        device("n1", "Monitor (HDMI)", { state: "unplugged" }),
        device("n2", "Monitor (HDMI)"),
      ],
      resolvedOf(gone("old")),
    );
    expect(result.output).toEqual(["n2"]);
  });

  it("does not touch a favorite the backend did not confirm as gone", () => {
    // Absent from a list snapshot but still resolvable: topology churn.
    const input = favs({ output: ["old"], names: { old: "Monitor (HDMI)" } });
    const devices = [device("new", "Monitor (HDMI)")];
    expect(
      reconcileFavorites(input, devices, resolvedOf(gone("old", "unplugged"))),
    ).toBe(input);
    expect(reconcileFavorites(input, devices, {})).toBe(input);
  });

  it("never reuses a device that is already a favorite", () => {
    const input = favs({
      output: ["old", "new"],
      names: { old: "Monitor (HDMI)", new: "Monitor (HDMI)" },
    });
    const result = reconcileFavorites(
      input,
      [device("new", "Monitor (HDMI)")],
      resolvedOf(gone("old")),
    );
    expect(result.output).toEqual(["old", "new"]);
  });

  it("collapses stale ids of one device into its replacement", () => {
    const result = reconcileFavorites(
      favs({
        output: ["old1", "a", "old2"],
        names: { old1: "Monitor (HDMI)", old2: "Monitor (HDMI)" },
      }),
      [device("a", "Speakers"), device("new", "Monitor (HDMI)")],
      resolvedOf(gone("old1"), gone("old2", "missing")),
    );
    expect(result.output).toEqual(["new", "a"]);
  });

  it("matches within the same direction only", () => {
    const input = favs({ output: ["old"], names: { old: "USB Audio" } });
    const result = reconcileFavorites(
      input,
      [device("mic", "USB Audio", { direction: "input" })],
      resolvedOf(gone("old")),
    );
    expect(result).toBe(input);
  });

  it("keeps a gone favorite that has no name to match on", () => {
    const input = favs({ output: ["old"] });
    const result = reconcileFavorites(
      input,
      [device("new", "Monitor (HDMI)")],
      resolvedOf(gone("old", "missing")),
    );
    expect(result).toBe(input);
  });

  it("records the names of listed favorites and drops stale ones", () => {
    const result = reconcileFavorites(
      favs({ output: ["a"], names: { removed: "Old thing" } }),
      [device("a", "Speakers")],
      {},
    );
    expect(result.names).toEqual({ a: "Speakers" });
  });

  it("returns the same object when there is nothing to change", () => {
    const input = favs({ output: ["a"], names: { a: "Speakers" } });
    expect(reconcileFavorites(input, [device("a", "Speakers")], {})).toBe(input);
  });
});

describe("pruneNames", () => {
  it("drops names of ids that are no longer favorites", () => {
    const pruned = pruneNames(
      favs({ output: ["a"], names: { a: "Speakers", gone: "Old" } }),
    );
    expect(pruned.names).toEqual({ a: "Speakers" });
  });

  it("returns the same object when every name is still in use", () => {
    const input = favs({ output: ["a"], names: { a: "Speakers" } });
    expect(pruneNames(input)).toBe(input);
  });
});

describe("comparableName", () => {
  it("drops the USB port prefix inside the parentheses", () => {
    expect(comparableName("Headset (3- CX31993+MAX97220)")).toBe(
      "Headset (CX31993+MAX97220)",
    );
    expect(comparableName("Headset (CX31993+MAX97220)")).toBe(
      "Headset (CX31993+MAX97220)",
    );
  });

  it("leaves names that merely contain digits alone", () => {
    expect(comparableName("Realtek (R) Audio 2")).toBe("Realtek (R) Audio 2");
    expect(comparableName("Speakers (2 channel)")).toBe("Speakers (2 channel)");
  });
});

describe("unlistedFavoriteIds", () => {
  it("lists favorites missing from the device list, per direction", () => {
    const ids = unlistedFavoriteIds(
      favs({ output: ["a", "gone1"], input: ["mic", "gone2"] }),
      [device("a", "Speakers"), device("mic", "Mic", { direction: "input" })],
    );
    expect(ids).toEqual(["gone1", "gone2"]);
  });
});

describe("missingFavorites", () => {
  const input = favs({ output: ["a", "gone"], names: { gone: "Old monitor" } });
  const devices = [device("a", "Speakers")];

  it("returns the unlisted favorites with their remembered name", () => {
    expect(missingFavorites(input, devices, "output")).toEqual([
      { id: "gone", name: "Old monitor" },
    ]);
    expect(missingFavorites(input, devices, "input" as DeviceDirection)).toEqual([]);
  });

  it("reports nothing when the device list is empty", () => {
    expect(missingFavorites(input, [], "output")).toEqual([]);
  });
});
