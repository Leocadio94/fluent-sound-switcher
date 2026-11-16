import { describe, expect, it } from "vitest";

import type { AudioDevice } from "./tauri";
import { visibleDevices } from "./visibleDevices";

function device(id: string, overrides: Partial<AudioDevice> = {}): AudioDevice {
  return {
    id,
    name: id,
    direction: "output",
    isDefault: false,
    state: "active",
    isBluetooth: false,
    btMac: null,
    ...overrides,
  };
}

const devices = [
  device("active-fav"),
  device("active-other"),
  device("asleep-fav", { state: "unplugged" }),
  device("asleep-other", { state: "unplugged" }),
];
const favorites = new Set(["active-fav", "asleep-fav"]);
const isFavorite = (_: unknown, id: string) => favorites.has(id);
const ids = (list: AudioDevice[]) => list.map((d) => d.id);

describe("visibleDevices", () => {
  it("keeps a disconnected favorite by default, never a disconnected stranger", () => {
    expect(
      ids(
        visibleDevices(devices, isFavorite, {
          onlyFavorites: false,
          hideUnavailable: false,
        }),
      ),
    ).toEqual(["active-fav", "active-other", "asleep-fav"]);
  });

  it("drops disconnected favorites when asked to hide them", () => {
    expect(
      ids(
        visibleDevices(devices, isFavorite, {
          onlyFavorites: false,
          hideUnavailable: true,
        }),
      ),
    ).toEqual(["active-fav", "active-other"]);
  });

  it("combines with the favorites-only filter", () => {
    expect(
      ids(
        visibleDevices(devices, isFavorite, {
          onlyFavorites: true,
          hideUnavailable: false,
        }),
      ),
    ).toEqual(["active-fav", "asleep-fav"]);
    expect(
      ids(
        visibleDevices(devices, isFavorite, {
          onlyFavorites: true,
          hideUnavailable: true,
        }),
      ),
    ).toEqual(["active-fav"]);
  });
});
