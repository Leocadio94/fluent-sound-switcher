import { describe, expect, it } from "vitest";

import { toAccelerator } from "./HotkeyInput";

/** Minimal stand-in for the KeyboardEvent fields `toAccelerator` reads. */
function keydown(
  code: string,
  mods: Partial<Record<"ctrlKey" | "altKey" | "shiftKey" | "metaKey", boolean>> = {},
): KeyboardEvent {
  return {
    code,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...mods,
  } as KeyboardEvent;
}

describe("toAccelerator", () => {
  it("builds an accelerator from modifiers plus a key", () => {
    expect(toAccelerator(keydown("KeyM", { ctrlKey: true, altKey: true }))).toBe(
      "Ctrl+Alt+M",
    );
    expect(toAccelerator(keydown("F11", { ctrlKey: true, altKey: true }))).toBe(
      "Ctrl+Alt+F11",
    );
    expect(toAccelerator(keydown("Digit4", { ctrlKey: true }))).toBe("Ctrl+4");
  });

  it("keeps the modifier order Tauri expects", () => {
    const all = keydown("KeyA", {
      metaKey: true,
      shiftKey: true,
      altKey: true,
      ctrlKey: true,
    });
    expect(toAccelerator(all)).toBe("Ctrl+Alt+Shift+Super+A");
  });

  it("rejects a bare key, so a binding cannot swallow plain typing", () => {
    expect(toAccelerator(keydown("KeyM"))).toBeNull();
    expect(toAccelerator(keydown("F11"))).toBeNull();
  });

  it("accepts navigation keys with a modifier", () => {
    expect(toAccelerator(keydown("ArrowUp", { ctrlKey: true }))).toBe("Ctrl+Up");
    expect(toAccelerator(keydown("PageDown", { altKey: true }))).toBe(
      "Alt+PageDown",
    );
  });

  it("accepts media keys bare", () => {
    // They cannot be typed by accident, and binding them with a modifier is
    // not how people expect media keys to work.
    expect(toAccelerator(keydown("AudioVolumeUp"))).toBe("VolumeUp");
    expect(toAccelerator(keydown("AudioVolumeDown"))).toBe("VolumeDown");
    expect(toAccelerator(keydown("AudioVolumeMute"))).toBe("VolumeMute");
  });

  it("still allows a media key to carry modifiers", () => {
    expect(toAccelerator(keydown("AudioVolumeUp", { ctrlKey: true }))).toBe(
      "Ctrl+VolumeUp",
    );
  });

  it("rejects keys outside the supported set", () => {
    for (const code of ["Space", "Enter", "Escape", "F25"]) {
      expect(toAccelerator(keydown(code, { ctrlKey: true }))).toBeNull();
    }
  });

  it("rejects a modifier pressed on its own", () => {
    // The keydown for Ctrl itself reports ctrlKey with code ControlLeft.
    expect(toAccelerator(keydown("ControlLeft", { ctrlKey: true }))).toBeNull();
  });
});
